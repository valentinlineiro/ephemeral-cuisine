# v2 Phase 2-A: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new database tables, restructure navigation to 5 v2 tabs, expand Settings with dietary profile + equipment + family members, and create stub pages for new routes.

**Architecture:** New tables (dietary_profiles, inventory_items, techniques, cooked_versions) are added via a single migration with RLS. Navigation changes from 3 tabs (Recipes, Import, Settings) to 5 tabs (Tonight, Ranking, Inventory, Técnicas, Ajustes). Existing `/recipes` and `/import` routes remain but move off main nav. Settings grows to 4 sections: Dietary profile, Equipment grid, Family members, Account.

**Tech Stack:** Angular 18 standalone components, signals, Supabase, Tailwind CSS, ngx-translate (TranslatePipe), Jest.

**Execution order:** This plan (2-A) must complete before 2-B, 2-C, 2-D, or 2-E.

---

### Task 1: Database migration — 4 new tables

**Files:**
- Create: `supabase/migrations/20260617000004_v2_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- dietary_profiles: one row per user, stores health targets + equipment + family
CREATE TABLE dietary_profiles (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_sodium_mg    integer NOT NULL DEFAULT 1500,
  calorie_target   integer NOT NULL DEFAULT 2200,
  protein_target_g integer NOT NULL DEFAULT 120,
  equipment        text[]  NOT NULL DEFAULT '{}',
  family_members   jsonb   NOT NULL DEFAULT '[]',
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dietary_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dietary_profile" ON dietary_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- inventory_items: what the user currently has at home
CREATE TABLE inventory_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit        text NOT NULL DEFAULT 'ud',
  expiry_date date,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_inventory" ON inventory_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- techniques: reusable cooking procedures the user knows
CREATE TABLE techniques (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  base_steps  jsonb NOT NULL DEFAULT '[]',
  equipment   text[] NOT NULL DEFAULT '{}',
  skill_level text NOT NULL DEFAULT 'beginner',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_techniques" ON techniques
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cooked_versions: one row per cook session (technique + ingredient combo used + ratings)
CREATE TABLE cooked_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id      uuid REFERENCES recipes(id) ON DELETE SET NULL,
  technique_id   uuid REFERENCES techniques(id) ON DELETE SET NULL,
  cooked_at      timestamptz NOT NULL DEFAULT now(),
  combo          jsonb NOT NULL DEFAULT '{}',
  ratings        jsonb NOT NULL DEFAULT '{}',
  notes          text,
  modifications  text[] NOT NULL DEFAULT '{}',
  nutrition      jsonb,
  family_present text[] NOT NULL DEFAULT '{}',
  leftovers      jsonb
);
ALTER TABLE cooked_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cook_log" ON cooked_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Push migration locally**

```bash
npx supabase db push
```

Expected: `Finished supabase db push.` (or `No migrations to push` if already applied)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260617000004_v2_schema.sql
git commit -m "feat(db): add v2 tables — dietary_profiles, inventory_items, techniques, cooked_versions"
```

---

### Task 2: TypeScript models

**Files:**
- Create: `src/app/core/models/dietary-profile.model.ts`
- Create: `src/app/features/inventory/inventory.model.ts`
- Create: `src/app/features/techniques/technique.model.ts`
- Create: `src/app/features/cook-log/cook-log.model.ts`

- [ ] **Step 1: Create dietary-profile model**

```typescript
// src/app/core/models/dietary-profile.model.ts
export interface FamilyMember {
  name: string;
  restrictions: Array<'gluten_free' | 'lactose_free'>;
  dislikes: string[];
}

export interface DietaryProfile {
  user_id: string;
  max_sodium_mg: number;
  calorie_target: number;
  protein_target_g: number;
  equipment: string[];
  family_members: FamilyMember[];
  updated_at: string;
}

export const EQUIPMENT_KEYS = [
  'oven', 'microwave', 'air_fryer', 'hand_mixer', 'stand_mixer',
  'bamboo_mat', 'sharp_knife', 'food_processor', 'blender',
  'pressure_cooker', 'slow_cooker', 'wok', 'cast_iron',
] as const;

export type EquipmentKey = typeof EQUIPMENT_KEYS[number];
```

