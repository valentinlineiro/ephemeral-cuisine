# v2 Phase 2-C: Technique Library + Cook Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Techniques screen (CRUD for techniques, mastery scores) and the mandatory post-cook flow (log combination + ratings + who ate + modifications + leftovers after each cook).

**Architecture:** `TechniqueService` handles CRUD for `techniques` and aggregates mastery from `cooked_versions`. `CookLogService` inserts into `cooked_versions` and deducts used ingredients from `inventory_items`. The post-cook flow is a full-screen bottom sheet triggered from cooking mode's "Finished" button in `recipe-detail`. Mastery grade uses `calcMastery()` from `technique.model.ts`.

**Tech Stack:** Angular 18 signals, Supabase, Tailwind, TranslatePipe.

**Prerequisite:** Plan 2-A (tables and models exist), Plan 2-B (`InventoryService.deductItems` exists).

---

### Task 1: TechniqueService

**Files:**
- Create: `src/app/features/techniques/technique.service.ts`
- Create: `src/app/features/techniques/technique.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/techniques/technique.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { TechniqueService } from './technique.service';
import { SupabaseService } from '../../core/supabase.service';
import { Technique } from './technique.model';

const technique: Technique = {
  id: 't1', user_id: 'u1', name: 'Stir-fry',
  base_steps: [{ order: 1, text: 'Heat wok' }],
  equipment: ['wok'], skill_level: 'intermediate', created_at: '',
};

function makeClient(listResult: unknown, singleResult: unknown = null, mutateResult: unknown = null) {
  return {
    from: (_: string) => ({
      select: (_2: string) => ({
        order: (_3: string, _4: unknown) => Promise.resolve(listResult),
        eq: (_3: string, _4: string) => ({
          single: () => Promise.resolve(singleResult),
        }),
      }),
      insert: (_2: unknown) => ({
        select: () => ({ single: () => Promise.resolve(mutateResult) }),
      }),
      update: (_2: unknown) => ({
        eq: (_3: string, _4: string) => Promise.resolve(mutateResult),
      }),
      delete: () => ({
        eq: (_3: string, _4: string) => Promise.resolve(mutateResult),
      }),
    }),
  };
}

describe('TechniqueService', () => {
  function setup(l: unknown, s: unknown = null, m: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        TechniqueService,
        { provide: SupabaseService, useValue: { client: makeClient(l, s, m) } },
      ],
    });
    return TestBed.inject(TechniqueService);
  }

  it('getTechniques returns array', async () => {
    const svc = setup({ data: [technique], error: null });
    expect(await svc.getTechniques()).toHaveLength(1);
  });

  it('getTechniques throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db') });
    await expect(svc.getTechniques()).rejects.toThrow('db');
  });

  it('addTechnique inserts and returns technique', async () => {
    const svc = setup({ data: [], error: null }, null, { data: technique, error: null });
    const result = await svc.addTechnique({ name: 'Stir-fry', base_steps: [], equipment: [], skill_level: 'beginner' });
    expect(result.name).toBe('Stir-fry');
  });

  it('deleteTechnique sends delete', async () => {
    const svc = setup({ data: [], error: null }, null, { error: null });
    await expect(svc.deleteTechnique('t1')).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="technique.service" --no-coverage
```

Expected: FAIL — `Cannot find module './technique.service'`

- [ ] **Step 3: Implement TechniqueService**

