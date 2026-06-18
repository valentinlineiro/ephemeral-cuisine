# v2 Phase 2-D: Tonight Screen (Suggestion Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tonight screen — a constraint-based engine that outputs one dish recommendation, with expiry alerts, equipment gap warnings, and GF/DF substitution preview. User can say "Not tonight" to see alternatives.

**Architecture:** `SuggestionService` runs entirely client-side — it loads recipes, inventory, cooked history, and dietary profile, then scores each recipe by: expiry urgency of matched inventory, novelty (never cooked this combo), dietary safety, and equipment availability. Output is a ranked list; the UI shows rank 1 and lets the user flip through alternatives. GF/DF substitution is a lookup table applied when the partner is present.

**Tech Stack:** Angular 18 signals, Supabase (data loading only — no server-side scoring), Tailwind, TranslatePipe.

**Prerequisite:** Plans 2-A, 2-B, 2-C complete (all data exists).

---

### Task 1: Substitution rules

**Files:**
- Create: `src/app/features/tonight/substitutions.ts`
- Create: `src/app/features/tonight/substitutions.spec.ts`

The substitution map is a static lookup: ingredient → GF/DF-safe alternative.

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/tonight/substitutions.spec.ts
import { applySubstitutions } from './substitutions';

describe('applySubstitutions', () => {
  it('replaces soy sauce with tamari when gluten_free', () => {
    const result = applySubstitutions(['soy sauce', 'garlic'], { gluten_free: true, lactose_free: false });
    expect(result).toContain('tamari');
    expect(result).not.toContain('soy sauce');
  });

  it('replaces cream with cashew cream when lactose_free', () => {
    const result = applySubstitutions(['cream', 'onion'], { gluten_free: false, lactose_free: true });
    expect(result).toContain('cashew cream');
    expect(result).not.toContain('cream');
  });

  it('replaces flour tortilla with corn tortilla when gluten_free', () => {
    const result = applySubstitutions(['flour tortilla'], { gluten_free: true, lactose_free: false });
    expect(result).toContain('corn tortilla');
  });

  it('leaves non-restricted ingredients unchanged', () => {
    const result = applySubstitutions(['chicken', 'onion'], { gluten_free: false, lactose_free: false });
    expect(result).toEqual(['chicken', 'onion']);
  });

  it('handles empty list', () => {
    expect(applySubstitutions([], { gluten_free: true, lactose_free: true })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="substitutions" --no-coverage
```

Expected: FAIL — `Cannot find module './substitutions'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/tonight/substitutions.ts

interface DietaryFlags {
  gluten_free: boolean;
  lactose_free: boolean;
}

// Each entry: [original, substitute, restriction that triggers it]
const SUBSTITUTION_RULES: Array<[string, string, keyof DietaryFlags]> = [
  ['soy sauce', 'tamari', 'gluten_free'],
  ['flour tortilla', 'corn tortilla', 'gluten_free'],
  ['wheat flour', 'rice flour', 'gluten_free'],
  ['bread crumbs', 'gluten-free bread crumbs', 'gluten_free'],
  ['pasta', 'rice pasta', 'gluten_free'],
  ['cream', 'cashew cream', 'lactose_free'],
  ['butter', 'coconut oil', 'lactose_free'],
  ['milk', 'oat milk', 'lactose_free'],
  ['parmesan', 'nutritional yeast', 'lactose_free'],
  ['yogurt', 'coconut yogurt', 'lactose_free'],
  ['cheese', 'vegan cheese', 'lactose_free'],
];

export function applySubstitutions(ingredients: string[], flags: DietaryFlags): string[] {
  return ingredients.map(ingredient => {
    const lower = ingredient.toLowerCase();
    for (const [original, substitute, flag] of SUBSTITUTION_RULES) {
      if (flags[flag] && lower.includes(original)) {
        return ingredient.replace(new RegExp(original, 'i'), substitute);
      }
    }
    return ingredient;
  });
}

export function needsSubstitution(ingredients: string[], flags: DietaryFlags): boolean {
  return ingredients.some(ingredient => {
    const lower = ingredient.toLowerCase();
    return SUBSTITUTION_RULES.some(([original, , flag]) => flags[flag] && lower.includes(original));
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="substitutions" --no-coverage
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tonight/substitutions.ts src/app/features/tonight/substitutions.spec.ts
git commit -m "feat(tonight): add GF/DF substitution rules and applySubstitutions"
```

---

### Task 2: SuggestionService — scoring engine

**Files:**
- Create: `src/app/features/tonight/suggestion.service.ts`
- Create: `src/app/features/tonight/suggestion.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/tonight/suggestion.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { Recipe } from '../recipes/models/recipe.model';
import { InventoryItem } from '../inventory/inventory.model';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const recipe: Recipe = {
  id: 'r1', user_id: 'u1', name: 'Chicken Tagine',
  ingredients: [{ name: 'chicken', qty: 2, unit: 'ud' }, { name: 'cilantro', qty: 1, unit: 'bundle' }],
  steps: [], tags: [], allergens: [], equipment: ['oven'],
  cuisine_type: null, difficulty: 'medium', prep_time: 10, cook_time: 40, servings: 2, language: 'es',
} as any;

const inventory: InventoryItem[] = [
  { id: 'i1', user_id: 'u1', name: 'chicken', quantity: 4, unit: 'ud', expiry_date: daysFromNow(2), category: 'protein', created_at: '', updated_at: '' },
  { id: 'i2', user_id: 'u1', name: 'cilantro', quantity: 1, unit: 'bundle', expiry_date: daysFromNow(1), category: 'produce', created_at: '', updated_at: '' },
];

const profile: DietaryProfile = {
  user_id: 'u1', max_sodium_mg: 1500, calorie_target: 2200, protein_target_g: 120,
  equipment: ['oven', 'wok'], family_members: [], updated_at: '',
};

function makeClient(recipes: unknown, cooks: unknown, inv: unknown) {
  return {
    from: (table: string) => {
      if (table === 'recipes') return { select: () => ({ order: () => Promise.resolve({ data: recipes, error: null }) }) };
      if (table === 'cooked_versions') return { select: () => ({ order: () => Promise.resolve({ data: cooks, error: null }) }) };
      if (table === 'inventory_items') return { select: () => ({ order: () => Promise.resolve({ data: inv, error: null }) }) };
      return {};
    },
  };
}

describe('SuggestionService', () => {
  function setup(recipes: unknown, cooks: unknown, inv: unknown, prof: DietaryProfile | null = profile) {
    TestBed.configureTestingModule({
      providers: [
        SuggestionService,
        { provide: SupabaseService, useValue: { client: makeClient(recipes, cooks, inv) } },
        { provide: DietaryProfileService, useValue: { getProfile: () => Promise.resolve(prof) } },
      ],
    });
    return TestBed.inject(SuggestionService);
  }

  it('returns empty array when no recipes', async () => {
    const svc = setup([], [], []);
    expect(await svc.getSuggestions()).toHaveLength(0);
  });

  it('scores recipe higher when inventory contains expiring ingredients', async () => {
    const svc = setup([recipe], [], inventory);
    const suggestions = await svc.getSuggestions();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].recipe.id).toBe('r1');
    expect(suggestions[0].expiryScore).toBeGreaterThan(0);
  });

  it('marks recipe as equipment missing when user lacks required equipment', async () => {
    const noOvenProfile: DietaryProfile = { ...profile, equipment: ['wok'] };
    const svc = setup([recipe], [], inventory, noOvenProfile);
    const suggestions = await svc.getSuggestions();
    expect(suggestions[0].missingEquipment).toContain('oven');
  });

  it('marks recipe as novel when combo never cooked', async () => {
    const svc = setup([recipe], [], inventory);
    const suggestions = await svc.getSuggestions();
    expect(suggestions[0].isNovel).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="suggestion.service" --no-coverage
```

Expected: FAIL — `Cannot find module './suggestion.service'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/tonight/suggestion.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { Recipe } from '../recipes/models/recipe.model';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { CookedVersion } from '../cook-log/cook-log.model';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  expiryScore: number;
  isNovel: boolean;
  missingEquipment: string[];
  matchedInventoryItems: InventoryItem[];
  substitutions: string[];
}

const EXPIRY_WEIGHTS: Record<string, number> = {
  expired: 10, today: 8, tomorrow: 5, this_week: 2, later: 0, none: 0,
};

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  constructor(
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async getSuggestions(): Promise<ScoredRecipe[]> {
    const [recipesRes, cooksRes, invRes, profile] = await Promise.all([
      this.supabase.client.from('recipes').select('*').order('name', { ascending: true }),
      this.supabase.client.from('cooked_versions').select('*').order('cooked_at', { ascending: false }),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
      this.dietaryProfile.getProfile().catch(() => null),
    ]);

    const recipes: Recipe[] = recipesRes.data ?? [];
    const cooks: CookedVersion[] = cooksRes.data ?? [];
    const inventory: InventoryItem[] = invRes.data ?? [];

    if (recipes.length === 0) return [];

    const usedCombos = new Set(cooks.map(c => `${c.recipe_id}:${c.combo.protein}:${(c.combo.produce ?? []).sort().join(',')}`));
    const ownedEquipment = new Set(profile?.equipment ?? []);

    return recipes
      .map(recipe => this.scoreRecipe(recipe, inventory, usedCombos, ownedEquipment, profile))
      .sort((a, b) => b.score - a.score);
  }

  private scoreRecipe(
    recipe: Recipe,
    inventory: InventoryItem[],
    usedCombos: Set<string>,
    ownedEquipment: Set<string>,
    profile: DietaryProfile | null,
  ): ScoredRecipe {
    const ingredientNames = (recipe.ingredients ?? []).map((i: any) => i.name.toLowerCase());
    const inventoryNames = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

    // Match inventory items to recipe ingredients
    const matchedInventoryItems = inventory.filter(inv =>
      ingredientNames.some(name => inv.name.toLowerCase().includes(name) || name.includes(inv.name.toLowerCase()))
    );

    // Expiry score: sum of urgency weights of matched items
    const expiryScore = matchedInventoryItems.reduce((sum, item) => {
      return sum + (EXPIRY_WEIGHTS[getExpiryStatus(item.expiry_date)] ?? 0);
    }, 0);

    // Novelty: combo key from first matched protein and produce
    const protein = matchedInventoryItems.find(i => i.category === 'protein')?.name ?? '';
    const produce = matchedInventoryItems.filter(i => i.category === 'produce').map(i => i.name).sort();
    const comboKey = `${recipe.id}:${protein}:${produce.join(',')}`;
    const isNovel = !usedCombos.has(comboKey);

    // Equipment gap
    const requiredEquipment: string[] = (recipe as any).equipment ?? [];
    const missingEquipment = requiredEquipment.filter(e => !ownedEquipment.has(e));

    // Substitutions needed for partner
    const partnerRestrictions = profile?.family_members.find(m =>
      m.restrictions.includes('gluten_free') || m.restrictions.includes('lactose_free')
    );
    const substitutions: string[] = partnerRestrictions ? ingredientNames.filter(name =>
      (partnerRestrictions.restrictions.includes('gluten_free') && ['soy sauce', 'flour', 'bread crumbs'].some(s => name.includes(s))) ||
      (partnerRestrictions.restrictions.includes('lactose_free') && ['cream', 'butter', 'milk', 'cheese'].some(s => name.includes(s)))
    ) : [];

    const score =
      expiryScore * 3 +
      (isNovel ? 5 : 0) +
      (missingEquipment.length === 0 ? 3 : -10) +
      matchedInventoryItems.length;

    return { recipe, score, expiryScore, isNovel, missingEquipment, matchedInventoryItems, substitutions };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="suggestion.service" --no-coverage
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tonight/suggestion.service.ts src/app/features/tonight/suggestion.service.spec.ts
git commit -m "feat(tonight): add SuggestionService with expiry, novelty, equipment scoring"
```

---

### Task 3: Tonight page

**Files:**
- Modify: `src/app/features/tonight/tonight-page.component.ts`
- Create: `src/app/features/tonight/tonight-page.component.html`

- [ ] **Step 1: Implement the page**

```typescript
// src/app/features/tonight/tonight-page.component.ts
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-tonight-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './tonight-page.component.html',
})
export class TonightPageComponent implements OnInit {
  suggestions = signal<ScoredRecipe[]>([]);
  currentIndex = signal(0);
  loading = signal(true);
  expiringToday = signal<InventoryItem[]>([]);

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes] = await Promise.all([
      this.suggestionService.getSuggestions(),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
    ]);

    this.suggestions.set(suggestions.filter(s => s.missingEquipment.length === 0 || s.score > 0));
    this.expiringToday.set(
      (invRes.data ?? []).filter((i: InventoryItem) =>
        ['expired', 'today', 'tomorrow'].includes(getExpiryStatus(i.expiry_date))
      )
    );
    this.loading.set(false);
  }

  next(): void {
    this.currentIndex.update(i => Math.min(i + 1, this.suggestions().length - 1));
  }

  prev(): void {
    this.currentIndex.update(i => Math.max(i - 1, 0));
  }
}
```

- [ ] **Step 2: Create template**

```html
<!-- src/app/features/tonight/tonight-page.component.html -->
<div class="p-4 pb-24">
  <h1 class="text-2xl font-bold text-gray-900 mb-4">{{ 'tonight.title' | translate }}</h1>

  <!-- Expiry alerts -->
  @if (expiringToday().length > 0) {
    <div class="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
      @for (item of expiringToday(); track item.id) {
        <p class="text-sm text-red-700">
          🔴 <strong>{{ item.name }}</strong> —
          @if (getExpiryStatus(item.expiry_date) === 'expired') { {{ 'tonight.expired' | translate }} }
          @else if (getExpiryStatus(item.expiry_date) === 'today') { {{ 'tonight.expires_today' | translate }} }
          @else { {{ 'tonight.expires_tomorrow' | translate }} }
        </p>
      }
    </div>
  }

  @if (loading()) {
    <div class="flex items-center justify-center py-24">
      <p class="text-gray-400">{{ 'tonight.loading' | translate }}</p>
    </div>
  } @else if (!current()) {
    <div class="text-center py-16">
      <p class="text-gray-500 text-lg mb-2">{{ 'tonight.no_suggestion' | translate }}</p>
      <p class="text-gray-400 text-sm mb-6">{{ 'tonight.no_suggestion_hint' | translate }}</p>
      <a routerLink="/inventory" class="bg-primary text-white px-6 py-3 rounded-lg font-medium">
        {{ 'tonight.go_to_inventory' | translate }}
      </a>
    </div>
  } @else {
    <!-- Main suggestion card -->
    <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">
            @if (current()!.isNovel) { ✨ {{ 'tonight.new_combo' | translate }} }
            @else { {{ 'tonight.familiar' | translate }} }
          </p>
          <h2 class="text-xl font-bold text-gray-900">{{ current()!.recipe.name }}</h2>
        </div>
        @if (current()!.expiryScore > 5) {
          <span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium ml-2">
            {{ 'tonight.uses_expiring' | translate }}
          </span>
        }
      </div>

      @if (current()!.matchedInventoryItems.length > 0) {
        <p class="text-sm text-gray-600 mb-3">
          {{ 'tonight.you_have' | translate }}: {{ current()!.matchedInventoryItems.map(i => i.name).join(', ') }}
        </p>
      }

      @if (current()!.substitutions.length > 0) {
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
          🔄 {{ 'tonight.substitutions_needed' | translate }}: {{ current()!.substitutions.join(', ') }}
        </div>
      }

      @if (current()!.missingEquipment.length > 0) {
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm text-gray-600">
          ⚠️ {{ 'tonight.missing_equipment' | translate }}: {{ current()!.missingEquipment.join(', ') }}
        </div>
      }

      <div class="flex gap-3 mt-4">
        <a [routerLink]="['/recipes', current()!.recipe.id]"
          class="flex-1 bg-primary text-white rounded-xl py-3 font-bold text-center">
          {{ 'tonight.cook' | translate }}
        </a>
      </div>
    </div>

    <!-- Navigation between suggestions -->
    @if (hasAlternatives()) {
      <div class="flex items-center justify-between mt-2">
        <button (click)="prev()" [disabled]="currentIndex() === 0"
          class="text-gray-400 disabled:opacity-30 font-medium text-sm">
          ← {{ 'tonight.previous' | translate }}
        </button>
        <span class="text-xs text-gray-400">{{ currentIndex() + 1 }} / {{ suggestions().length }}</span>
        <button (click)="next()" [disabled]="currentIndex() === suggestions().length - 1"
          class="text-primary disabled:opacity-30 font-medium text-sm">
          {{ 'tonight.not_tonight' | translate }} →
        </button>
      </div>
    }
  }
</div>
```

> Note: `getExpiryStatus` must be imported and exposed to the template. Add `protected getExpiryStatus = getExpiryStatus;` to the component class.

- [ ] **Step 3: Add `protected getExpiryStatus = getExpiryStatus;` to the component class**

- [ ] **Step 4: Add i18n keys**

In `es.json` `"tonight"` section:
```json
"tonight": {
  "title": "Esta noche",
  "loading": "Calculando sugerencia…",
  "new_combo": "Combinación nueva",
  "familiar": "Ya probado",
  "uses_expiring": "Usa ingredientes que caducan",
  "you_have": "Tienes",
  "substitutions_needed": "Sustituciones para la pareja",
  "missing_equipment": "Te falta equipamiento",
  "cook": "¡Cocinar!",
  "not_tonight": "Esta noche no",
  "previous": "Anterior",
  "no_suggestion": "Sin sugerencias por ahora",
  "no_suggestion_hint": "Añade ingredientes a tu inventario para obtener sugerencias",
  "go_to_inventory": "Ir al inventario",
  "expired": "caducado",
  "expires_today": "caduca hoy",
  "expires_tomorrow": "caduca mañana"
}
```

Mirror in `en.json`.

- [ ] **Step 5: Build, test, push**

```bash
npx ng build --configuration=development 2>&1 | tail -5
npm test -- --no-coverage 2>&1 | tail -10
git add src/app/features/tonight/ public/assets/i18n/
git commit -m "feat(tonight): Tonight screen with constraint suggestion engine"
git push
```