- [ ] **Step 2: Create inventory model**

```typescript
// src/app/features/inventory/inventory.model.ts
export type InventoryCategory = 'protein' | 'produce' | 'dairy' | 'pantry' | 'spice' | 'other';

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  category: InventoryCategory | null;
  created_at: string;
  updated_at: string;
}

export type ExpiryStatus = 'expired' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'none';

export function getExpiryStatus(expiry_date: string | null): ExpiryStatus {
  if (!expiry_date) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiry_date);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'expired';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'this_week';
  return 'later';
}
```

- [ ] **Step 3: Create technique model**

```typescript
// src/app/features/techniques/technique.model.ts
export interface TechniqueStep {
  order: number;
  text: string;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type MasteryGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export interface Technique {
  id: string;
  user_id: string;
  name: string;
  base_steps: TechniqueStep[];
  equipment: string[];
  skill_level: SkillLevel;
  created_at: string;
}

export interface TechniqueWithStats extends Technique {
  cook_count: number;
  avg_rating: number;
  mastery: MasteryGrade;
}

export function calcMastery(cook_count: number, avg_rating: number): MasteryGrade {
  if (cook_count === 0) return 'F';
  if (cook_count < 2) return 'D';
  if (cook_count < 5) {
    if (avg_rating >= 8) return 'C+';
    if (avg_rating >= 6) return 'C';
    return 'C-';
  }
  if (cook_count < 10) {
    if (avg_rating >= 9) return 'B+';
    if (avg_rating >= 7) return 'B';
    return 'B-';
  }
  if (avg_rating >= 9.5) return 'A+';
  if (avg_rating >= 8.5) return 'A';
  return 'A-';
}
```

- [ ] **Step 4: Create cook-log model**

```typescript
// src/app/features/cook-log/cook-log.model.ts
export interface Combo {
  protein: string;
  produce: string[];
  seasoning: string;
}

export interface Nutrition {
  calories?: number;
  sodium_mg?: number;
  protein_g?: number;
}

export interface LeftoverItem {
  name: string;
  quantity_g: number;
}

export interface CookedVersion {
  id: string;
  user_id: string;
  recipe_id: string | null;
  technique_id: string | null;
  cooked_at: string;
  combo: Combo;
  ratings: Record<string, number>;
  notes: string | null;
  modifications: string[];
  nutrition: Nutrition | null;
  family_present: string[];
  leftovers: { items: LeftoverItem[] } | null;
}

export interface CookLogInput {
  recipe_id?: string;
  technique_id?: string;
  combo: Combo;
  ratings: Record<string, number>;
  notes?: string;
  modifications?: string[];
  nutrition?: Nutrition;
  family_present: string[];
  leftovers?: { items: LeftoverItem[] };
}
```

- [ ] **Step 5: Write tests for pure functions**

```typescript
// src/app/features/inventory/inventory.model.spec.ts
import { getExpiryStatus } from './inventory.model';

describe('getExpiryStatus', () => {
  const today = () => new Date().toISOString().split('T')[0];
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };

  it('returns none when expiry_date is null', () => {
    expect(getExpiryStatus(null)).toBe('none');
  });

  it('returns expired when past', () => {
    expect(getExpiryStatus(daysFromNow(-1))).toBe('expired');
  });

  it('returns today', () => {
    expect(getExpiryStatus(today())).toBe('today');
  });

  it('returns tomorrow', () => {
    expect(getExpiryStatus(daysFromNow(1))).toBe('tomorrow');
  });

  it('returns this_week for days 2–7', () => {
    expect(getExpiryStatus(daysFromNow(5))).toBe('this_week');
  });

  it('returns later for days > 7', () => {
    expect(getExpiryStatus(daysFromNow(10))).toBe('later');
  });
});
```