```typescript
// src/app/features/techniques/technique.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { SkillLevel, Technique, TechniqueStep, TechniqueWithStats, calcMastery } from './technique.model';

export interface AddTechniqueInput {
  name: string;
  base_steps: TechniqueStep[];
  equipment: string[];
  skill_level: SkillLevel;
}

@Injectable({ providedIn: 'root' })
export class TechniqueService {
  constructor(private supabase: SupabaseService) {}

  async getTechniques(): Promise<Technique[]> {
    const { data, error } = await this.supabase.client
      .from('techniques')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getTechniqueWithStats(id: string): Promise<TechniqueWithStats> {
    const [techniqueRes, cookRes] = await Promise.all([
      this.supabase.client.from('techniques').select('*').eq('id', id).single(),
      this.supabase.client
        .from('cooked_versions')
        .select('ratings')
        .eq('technique_id', id),
    ]);
    if (techniqueRes.error) throw techniqueRes.error;
    if (cookRes.error) throw cookRes.error;

    const cooks: Array<{ ratings: Record<string, number> }> = cookRes.data ?? [];
    const cook_count = cooks.length;
    const selfRatings = cooks.map(c => c.ratings['self'] ?? 0).filter(r => r > 0);
    const avg_rating = selfRatings.length ? selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length : 0;

    return { ...techniqueRes.data, cook_count, avg_rating, mastery: calcMastery(cook_count, avg_rating) };
  }

  async addTechnique(input: AddTechniqueInput): Promise<Technique> {
    const { data, error } = await this.supabase.client
      .from('techniques')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTechnique(id: string, updates: Partial<AddTechniqueInput>): Promise<void> {
    const { error } = await this.supabase.client
      .from('techniques')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async deleteTechnique(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('techniques')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="technique.service" --no-coverage
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/techniques/technique.service.ts src/app/features/techniques/technique.service.spec.ts
git commit -m "feat(techniques): add TechniqueService with CRUD and mastery aggregation"
```

---

### Task 2: CookLogService

**Files:**
- Create: `src/app/features/cook-log/cook-log.service.ts`
- Create: `src/app/features/cook-log/cook-log.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/cook-log/cook-log.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { CookLogService } from './cook-log.service';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { CookedVersion, CookLogInput } from './cook-log.model';

const logInput: CookLogInput = {
  recipe_id: 'r1',
  combo: { protein: 'chicken', produce: ['peppers'], seasoning: 'soy' },
  ratings: { self: 8, partner: 9 },
  family_present: ['partner'],
};

const cookEntry: CookedVersion = {
  id: 'cv1', user_id: 'u1', recipe_id: 'r1', technique_id: null,
  cooked_at: '', combo: logInput.combo, ratings: logInput.ratings,
  notes: null, modifications: [], nutrition: null,
  family_present: ['partner'], leftovers: null,
};

function makeClient(insertResult: unknown, listResult: unknown = null) {
  return {
    from: (_: string) => ({
      insert: (_2: unknown) => ({
        select: () => ({ single: () => Promise.resolve(insertResult) }),
      }),
      select: (_2: string) => ({
        eq: (_3: string, _4: string) => ({
          order: (_5: string, _6: unknown) => Promise.resolve(listResult),
        }),
        order: (_3: string, _4: unknown) => Promise.resolve(listResult),
      }),
    }),
  };
}

describe('CookLogService', () => {
  const mockInventory = { deductItems: jest.fn().mockResolvedValue(undefined) };

  function setup(i: unknown, l: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        CookLogService,
        { provide: SupabaseService, useValue: { client: makeClient(i, l) } },
        { provide: InventoryService, useValue: mockInventory },
      ],
    });
    return TestBed.inject(CookLogService);
  }

  it('logCook inserts and returns cooked version', async () => {
    const svc = setup({ data: cookEntry, error: null });
    const result = await svc.logCook(logInput);
    expect(result.combo.protein).toBe('chicken');
  });

  it('logCook deducts ingredients from inventory', async () => {
    mockInventory.deductItems.mockClear();
    const svc = setup({ data: cookEntry, error: null });
    await svc.logCook({ ...logInput, inventory_deductions: [{ name: 'chicken', quantity: 2 }] });
    expect(mockInventory.deductItems).toHaveBeenCalledWith([{ name: 'chicken', quantity: 2 }]);
  });

  it('getHistoryForRecipe returns array', async () => {
    const svc = setup(null, { data: [cookEntry], error: null });
    expect(await svc.getHistoryForRecipe('r1')).toHaveLength(1);
  });

  it('logCook throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db') });
    await expect(svc.logCook(logInput)).rejects.toThrow('db');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="cook-log.service" --no-coverage
```