```typescript
// src/app/features/techniques/technique.model.spec.ts
import { calcMastery } from './technique.model';

describe('calcMastery', () => {
  it('F for 0 cooks', () => expect(calcMastery(0, 0)).toBe('F'));
  it('D for 1 cook', () => expect(calcMastery(1, 9)).toBe('D'));
  it('C- for 2 cooks avg 5', () => expect(calcMastery(2, 5)).toBe('C-'));
  it('C for 3 cooks avg 7', () => expect(calcMastery(3, 7)).toBe('C'));
  it('C+ for 4 cooks avg 8', () => expect(calcMastery(4, 8)).toBe('C+'));
  it('B- for 6 cooks avg 5', () => expect(calcMastery(6, 5)).toBe('B-'));
  it('B for 7 cooks avg 8', () => expect(calcMastery(7, 8)).toBe('B'));
  it('B+ for 9 cooks avg 9.5', () => expect(calcMastery(9, 9.5)).toBe('B+'));
  it('A- for 10 cooks avg 8', () => expect(calcMastery(10, 8)).toBe('A-'));
  it('A for 12 cooks avg 9', () => expect(calcMastery(12, 9)).toBe('A'));
  it('A+ for 15 cooks avg 9.5', () => expect(calcMastery(15, 9.5)).toBe('A+'));
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest --testPathPattern="inventory.model|technique.model" --no-coverage
```

Expected: 17 passing tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/models/ src/app/features/inventory/inventory.model.ts src/app/features/inventory/inventory.model.spec.ts src/app/features/techniques/technique.model.ts src/app/features/techniques/technique.model.spec.ts src/app/features/cook-log/cook-log.model.ts
git commit -m "feat(models): add v2 domain models — DietaryProfile, InventoryItem, Technique, CookedVersion"
```

---

### Task 3: DietaryProfileService

**Files:**
- Create: `src/app/core/dietary-profile.service.ts`
- Create: `src/app/core/dietary-profile.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/core/dietary-profile.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { DietaryProfileService } from './dietary-profile.service';
import { SupabaseService } from './supabase.service';
import { DietaryProfile } from './models/dietary-profile.model';

const mockProfile: DietaryProfile = {
  user_id: 'u1',
  max_sodium_mg: 1500,
  calorie_target: 2200,
  protein_target_g: 120,
  equipment: ['oven', 'wok'],
  family_members: [{ name: 'Partner', restrictions: ['gluten_free', 'lactose_free'], dislikes: ['mushrooms'] }],
  updated_at: '2026-06-17T00:00:00Z',
};

function makeSupabaseMock(getResult: unknown, upsertResult: unknown) {
  return {
    client: {
      from: (_: string) => ({
        select: (_: string) => ({ maybeSingle: () => Promise.resolve(getResult) }),
        upsert: (_: unknown) => ({
          select: () => ({ single: () => Promise.resolve(upsertResult) }),
        }),
      }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
      },
    },
  };
}