Expected: FAIL — `Cannot find module './cook-log.service'`

- [ ] **Step 3: Implement CookLogService**

```typescript
// src/app/features/cook-log/cook-log.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { CookedVersion, CookLogInput } from './cook-log.model';

export interface CookLogInputWithDeductions extends CookLogInput {
  inventory_deductions?: Array<{ name: string; quantity: number }>;
}

@Injectable({ providedIn: 'root' })
export class CookLogService {
  constructor(
    private supabase: SupabaseService,
    private inventoryService: InventoryService,
  ) {}

  async logCook(input: CookLogInputWithDeductions): Promise<CookedVersion> {
    const { inventory_deductions, ...payload } = input;
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    if (inventory_deductions?.length) {
      await this.inventoryService.deductItems(inventory_deductions);
    }

    return data;
  }

  async getHistoryForRecipe(recipe_id: string): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .eq('recipe_id', recipe_id)
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getHistoryForTechnique(technique_id: string): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .eq('technique_id', technique_id)
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getRecentCooks(limit = 20): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).slice(0, limit);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="cook-log.service" --no-coverage
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/cook-log/
git commit -m "feat(cook-log): add CookLogService with logCook, history queries, and inventory deduction"
```

---

### Task 3: Post-cook flow bottom sheet

**Files:**
- Create: `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts`

This full-screen overlay is shown after the user finishes cooking. It collects: self rating, family ratings, who was present, combo ingredients used, modifications, notes, leftover items. It deducts used ingredients from inventory on submit.

- [ ] **Step 1: Create the component**