describe('DietaryProfileService', () => {
  function setup(getResult: unknown, upsertResult: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        DietaryProfileService,
        { provide: SupabaseService, useValue: makeSupabaseMock(getResult, upsertResult) },
      ],
    });
    return TestBed.inject(DietaryProfileService);
  }

  it('getProfile returns null when no row exists', async () => {
    const svc = setup({ data: null, error: null });
    expect(await svc.getProfile()).toBeNull();
  });

  it('getProfile returns profile when row exists', async () => {
    const svc = setup({ data: mockProfile, error: null });
    const result = await svc.getProfile();
    expect(result?.max_sodium_mg).toBe(1500);
    expect(result?.equipment).toContain('oven');
  });

  it('getProfile throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db error') });
    await expect(svc.getProfile()).rejects.toThrow('db error');
  });

  it('upsertProfile merges user_id and returns saved row', async () => {
    const svc = setup({ data: null, error: null }, { data: mockProfile, error: null });
    const result = await svc.upsertProfile({ max_sodium_mg: 1500 });
    expect(result.user_id).toBe('u1');
  });

  it('upsertProfile throws on error', async () => {
    const svc = setup({ data: null, error: null }, { data: null, error: new Error('write error') });
    await expect(svc.upsertProfile({ max_sodium_mg: 1500 })).rejects.toThrow('write error');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="dietary-profile.service" --no-coverage
```

Expected: FAIL — `Cannot find module './dietary-profile.service'`

- [ ] **Step 3: Implement the service**

```typescript
// src/app/core/dietary-profile.service.ts
import { Injectable } from '@angular/core';
import { DietaryProfile } from './models/dietary-profile.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DietaryProfileService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(): Promise<DietaryProfile | null> {
    const { data, error } = await this.supabase.client
      .from('dietary_profiles')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertProfile(updates: Partial<Omit<DietaryProfile, 'user_id' | 'updated_at'>>): Promise<DietaryProfile> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    const { data, error } = await this.supabase.client
      .from('dietary_profiles')
      .upsert({ user_id: user!.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
npx jest --testPathPattern="dietary-profile.service" --no-coverage
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/dietary-profile.service.ts src/app/core/dietary-profile.service.spec.ts
git commit -m "feat(core): add DietaryProfileService with upsert and read"
```

---

### Task 4: Navigation restructure — 5 tabs

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.component.ts`
- Modify: `src/app/app.component.html`

- [ ] **Step 1: Update routes**

Replace the full content of `src/app/app.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'auth/callback', loadComponent: () => import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // v2 main tabs
      { path: 'tonight', loadComponent: () => import('./features/tonight/tonight-page.component').then(m => m.TonightPageComponent) },
      { path: 'ranking', loadComponent: () => import('./features/ranking/ranking-page.component').then(m => m.RankingPageComponent) },
      { path: 'inventory', loadComponent: () => import('./features/inventory/inventory-page/inventory-page.component').then(m => m.InventoryPageComponent) },
      { path: 'techniques', loadComponent: () => import('./features/techniques/techniques-page/techniques-page.component').then(m => m.TechniquesPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent) },
      // v1 routes kept but off main nav
      { path: 'recipes', loadComponent: () => import('./features/recipes/recipes-page/recipes-page.component').then(m => m.RecipesPageComponent) },
      { path: 'recipes/:id', loadComponent: () => import('./features/recipes/recipe-detail/recipe-detail.component').then(m => m.RecipeDetailComponent) },
      { path: 'import', loadComponent: () => import('./features/import/import-page/import-page.component').then(m => m.ImportPageComponent) },
      { path: '', redirectTo: 'tonight', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'tonight' },
];
```

- [ ] **Step 2: Update app.component.ts**

```typescript
// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(private translate: TranslateService, protected auth: AuthService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('lang') ?? 'es';
    this.translate.use(saved);
  }
}
```

- [ ] **Step 3: Update app.component.html**

```html
<div class="flex flex-col min-h-screen">
  <main class="flex-1 overflow-auto pb-16">
    <router-outlet />
  </main>

  @if (auth.session()) {
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      <!-- Tonight -->
      <a routerLink="/tonight" routerLinkActive="text-primary" class="flex flex-col items-center flex-1 py-2 text-gray-400 text-xs gap-0.5">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.715 15.15A6.5 6.5 0 0 1 9 6.035C6.106 6.82 4 9.418 4 12.5a8.5 8.5 0 0 0 8.5 8.5c3.178 0 5.803-1.867 7.043-4.666l-1.829-1.184Z"/>
        </svg>
        <span>{{ 'nav.tonight' | translate }}</span>
      </a>

      <!-- Ranking -->
      <a routerLink="/ranking" routerLinkActive="text-primary" class="flex flex-col items-center flex-1 py-2 text-gray-400 text-xs gap-0.5">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>
        </svg>
        <span>{{ 'nav.ranking' | translate }}</span>
      </a>

      <!-- Inventory -->
      <a routerLink="/inventory" routerLinkActive="text-primary" class="flex flex-col items-center flex-1 py-2 text-gray-400 text-xs gap-0.5">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"/>
        </svg>
        <span>{{ 'nav.inventory' | translate }}</span>
      </a>

      <!-- Técnicas -->
      <a routerLink="/techniques" routerLinkActive="text-primary" class="flex flex-col items-center flex-1 py-2 text-gray-400 text-xs gap-0.5">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248Z"/>
        </svg>
        <span>{{ 'nav.techniques' | translate }}</span>
      </a>

      <!-- Ajustes -->
      <a routerLink="/settings" routerLinkActive="text-primary" class="flex flex-col items-center flex-1 py-2 text-gray-400 text-xs gap-0.5">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.855 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clip-rule="evenodd"/>
        </svg>
        <span>{{ 'nav.settings' | translate }}</span>
      </a>
    </nav>
  }
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts src/app/app.component.ts src/app/app.component.html
git commit -m "feat(nav): restructure to 5 v2 tabs — Tonight, Ranking, Inventory, Técnicas, Ajustes"
```

---

### Task 5: Stub pages — Tonight, Ranking, Inventory, Técnicas

**Files:**
- Create: `src/app/features/tonight/tonight-page.component.ts`
- Create: `src/app/features/ranking/ranking-page.component.ts`
- Create: `src/app/features/inventory/inventory-page/inventory-page.component.ts`
- Create: `src/app/features/techniques/techniques-page/techniques-page.component.ts`

These are placeholder pages so the app compiles and navigation works. They will be replaced in Plans 2-B through 2-E.

- [ ] **Step 1: Tonight stub**

```typescript
// src/app/features/tonight/tonight-page.component.ts
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tonight-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'tonight.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'tonight.coming_soon' | translate }}</p>
    </div>
  `,
})
export class TonightPageComponent {}
```

- [ ] **Step 2: Ranking stub**

```typescript
// src/app/features/ranking/ranking-page.component.ts
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-ranking-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'ranking.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'ranking.coming_soon' | translate }}</p>
    </div>
  `,
})
export class RankingPageComponent {}
```

- [ ] **Step 3: Inventory stub**

```typescript
// src/app/features/inventory/inventory-page/inventory-page.component.ts
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'inventory.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'inventory.coming_soon' | translate }}</p>
    </div>
  `,
})
export class InventoryPageComponent {}
```

- [ ] **Step 4: Techniques stub**

```typescript
// src/app/features/techniques/techniques-page/techniques-page.component.ts
import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-techniques-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'techniques.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'techniques.coming_soon' | translate }}</p>
    </div>
  `,
})
export class TechniquesPageComponent {}
```

- [ ] **Step 5: Build to verify no errors**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 6: Commit**

```bash
git add src/app/features/tonight/ src/app/features/ranking/ src/app/features/inventory/inventory-page/ src/app/features/techniques/techniques-page/
git commit -m "feat(pages): add stub pages for Tonight, Ranking, Inventory, Técnicas"
```

---

### Task 6: Settings page expansion — dietary profile + equipment + family members

**Files:**
- Modify: `src/app/features/settings/settings-page.component.ts`
- Create: `src/app/features/settings/settings-page.component.html`

The settings page gains 3 new sections before the existing Language and Account sections. It loads the dietary profile on init and saves on change.

- [ ] **Step 1: Update settings component**

```typescript
// src/app/features/settings/settings-page.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { EQUIPMENT_KEYS, EquipmentKey, FamilyMember } from '../../core/models/dietary-profile.model';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent implements OnInit {
  currentLang = signal(localStorage.getItem('lang') ?? 'es');
  saving = signal(false);
  error = signal<string | null>(null);

  // dietary
  maxSodium = signal(1500);
  calorieTarget = signal(2200);
  proteinTarget = signal(120);

  // equipment
  readonly equipmentKeys = EQUIPMENT_KEYS;
  ownedEquipment = signal<Set<EquipmentKey>>(new Set());

  // family members
  familyMembers = signal<FamilyMember[]>([]);
  newMemberName = signal('');

  constructor(
    protected auth: AuthService,
    private translate: TranslateService,
    private router: Router,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.dietaryProfile.getProfile();
      if (profile) {
        this.maxSodium.set(profile.max_sodium_mg);
        this.calorieTarget.set(profile.calorie_target);
        this.proteinTarget.set(profile.protein_target_g);
        this.ownedEquipment.set(new Set(profile.equipment as EquipmentKey[]));
        this.familyMembers.set(profile.family_members);
      }
    } catch {
      // no profile yet — defaults are fine
    }
  }

  toggleEquipment(key: EquipmentKey): void {
    const current = new Set(this.ownedEquipment());
    if (current.has(key)) current.delete(key);
    else current.add(key);
    this.ownedEquipment.set(current);
  }

  hasEquipment(key: EquipmentKey): boolean {
    return this.ownedEquipment().has(key);
  }

  addFamilyMember(): void {
    const name = this.newMemberName().trim();
    if (!name) return;
    this.familyMembers.update(m => [...m, { name, restrictions: [], dislikes: [] }]);
    this.newMemberName.set('');
  }

  removeFamilyMember(index: number): void {
    this.familyMembers.update(m => m.filter((_, i) => i !== index));
  }

  toggleRestriction(index: number, restriction: 'gluten_free' | 'lactose_free'): void {
    this.familyMembers.update(members =>
      members.map((m, i) => {
        if (i !== index) return m;
        const has = m.restrictions.includes(restriction);
        return {
          ...m,
          restrictions: has
            ? m.restrictions.filter(r => r !== restriction)
            : [...m.restrictions, restriction],
        };
      })
    );
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.dietaryProfile.upsertProfile({
        max_sodium_mg: this.maxSodium(),
        calorie_target: this.calorieTarget(),
        protein_target_g: this.proteinTarget(),
        equipment: [...this.ownedEquipment()],
        family_members: this.familyMembers(),
      });
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

  switchLanguage(lang: string): void {
    this.currentLang.set(lang);
    localStorage.setItem('lang', lang);
    this.translate.use(lang);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Create settings template**

```html
<!-- src/app/features/settings/settings-page.component.html -->
<div class="p-6 pb-24 max-w-lg mx-auto flex flex-col gap-8">
  <h1 class="text-2xl font-bold text-gray-900">{{ 'settings.title' | translate }}</h1>

  <!-- DIETARY PROFILE -->
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-semibold text-gray-700 uppercase tracking-wide">{{ 'settings.dietary_title' | translate }}</h2>

    <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {{ 'settings.max_sodium' | translate }} (mg/día)
      <input type="number" [ngModel]="maxSodium()" (ngModelChange)="maxSodium.set($event)" name="sodium"
        class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-primary focus:outline-none" />
    </label>

    <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {{ 'settings.calorie_target' | translate }} (kcal)
      <input type="number" [ngModel]="calorieTarget()" (ngModelChange)="calorieTarget.set($event)" name="calories"
        class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-primary focus:outline-none" />
    </label>

    <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {{ 'settings.protein_target' | translate }} (g)
      <input type="number" [ngModel]="proteinTarget()" (ngModelChange)="proteinTarget.set($event)" name="protein"
        class="border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-primary focus:outline-none" />
    </label>
  </section>

  <!-- EQUIPMENT -->
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-semibold text-gray-700 uppercase tracking-wide">{{ 'settings.equipment_title' | translate }}</h2>
    <div class="flex flex-wrap gap-2">
      @for (key of equipmentKeys; track key) {
        <button type="button" (click)="toggleEquipment(key)"
          [class]="hasEquipment(key)
            ? 'px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white'
            : 'px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600'">
          {{ 'equipment.' + key | translate }}
        </button>
      }
    </div>
  </section>

  <!-- FAMILY MEMBERS -->
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-semibold text-gray-700 uppercase tracking-wide">{{ 'settings.family_title' | translate }}</h2>

    @for (member of familyMembers(); track member.name; let i = $index) {
      <div class="border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-medium text-gray-800">{{ member.name }}</span>
          <button (click)="removeFamilyMember(i)" class="text-red-500 text-sm">{{ 'settings.remove' | translate }}</button>
        </div>
        <div class="flex gap-3 text-sm text-gray-600">
          <label class="flex items-center gap-1">
            <input type="checkbox" [checked]="member.restrictions.includes('gluten_free')" (change)="toggleRestriction(i, 'gluten_free')" />
            {{ 'settings.gluten_free' | translate }}
          </label>
          <label class="flex items-center gap-1">
            <input type="checkbox" [checked]="member.restrictions.includes('lactose_free')" (change)="toggleRestriction(i, 'lactose_free')" />
            {{ 'settings.lactose_free' | translate }}
          </label>
        </div>
      </div>
    }

    <div class="flex gap-2">
      <input type="text" [ngModel]="newMemberName()" (ngModelChange)="newMemberName.set($event)" name="newMember"
        [placeholder]="'settings.member_name_placeholder' | translate"
        class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
      <button type="button" (click)="addFamilyMember()"
        class="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
        {{ 'settings.add_member' | translate }}
      </button>
    </div>
  </section>

  <!-- SAVE BUTTON -->
  @if (error()) {
    <p class="text-red-600 text-sm">{{ error() }}</p>
  }
  <button (click)="saveProfile()" [disabled]="saving()"
    class="bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50">
    {{ saving() ? ('settings.saving' | translate) : ('settings.save' | translate) }}
  </button>

  <!-- LANGUAGE -->
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-semibold text-gray-700 uppercase tracking-wide">{{ 'settings.language' | translate }}</h2>
    <div class="flex gap-3">
      <button (click)="switchLanguage('es')" [class]="currentLang() === 'es' ? 'px-4 py-2 rounded-lg bg-primary text-white font-medium' : 'px-4 py-2 rounded-lg bg-gray-100 text-gray-700'">
        Español
      </button>
      <button (click)="switchLanguage('en')" [class]="currentLang() === 'en' ? 'px-4 py-2 rounded-lg bg-primary text-white font-medium' : 'px-4 py-2 rounded-lg bg-gray-100 text-gray-700'">
        English
      </button>
    </div>
  </section>

  <!-- ACCOUNT -->
  <section class="flex flex-col gap-3">
    <h2 class="text-base font-semibold text-gray-700 uppercase tracking-wide">{{ 'settings.account' | translate }}</h2>
    <p class="text-sm text-gray-500">{{ auth.user()?.email }}</p>
    <button (click)="signOut()" class="text-red-600 font-medium text-sm text-left">{{ 'settings.sign_out' | translate }}</button>
  </section>