```typescript
// src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts
import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../../../features/recipes/models/recipe.model';
import { CookLogService } from '../cook-log.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';
import { FamilyMember } from '../../../core/models/dietary-profile.model';
import { LeftoverItem } from '../cook-log.model';

@Component({
  selector: 'app-post-cook-flow',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './post-cook-flow.component.html',
})
export class PostCookFlowComponent implements OnInit {
  recipe = input.required<Recipe>();
  done = output<void>();

  familyMembers = signal<FamilyMember[]>([]);
  familyPresent = signal<string[]>([]);

  protein = signal('');
  produce = signal('');
  seasoning = signal('');

  selfRating = signal(7);
  familyRatings = signal<Record<string, number>>({});

  modifications = signal('');
  notes = signal('');

  leftoverName = signal('');
  leftoverQty = signal(200);
  leftovers = signal<LeftoverItem[]>([]);

  saving = signal(false);
  error = signal<string | null>(null);

  constructor(
    private cookLog: CookLogService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const profile = await this.dietaryProfile.getProfile().catch(() => null);
    this.familyMembers.set(profile?.family_members ?? []);
  }

  togglePresent(name: string): void {
    this.familyPresent.update(p =>
      p.includes(name) ? p.filter(n => n !== name) : [...p, name]
    );
  }

  setFamilyRating(name: string, value: number): void {
    this.familyRatings.update(r => ({ ...r, [name]: value }));
  }

  addLeftover(): void {
    const name = this.leftoverName().trim();
    if (!name) return;
    this.leftovers.update(l => [...l, { name, quantity_g: this.leftoverQty() }]);
    this.leftoverName.set('');
    this.leftoverQty.set(200);
  }

  removeLeftover(index: number): void {
    this.leftovers.update(l => l.filter((_, i) => i !== index));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const ratings: Record<string, number> = { self: this.selfRating(), ...this.familyRatings() };
      const produceList = this.produce().split(',').map(s => s.trim()).filter(Boolean);
      const modsList = this.modifications().split(',').map(s => s.trim()).filter(Boolean);

      await this.cookLog.logCook({
        recipe_id: this.recipe().id,
        combo: {
          protein: this.protein().trim(),
          produce: produceList,
          seasoning: this.seasoning().trim(),
        },
        ratings,
        notes: this.notes().trim() || undefined,
        modifications: modsList,
        family_present: this.familyPresent(),
        leftovers: this.leftovers().length ? { items: this.leftovers() } : undefined,
        inventory_deductions: [
          ...(this.protein().trim() ? [{ name: this.protein().trim(), quantity: 1 }] : []),
          ...produceList.map(p => ({ name: p, quantity: 1 })),
        ],
      });
      this.done.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 2: Create template**

```html
<!-- src/app/features/cook-log/post-cook-flow/post-cook-flow.component.html -->
<div class="fixed inset-0 bg-white z-50 overflow-y-auto">
  <div class="p-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">
    <h1 class="text-2xl font-bold text-gray-900">{{ 'cooklog.title' | translate }}</h1>

    <!-- COMBO USED -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.what_did_you_use' | translate }}</h2>
      <input type="text" [ngModel]="protein()" (ngModelChange)="protein.set($event)"
        [placeholder]="'cooklog.protein_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
      <input type="text" [ngModel]="produce()" (ngModelChange)="produce.set($event)"
        [placeholder]="'cooklog.produce_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
      <input type="text" [ngModel]="seasoning()" (ngModelChange)="seasoning.set($event)"
        [placeholder]="'cooklog.seasoning_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
    </section>

    <!-- WHO COOKED FOR -->
    @if (familyMembers().length > 0) {
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.who_ate' | translate }}</h2>
        <div class="flex flex-wrap gap-2">
          @for (m of familyMembers(); track m.name) {
            <button (click)="togglePresent(m.name)"
              [class]="familyPresent().includes(m.name)
                ? 'px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white'
                : 'px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600'">
              {{ m.name }}
            </button>
          }
        </div>
      </section>
    }

    <!-- YOUR RATING -->
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.your_rating' | translate }}</h2>
      <div class="flex items-center gap-3">
        <input type="range" min="1" max="10" step="1"
          [ngModel]="selfRating()" (ngModelChange)="selfRating.set(+$event)"
          class="flex-1 accent-primary" />
        <span class="text-2xl font-bold text-primary w-8 text-center">{{ selfRating() }}</span>
      </div>
    </section>

    <!-- FAMILY RATINGS -->
    @for (m of familyPresent(); track m) {
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ m }}</h2>
        <div class="flex items-center gap-3">
          <input type="range" min="1" max="10" step="1"
            [ngModel]="familyRatings()[m] ?? 7"
            (ngModelChange)="setFamilyRating(m, +$event)"
            class="flex-1 accent-primary" />
          <span class="text-2xl font-bold text-primary w-8 text-center">{{ familyRatings()[m] ?? 7 }}</span>
        </div>
      </section>
    }

    <!-- MODIFICATIONS -->
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.modifications' | translate }}</h2>
      <input type="text" [ngModel]="modifications()" (ngModelChange)="modifications.set($event)"
        [placeholder]="'cooklog.modifications_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
    </section>

    <!-- NOTES -->
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.notes' | translate }}</h2>
      <textarea [ngModel]="notes()" (ngModelChange)="notes.set($event)" rows="2"
        [placeholder]="'cooklog.notes_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"></textarea>
    </section>

    <!-- LEFTOVERS -->
    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'cooklog.leftovers' | translate }}</h2>
      @for (l of leftovers(); track l.name; let i = $index) {
        <div class="flex items-center gap-2 text-sm text-gray-700">
          <span class="flex-1">{{ l.name }} — {{ l.quantity_g }}g</span>
          <button (click)="removeLeftover(i)" class="text-red-400 text-xs">✕</button>
        </div>
      }
      <div class="flex gap-2">
        <input type="text" [ngModel]="leftoverName()" (ngModelChange)="leftoverName.set($event)"
          [placeholder]="'cooklog.leftover_name' | translate"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
        <input type="number" [ngModel]="leftoverQty()" (ngModelChange)="leftoverQty.set(+$event)"
          class="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
        <span class="self-center text-sm text-gray-500">g</span>
        <button (click)="addLeftover()" class="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm">+</button>
      </div>
    </section>

    @if (error()) {
      <p class="text-red-600 text-sm">{{ error() }}</p>
    }

    <button (click)="save()" [disabled]="saving()"
      class="bg-primary text-white rounded-lg py-4 font-bold text-lg disabled:opacity-50">
      {{ saving() ? ('cooklog.saving' | translate) : ('cooklog.save' | translate) }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/cook-log/post-cook-flow/
git commit -m "feat(cook-log): add PostCookFlowComponent — ratings, combo, leftovers, deduction"
```

---

### Task 4: Wire post-cook flow into recipe detail

**Files:**
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.ts`
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.html` (add button and overlay)

- [ ] **Step 1: Add `finishedCooking` signal and import to recipe detail**

In `recipe-detail.component.ts`, add:

```typescript
import { PostCookFlowComponent } from '../../cook-log/post-cook-flow/post-cook-flow.component';

// Inside the component class:
finishedCooking = signal(false);
```

Add `PostCookFlowComponent` to the `imports` array of `@Component`.

- [ ] **Step 2: Add "I cooked this" button and overlay to the recipe detail template**

At the bottom of the recipe detail template, before the closing `</div>`, add:

```html
<button (click)="finishedCooking.set(true)"
  class="w-full bg-primary text-white rounded-xl py-4 font-bold text-lg mt-6">
  {{ 'recipe.i_cooked_this' | translate }}
</button>

@if (finishedCooking() && recipe()) {
  <app-post-cook-flow
    [recipe]="recipe()!"
    (done)="finishedCooking.set(false)" />
}
```

- [ ] **Step 3: Add i18n key** to both JSON files:
```json
"recipe": { "i_cooked_this": "Terminé de cocinar" }   // es
"recipe": { "i_cooked_this": "I finished cooking" }    // en
```

- [ ] **Step 4: Build and verify**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add src/app/features/recipes/recipe-detail/ public/assets/i18n/
git commit -m "feat(recipe-detail): wire PostCookFlow on 'I finished cooking'"
```

---

### Task 5: Techniques page — list + add form

**Files:**
- Modify: `src/app/features/techniques/techniques-page/techniques-page.component.ts`
- Create: `src/app/features/techniques/techniques-page/techniques-page.component.html`

- [ ] **Step 1: Implement the techniques page**

```typescript
// src/app/features/techniques/techniques-page/techniques-page.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Technique, MasteryGrade, MASTERY_COLOR } from '../technique.model';
import { TechniqueService, AddTechniqueInput } from '../technique.service';

// Add this to technique.model.ts in the same commit:
// export const MASTERY_COLOR: Record<MasteryGrade, string> = {
//   'A+': 'text-green-700', 'A': 'text-green-600', 'A-': 'text-green-500',
//   'B+': 'text-blue-600', 'B': 'text-blue-500', 'B-': 'text-blue-400',
//   'C+': 'text-yellow-600', 'C': 'text-yellow-500', 'C-': 'text-yellow-400',
//   'D': 'text-orange-500', 'F': 'text-red-500',
// };

@Component({
  selector: 'app-techniques-page',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './techniques-page.component.html',
})
export class TechniquesPageComponent implements OnInit {
  techniques = signal<Technique[]>([]);
  loading = signal(true);
  showForm = signal(false);

  // form fields
  newName = signal('');
  newSkillLevel = signal<'beginner' | 'intermediate' | 'advanced'>('beginner');
  newEquipment = signal('');
  saving = signal(false);
  formError = signal<string | null>(null);

  constructor(private techniqueService: TechniqueService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.techniques.set(await this.techniqueService.getTechniques());
    this.loading.set(false);
  }

  async addTechnique(): Promise<void> {
    if (!this.newName().trim()) return;
    this.saving.set(true);
    this.formError.set(null);
    try {
      const input: AddTechniqueInput = {
        name: this.newName().trim(),
        skill_level: this.newSkillLevel(),
        equipment: this.newEquipment().split(',').map(s => s.trim()).filter(Boolean),
        base_steps: [],
      };
      await this.techniqueService.addTechnique(input);
      this.newName.set('');
      this.newEquipment.set('');
      this.showForm.set(false);
      await this.load();
    } catch (e: any) {
      this.formError.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTechnique(id: string): Promise<void> {
    await this.techniqueService.deleteTechnique(id);
    await this.load();
  }
}
```

- [ ] **Step 2: Add `MASTERY_COLOR` export to `technique.model.ts`**

```typescript
// append to technique.model.ts
export const MASTERY_COLOR: Record<MasteryGrade, string> = {
  'A+': 'text-green-700', 'A': 'text-green-600', 'A-': 'text-green-500',
  'B+': 'text-blue-600', 'B': 'text-blue-500', 'B-': 'text-blue-400',
  'C+': 'text-yellow-600', 'C': 'text-yellow-500', 'C-': 'text-yellow-400',
  'D': 'text-orange-500', 'F': 'text-red-500',
};
```

- [ ] **Step 3: Create template**

```html
<!-- src/app/features/techniques/techniques-page/techniques-page.component.html -->
<div class="p-4 pb-24">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold text-gray-900">{{ 'techniques.title' | translate }}</h1>
    <button (click)="showForm.set(!showForm())"
      class="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-light shadow">
      +
    </button>
  </div>

  @if (showForm()) {
    <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex flex-col gap-3">
      <input type="text" [ngModel]="newName()" (ngModelChange)="newName.set($event)"
        [placeholder]="'techniques.name_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />

      <select [ngModel]="newSkillLevel()" (ngModelChange)="newSkillLevel.set($event)"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none">
        <option value="beginner">{{ 'techniques.beginner' | translate }}</option>
        <option value="intermediate">{{ 'techniques.intermediate' | translate }}</option>
        <option value="advanced">{{ 'techniques.advanced' | translate }}</option>
      </select>

      <input type="text" [ngModel]="newEquipment()" (ngModelChange)="newEquipment.set($event)"
        [placeholder]="'techniques.equipment_placeholder' | translate"
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />

      @if (formError()) { <p class="text-red-600 text-xs">{{ formError() }}</p> }

      <button (click)="addTechnique()" [disabled]="saving()"
        class="bg-primary text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {{ 'techniques.save' | translate }}
      </button>
    </div>
  }

  @if (loading()) {
    <p class="text-gray-400 text-center py-12">{{ 'techniques.loading' | translate }}</p>
  } @else if (techniques().length === 0) {
    <p class="text-gray-400 text-center py-16">{{ 'techniques.empty' | translate }}</p>
  } @else {
    <div class="flex flex-col gap-3">
      @for (t of techniques(); track t.id) {
        <div class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-900">{{ t.name }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ t.skill_level }}</p>
          </div>
          <button (click)="deleteTechnique(t.id)" class="text-red-300 p-1">✕</button>
        </div>
      }
    </div>
  }
</div>
```

- [ ] **Step 4: Add i18n keys**

In `es.json` `"techniques"` section:
```json
"techniques": {
  "title": "Técnicas",
  "name_placeholder": "Ej. Salteado, Sushi, Tagine",
  "equipment_placeholder": "Equipamiento (ej. wok, cuchillo)",
  "beginner": "Principiante",
  "intermediate": "Intermedio",
  "advanced": "Avanzado",
  "save": "Guardar técnica",
  "loading": "Cargando…",
  "empty": "Aún no tienes técnicas. ¡Añade la primera!",
  "mastery": "Maestría"
}
```

Mirror in `en.json`.

- [ ] **Step 5: Build, test, commit, push**

```bash
npx ng build --configuration=development 2>&1 | tail -5
npm test -- --no-coverage 2>&1 | tail -10
git add src/app/features/techniques/ src/app/features/cook-log/ public/assets/i18n/
git commit -m "feat(techniques): techniques list + add form; cooklog i18n keys"
git push
```