</div>
```

- [ ] **Step 3: Build to verify**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
git add src/app/features/settings/
git commit -m "feat(settings): add dietary profile, equipment grid, and family members sections"
```

---

### Task 7: i18n — all new keys

**Files:**
- Modify: `public/assets/i18n/es.json`
- Modify: `public/assets/i18n/en.json`

- [ ] **Step 1: Update es.json**

Add the following keys to the existing JSON (merge with current content):

```json
{
  "nav": {
    "tonight": "Esta noche",
    "ranking": "Ranking",
    "inventory": "Inventario",
    "techniques": "Técnicas",
    "settings": "Ajustes"
  },
  "tonight": {
    "title": "Esta noche",
    "coming_soon": "Próximamente: sugerencia basada en tu inventario"
  },
  "ranking": {
    "title": "Mis Mejores Platos",
    "coming_soon": "Próximamente: tu Hall of Fame culinario"
  },
  "inventory": {
    "title": "Inventario",
    "coming_soon": "Próximamente: gestión de tu despensa"
  },
  "techniques": {
    "title": "Técnicas",
    "coming_soon": "Próximamente: tu biblioteca de técnicas"
  },
  "settings": {
    "title": "Ajustes",
    "dietary_title": "Perfil dietético",
    "max_sodium": "Sodio máximo",
    "calorie_target": "Objetivo calórico",
    "protein_target": "Objetivo de proteína",
    "equipment_title": "Equipamiento",
    "family_title": "Familia",
    "remove": "Eliminar",
    "gluten_free": "Sin gluten",
    "lactose_free": "Sin lactosa",
    "member_name_placeholder": "Nombre (ej. Pareja)",
    "add_member": "Añadir",
    "save": "Guardar perfil",
    "saving": "Guardando…",
    "language": "Idioma",
    "account": "Cuenta",
    "sign_out": "Cerrar sesión"
  },
  "equipment": {
    "oven": "Horno",
    "microwave": "Microondas",
    "air_fryer": "Air fryer",
    "hand_mixer": "Batidora de mano",
    "stand_mixer": "Batidora de pie",
    "bamboo_mat": "Esterilla de bambú",
    "sharp_knife": "Cuchillo afilado",
    "food_processor": "Robot de cocina",
    "blender": "Licuadora",
    "pressure_cooker": "Olla a presión",
    "slow_cooker": "Slow cooker",
    "wok": "Wok",
    "cast_iron": "Hierro fundido"
  }
}
```

- [ ] **Step 2: Update en.json** with the same structure in English:

```json
{
  "nav": {
    "tonight": "Tonight",
    "ranking": "Ranking",
    "inventory": "Inventory",
    "techniques": "Techniques",
    "settings": "Settings"
  },
  "tonight": {
    "title": "Tonight",
    "coming_soon": "Coming soon: suggestion based on your inventory"
  },
  "ranking": {
    "title": "My Best Dishes",
    "coming_soon": "Coming soon: your culinary Hall of Fame"
  },
  "inventory": {
    "title": "Inventory",
    "coming_soon": "Coming soon: manage your pantry"
  },
  "techniques": {
    "title": "Techniques",
    "coming_soon": "Coming soon: your technique library"
  },
  "settings": {
    "title": "Settings",
    "dietary_title": "Dietary profile",
    "max_sodium": "Max sodium",
    "calorie_target": "Calorie target",
    "protein_target": "Protein target",
    "equipment_title": "Equipment",
    "family_title": "Family",
    "remove": "Remove",
    "gluten_free": "Gluten-free",
    "lactose_free": "Lactose-free",
    "member_name_placeholder": "Name (e.g. Partner)",
    "add_member": "Add",
    "save": "Save profile",
    "saving": "Saving…",
    "language": "Language",
    "account": "Account",
    "sign_out": "Sign out"
  },
  "equipment": {
    "oven": "Oven",
    "microwave": "Microwave",
    "air_fryer": "Air fryer",
    "hand_mixer": "Hand mixer",
    "stand_mixer": "Stand mixer",
    "bamboo_mat": "Bamboo mat",
    "sharp_knife": "Sharp knife",
    "food_processor": "Food processor",
    "blender": "Blender",
    "pressure_cooker": "Pressure cooker",
    "slow_cooker": "Slow cooker",
    "wok": "Wok",
    "cast_iron": "Cast iron"
  }
}
```

> **Note:** The old `"nav"` section had `"recipes"`, `"import"`, `"settings"` — keep `"settings"` and remove `"recipes"` and `"import"` since those tabs no longer exist in the main nav. Add all the new keys above, merging with all existing keys not shown here.

- [ ] **Step 3: Final build + full test run**

```bash
npx ng build --configuration=development 2>&1 | tail -5
npm test -- --no-coverage 2>&1 | tail -10
```

Expected: build complete, all tests passing.

- [ ] **Step 4: Final commit and push**

```bash
git add public/assets/i18n/
git commit -m "feat(i18n): add v2 translation keys for all new screens and equipment"
git push
```

---

## Self-Review Checklist

**Spec coverage (against ephemeral-cuisine-design.md §9):**
- [x] `dietary_profiles` table with `max_sodium_mg`, `calorie_target`, `protein_target_g`, `equipment[]`, `family_members jsonb`
- [x] `inventory_items` table
- [x] `techniques` table with `base_steps`, `equipment[]`, `skill_level`
- [x] `cooked_versions` table with `combo`, `ratings`, `modifications`, `family_present`, `leftovers`
- [x] RLS on all 4 tables
- [x] Navigation restructured to 5 v2 tabs (§7.1)
- [x] Settings has dietary targets, equipment, family members (§7.1 Ajustes)
- [x] `calcMastery()` pure function (used in Plan 2-C)
- [x] `getExpiryStatus()` pure function (used in Plan 2-B)
- [x] `EQUIPMENT_KEYS` constant (used in settings and suggestion engine)

**What Plan 2-A does NOT cover (handled in later plans):**
- Inventory CRUD UI (Plan 2-B)
- Technique CRUD + mastery display (Plan 2-C)
- Post-cook flow (Plan 2-C)
- Tonight suggestion engine (Plan 2-D)
- Hall of Fame / Ranking (Plan 2-E)
