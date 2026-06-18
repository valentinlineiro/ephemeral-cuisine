# v2 Phase 3: Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add calorie/sodium/protein tracking with color-coded health signals throughout the app, auto-estimate nutrition from logged combos, show a weekly health summary on the Tonight screen, and add a "What if I swap X?" calculator in recipe detail.

**Architecture:** All health logic is pure functions in `src/app/features/health/` — no server-side computation. `estimateNutrition()` looks up ingredients in a static table and returns per-serving macros. Color signals (`sodiumColor`, `calorieColor`, `proteinColor`) are pure string functions returning Tailwind classes. `HealthService` queries `cooked_versions.nutrition` for the weekly summary. The post-cook flow auto-estimates nutrition and stores it in `cooked_versions.nutrition`. Recipe detail reads back avg nutrition from cook history. Tonight shows a compact weekly card below the suggestion.

**Tech Stack:** Angular 18 signals, computed(), pure TypeScript functions, Supabase (read-only for weekly summary), Tailwind CSS, TranslatePipe.

---

## File Map

**New:**
- `src/app/features/health/nutrition.ts` — `NUTRITION_TABLE`, `estimateNutrition(protein, produce, seasoning, servings)`
- `src/app/features/health/nutrition.spec.ts`
- `src/app/features/health/health-color.ts` — `sodiumColor()`, `calorieColor()`, `proteinColor()`
- `src/app/features/health/health-color.spec.ts`
- `src/app/features/health/swap-calculator.ts` — `SwapEntry`, `SWAP_TABLE`, `getSwapsFor(ingredient)`
- `src/app/features/health/swap-calculator.spec.ts`
- `src/app/features/health/health.service.ts` — `HealthService`, `WeeklySummary`, `getWeeklySummary(profile)`

**Modified:**
- `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts` — add `servings` + `profile` signals, `estimatedNutrition` computed, pass nutrition to `logCook`
- `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.html` — add nutrition estimate row with color chips, servings input
- `src/app/features/recipes/recipe-detail/recipe-detail.component.ts` — load cook history + profile, compute `avgNutrition`, add swap signals
- `src/app/features/recipes/recipe-detail/recipe-detail.component.html` — health badges section, "What if I swap?" section
- `src/app/features/tonight/tonight-page.component.ts` — load `weeklySummary` and `profile`, expose color functions
- `src/app/features/tonight/tonight-page.component.html` — weekly health card below suggestion
- `public/assets/i18n/es.json`, `en.json` — `health.*` keys

---

### Task 1: Nutrition estimation pure functions

**Files:**
- Create: `src/app/features/health/nutrition.ts`
- Create: `src/app/features/health/nutrition.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/health/nutrition.spec.ts
import { estimateNutrition } from './nutrition';

describe('estimateNutrition', () => {
  it('returns non-zero calories for a known protein', () => {
    const result = estimateNutrition('chicken', [], '', 1);
    expect(result.calories).toBeGreaterThan(0);
    expect(result.protein_g).toBeGreaterThan(0);
  });

  it('adds sodium from soy sauce seasoning', () => {
    const withSoy = estimateNutrition('chicken', [], 'soy sauce', 1);
    const withoutSoy = estimateNutrition('chicken', [], '', 1);
    expect(withSoy.sodium_mg!).toBeGreaterThan(withoutSoy.sodium_mg!);
  });

  it('divides totals by servings', () => {
    const one = estimateNutrition('chicken', [], '', 1);
    const two = estimateNutrition('chicken', [], '', 2);
    expect(two.calories!).toBeCloseTo(one.calories! / 2, 0);
  });

  it('adds produce contributions', () => {
    const withProduce = estimateNutrition('chicken', ['avocado'], '', 1);
    const without = estimateNutrition('chicken', [], '', 1);
    expect(withProduce.calories!).toBeGreaterThan(without.calories!);
  });

  it('returns zeros for unknown ingredients', () => {
    const result = estimateNutrition('xyz123', [], '', 1);
    expect(result.calories).toBe(0);
    expect(result.sodium_mg).toBe(0);
    expect(result.protein_g).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="nutrition.spec" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './nutrition'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/health/nutrition.ts
import { Nutrition } from '../cook-log/cook-log.model';

// Values are per 100g. Portions: protein ~150g, each produce ~80g, seasoning ~5g.
const NUTRITION_TABLE: Record<string, Required<Nutrition>> = {
  // Proteins
  chicken:   { calories: 165, sodium_mg: 74,   protein_g: 31 },
  pollo:     { calories: 165, sodium_mg: 74,   protein_g: 31 },
  salmon:    { calories: 208, sodium_mg: 59,   protein_g: 20 },
  beef:      { calories: 250, sodium_mg: 72,   protein_g: 26 },
  ternera:   { calories: 250, sodium_mg: 72,   protein_g: 26 },
  pork:      { calories: 242, sodium_mg: 62,   protein_g: 27 },
  cerdo:     { calories: 242, sodium_mg: 62,   protein_g: 27 },
  tofu:      { calories: 76,  sodium_mg: 7,    protein_g: 8  },
  shrimp:    { calories: 99,  sodium_mg: 111,  protein_g: 24 },
  gambas:    { calories: 99,  sodium_mg: 111,  protein_g: 24 },
  tuna:      { calories: 132, sodium_mg: 47,   protein_g: 28 },
  atun:      { calories: 132, sodium_mg: 47,   protein_g: 28 },
  egg:       { calories: 155, sodium_mg: 124,  protein_g: 13 },
  huevo:     { calories: 155, sodium_mg: 124,  protein_g: 13 },
  // Produce
  tomato:    { calories: 18,  sodium_mg: 5,    protein_g: 1  },
  tomate:    { calories: 18,  sodium_mg: 5,    protein_g: 1  },
  pepper:    { calories: 31,  sodium_mg: 4,    protein_g: 1  },
  pimiento:  { calories: 31,  sodium_mg: 4,    protein_g: 1  },
  onion:     { calories: 40,  sodium_mg: 4,    protein_g: 1  },
  cebolla:   { calories: 40,  sodium_mg: 4,    protein_g: 1  },
  spinach:   { calories: 23,  sodium_mg: 79,   protein_g: 3  },
  espinaca:  { calories: 23,  sodium_mg: 79,   protein_g: 3  },
  avocado:   { calories: 160, sodium_mg: 7,    protein_g: 2  },
  aguacate:  { calories: 160, sodium_mg: 7,    protein_g: 2  },
  mango:     { calories: 60,  sodium_mg: 1,    protein_g: 1  },
  cucumber:  { calories: 16,  sodium_mg: 2,    protein_g: 1  },
  pepino:    { calories: 16,  sodium_mg: 2,    protein_g: 1  },
  garlic:    { calories: 149, sodium_mg: 17,   protein_g: 6  },
  ajo:       { calories: 149, sodium_mg: 17,   protein_g: 6  },
  // Seasonings (used in ~5g portions)
  'soy sauce':  { calories: 53,  sodium_mg: 5493, protein_g: 8  },
  tamari:       { calories: 53,  sodium_mg: 4000, protein_g: 8  },
  salt:         { calories: 0,   sodium_mg: 38758, protein_g: 0 },
  sal:          { calories: 0,   sodium_mg: 38758, protein_g: 0 },
  miso:         { calories: 199, sodium_mg: 3728, protein_g: 12 },
};

function lookup(name: string, portionG: number): Required<Nutrition> {
  const lower = name.trim().toLowerCase();
  const key = Object.keys(NUTRITION_TABLE).find(k => lower.includes(k) || k.includes(lower));
  if (!key) return { calories: 0, sodium_mg: 0, protein_g: 0 };
  const per100 = NUTRITION_TABLE[key];
  return {
    calories:   Math.round((per100.calories   * portionG) / 100),
    sodium_mg:  Math.round((per100.sodium_mg  * portionG) / 100),
    protein_g:  Math.round((per100.protein_g  * portionG) / 100),
  };
}

function sum(a: Required<Nutrition>, b: Required<Nutrition>): Required<Nutrition> {
  return {
    calories:  a.calories  + b.calories,
    sodium_mg: a.sodium_mg + b.sodium_mg,
    protein_g: a.protein_g + b.protein_g,
  };
}

export function estimateNutrition(
  protein: string,
  produce: string[],
  seasoning: string,
  servings = 2,
): Required<Nutrition> {
  let total = lookup(protein, 150);
  for (const p of produce) total = sum(total, lookup(p, 80));
  if (seasoning) total = sum(total, lookup(seasoning, 5));
  const s = Math.max(1, servings);
  return {
    calories:  Math.round(total.calories  / s),
    sodium_mg: Math.round(total.sodium_mg / s),
    protein_g: Math.round(total.protein_g / s),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="nutrition.spec" --no-coverage 2>&1 | tail -6
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/health/nutrition.ts src/app/features/health/nutrition.spec.ts && git commit -m "feat(health): add nutrition estimation pure function with ingredient lookup table"
```

---

### Task 2: Health color utility

**Files:**
- Create: `src/app/features/health/health-color.ts`
- Create: `src/app/features/health/health-color.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/health/health-color.spec.ts
import { sodiumColor, calorieColor, proteinColor } from './health-color';

describe('sodiumColor', () => {
  // budget = 1500mg. green < 35%, yellow 35–60%, red > 60%
  it('returns green when sodium is well under budget', () => {
    expect(sodiumColor(200, 1500)).toBe('text-green-600');
  });
  it('returns yellow when sodium is approaching budget', () => {
    expect(sodiumColor(700, 1500)).toBe('text-yellow-600');
  });
  it('returns red when sodium exceeds 60% of budget', () => {
    expect(sodiumColor(1200, 1500)).toBe('text-red-600');
  });
});

describe('calorieColor', () => {
  // target = 2200. green < 40%, yellow 40–60%, red > 60%
  it('returns green when calories are well under target', () => {
    expect(calorieColor(400, 2200)).toBe('text-green-600');
  });
  it('returns yellow when calories are in the middle range', () => {
    expect(calorieColor(950, 2200)).toBe('text-yellow-600');
  });
  it('returns red when calories exceed 60% of target per meal', () => {
    expect(calorieColor(1400, 2200)).toBe('text-red-600');
  });
});

describe('proteinColor', () => {
  // target = 120g/day → per meal target = 40g. green >= 90%, yellow 50–90%, red < 50%
  it('returns green when protein meets the per-meal target', () => {
    expect(proteinColor(40, 120)).toBe('text-green-600');
  });
  it('returns yellow when protein is moderate', () => {
    expect(proteinColor(25, 120)).toBe('text-yellow-600');
  });
  it('returns red when protein is very low', () => {
    expect(proteinColor(10, 120)).toBe('text-red-600');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="health-color" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './health-color'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/health/health-color.ts
type HealthColor = 'text-green-600' | 'text-yellow-600' | 'text-red-600';

/** Sodium per meal vs daily budget. Green <35%, yellow 35–60%, red >60%. */
export function sodiumColor(sodium_mg: number, budget_mg: number): HealthColor {
  const ratio = sodium_mg / budget_mg;
  if (ratio < 0.35) return 'text-green-600';
  if (ratio < 0.60) return 'text-yellow-600';
  return 'text-red-600';
}

/** Calories per meal vs daily target. Green <40%, yellow 40–60%, red >60%. */
export function calorieColor(calories: number, target: number): HealthColor {
  const ratio = calories / target;
  if (ratio < 0.40) return 'text-green-600';
  if (ratio < 0.60) return 'text-yellow-600';
  return 'text-red-600';
}

/** Protein per meal vs daily target÷3. Green ≥90%, yellow 50–90%, red <50%. */
export function proteinColor(protein_g: number, daily_target_g: number): HealthColor {
  const mealTarget = daily_target_g / 3;
  const ratio = protein_g / mealTarget;
  if (ratio >= 0.9) return 'text-green-600';
  if (ratio >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="health-color" --no-coverage 2>&1 | tail -6
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/health/health-color.ts src/app/features/health/health-color.spec.ts && git commit -m "feat(health): add sodiumColor, calorieColor, proteinColor utility functions"
```

---

### Task 3: Swap calculator

**Files:**
- Create: `src/app/features/health/swap-calculator.ts`
- Create: `src/app/features/health/swap-calculator.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/health/swap-calculator.spec.ts
import { getSwapsFor } from './swap-calculator';

describe('getSwapsFor', () => {
  it('returns swaps when ingredient matches a known entry', () => {
    const swaps = getSwapsFor('chicken thigh');
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps[0].from).toContain('chicken');
  });

  it('returns swaps for salmon', () => {
    const swaps = getSwapsFor('salmon');
    expect(swaps.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown ingredient', () => {
    expect(getSwapsFor('durian paste')).toHaveLength(0);
  });

  it('swap entry has required fields with numeric deltas', () => {
    const swaps = getSwapsFor('chicken');
    expect(typeof swaps[0].calories_delta).toBe('number');
    expect(typeof swaps[0].sodium_delta).toBe('number');
    expect(typeof swaps[0].protein_delta).toBe('number');
    expect(typeof swaps[0].cook_time_delta).toBe('number');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="swap-calculator" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './swap-calculator'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/health/swap-calculator.ts
export interface SwapEntry {
  from: string;
  to: string;
  calories_delta: number;
  sodium_delta: number;
  protein_delta: number;
  cook_time_delta: number;
  note: string;
}

export const SWAP_TABLE: SwapEntry[] = [
  { from: 'chicken thigh', to: 'chicken breast',  calories_delta: -90,  sodium_delta: -10,   protein_delta: +4,  cook_time_delta: -5, note: 'Leaner but drier' },
  { from: 'chicken',       to: 'tofu',             calories_delta: -65,  sodium_delta: -50,   protein_delta: -17, cook_time_delta: -5, note: 'Vegan, GF/DF ✓' },
  { from: 'chicken',       to: 'shrimp',           calories_delta: -50,  sodium_delta: +30,   protein_delta: -5,  cook_time_delta: -8, note: 'Faster cook' },
  { from: 'salmon',        to: 'tuna',             calories_delta: -60,  sodium_delta: -5,    protein_delta: +6,  cook_time_delta: 0,  note: 'Higher protein' },
  { from: 'salmon',        to: 'tofu',             calories_delta: -110, sodium_delta: -40,   protein_delta: -10, cook_time_delta: -5, note: 'DF/GF ✓, vegan' },
  { from: 'beef',          to: 'chicken',          calories_delta: -85,  sodium_delta: -10,   protein_delta: +3,  cook_time_delta: -5, note: 'Lower fat' },
  { from: 'pork',          to: 'chicken',          calories_delta: -90,  sodium_delta: -20,   protein_delta: +3,  cook_time_delta: -3, note: 'Lower fat' },
  { from: 'soy sauce',     to: 'tamari',           calories_delta: 0,    sodium_delta: -1200, protein_delta: 0,   cook_time_delta: 0,  note: 'GF ✓' },
  { from: 'cream',         to: 'cashew cream',     calories_delta: -15,  sodium_delta: -5,    protein_delta: +1,  cook_time_delta: 0,  note: 'DF ✓' },
  { from: 'butter',        to: 'olive oil',        calories_delta: +20,  sodium_delta: -820,  protein_delta: 0,   cook_time_delta: 0,  note: 'DF ✓, less sodium' },
  { from: 'pasta',         to: 'rice pasta',       calories_delta: 0,    sodium_delta: 0,     protein_delta: -1,  cook_time_delta: +2, note: 'GF ✓' },
];

export function getSwapsFor(ingredient: string): SwapEntry[] {
  const lower = ingredient.toLowerCase();
  return SWAP_TABLE.filter(s => lower.includes(s.from) || s.from.includes(lower));
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="swap-calculator" --no-coverage 2>&1 | tail -6
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/health/swap-calculator.ts src/app/features/health/swap-calculator.spec.ts && git commit -m "feat(health): add swap calculator with 11 ingredient swap entries"
```

---

### Task 4: HealthService + weekly summary

**Files:**
- Create: `src/app/features/health/health.service.ts`

No TDD here — it's a thin DB-aggregation layer. Verify by build only.

- [ ] **Step 1: Create the service**

```typescript
// src/app/features/health/health.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

export interface WeeklySummary {
  avg_sodium_mg: number;
  avg_calories: number;
  protein_target_hit_days: number;
  cook_count: number;
  period_days: number;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private supabase: SupabaseService) {}

  async getWeeklySummary(profile: DietaryProfile | null): Promise<WeeklySummary> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('cooked_at, nutrition')
      .gte('cooked_at', since.toISOString());
    if (error) throw error;

    const cooks = (data ?? []).filter((c: any) => c.nutrition);
    const period_days = 7;
    const cook_count = cooks.length;

    if (cook_count === 0) {
      return { avg_sodium_mg: 0, avg_calories: 0, protein_target_hit_days: 0, cook_count: 0, period_days };
    }

    const totalSodium   = cooks.reduce((s: number, c: any) => s + (c.nutrition?.sodium_mg ?? 0), 0);
    const totalCalories = cooks.reduce((s: number, c: any) => s + (c.nutrition?.calories  ?? 0), 0);

    // Sum protein per calendar day, count days meeting target
    const byDay = new Map<string, number>();
    for (const c of cooks) {
      const day = (c.cooked_at as string).split('T')[0];
      byDay.set(day, (byDay.get(day) ?? 0) + (c.nutrition?.protein_g ?? 0));
    }
    const dailyTarget = profile?.protein_target_g ?? 120;
    const protein_target_hit_days = [...byDay.values()].filter(g => g >= dailyTarget).length;

    return {
      avg_sodium_mg: Math.round(totalSodium   / period_days),
      avg_calories:  Math.round(totalCalories / period_days),
      protein_target_hit_days,
      cook_count,
      period_days,
    };
  }
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: `Application bundle generation complete.`

- [ ] **Step 3: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/health/health.service.ts && git commit -m "feat(health): add HealthService with weekly nutrition summary"
```

---

### Task 5: Post-cook flow — nutrition estimate + logging

**Files:**
- Modify: `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts`
- Modify: `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.html`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/cook-log/post-cook-flow/post-cook-flow.component.html
```

- [ ] **Step 1: Update the component**

Replace the full `post-cook-flow.component.ts` with:

```typescript
import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../../../features/recipes/models/recipe.model';
import { CookLogService, LeftoverBlueprint } from '../cook-log.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';
import { DietaryProfile, FamilyMember } from '../../../core/models/dietary-profile.model';
import { LeftoverItem } from '../cook-log.model';
import { estimateNutrition } from '../../health/nutrition';
import { sodiumColor, calorieColor, proteinColor } from '../../health/health-color';

@Component({
  selector: 'app-post-cook-flow',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './post-cook-flow.component.html',
})
export class PostCookFlowComponent implements OnInit {
  recipe = input.required<Recipe>();
  done = output<void>();

  profile = signal<DietaryProfile | null>(null);
  familyMembers = signal<FamilyMember[]>([]);
  familyPresent = signal<string[]>([]);

  protein = signal('');
  produce = signal('');
  seasoning = signal('');
  servings = signal(2);

  selfRating = signal(7);
  familyRatings = signal<Record<string, number>>({});

  modifications = signal('');
  notes = signal('');

  leftoverName = signal('');
  leftoverQty = signal(200);
  leftovers = signal<LeftoverItem[]>([]);

  saving = signal(false);
  error = signal<string | null>(null);
  blueprint = signal<LeftoverBlueprint | null>(null);
  saved = signal(false);

  estimatedNutrition = computed(() => {
    const produceList = this.produce().split(',').map(s => s.trim()).filter(Boolean);
    return estimateNutrition(this.protein(), produceList, this.seasoning(), this.servings());
  });

  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;
  protected proteinColor = proteinColor;

  constructor(
    private cookLog: CookLogService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const p = await this.dietaryProfile.getProfile().catch(() => null);
    this.profile.set(p);
    this.familyMembers.set(p?.family_members ?? []);
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

  finish(): void {
    this.done.emit();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const ratings: Record<string, number> = { self: this.selfRating(), ...this.familyRatings() };
      const produceList = this.produce().split(',').map(s => s.trim()).filter(Boolean);
      const modsList = this.modifications().split(',').map(s => s.trim()).filter(Boolean);
      const nutrition = this.estimatedNutrition();

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
        nutrition: nutrition.calories > 0 ? nutrition : undefined,
        leftovers: this.leftovers().length ? { items: this.leftovers() } : undefined,
        inventory_deductions: [
          ...(this.protein().trim() ? [{ name: this.protein().trim(), quantity: 1 }] : []),
          ...produceList.map(p => ({ name: p, quantity: 1 })),
        ],
      });
      const bp = this.cookLog.generateLeftoverBlueprint(this.leftovers());
      this.blueprint.set(bp);
      this.saved.set(true);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 2: Update the template**

Replace the full `post-cook-flow.component.html` with:

```html
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
      <label class="flex items-center gap-2 text-sm text-gray-600">
        {{ 'cooklog.servings' | translate }}
        <input type="number" [ngModel]="servings()" (ngModelChange)="servings.set(+$event)" min="1" max="12"
          class="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
      </label>
    </section>

    <!-- NUTRITION ESTIMATE -->
    @if (estimatedNutrition().calories > 0) {
      <section class="flex gap-3">
        <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p [class]="calorieColor(estimatedNutrition().calories, profile()?.calorie_target ?? 2200) + ' font-bold text-base'">
            {{ estimatedNutrition().calories }}
          </p>
          <p class="text-xs text-gray-400">{{ 'health.calories' | translate }}</p>
        </div>
        <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p [class]="sodiumColor(estimatedNutrition().sodium_mg, profile()?.max_sodium_mg ?? 1500) + ' font-bold text-base'">
            {{ estimatedNutrition().sodium_mg }}mg
          </p>
          <p class="text-xs text-gray-400">{{ 'health.sodium' | translate }}</p>
        </div>
        <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p [class]="proteinColor(estimatedNutrition().protein_g, profile()?.protein_target_g ?? 120) + ' font-bold text-base'">
            {{ estimatedNutrition().protein_g }}g
          </p>
          <p class="text-xs text-gray-400">{{ 'health.protein' | translate }}</p>
        </div>
      </section>
    }

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

    @if (!saved()) {
      <button (click)="save()" [disabled]="saving()"
        class="bg-primary text-white rounded-lg py-4 font-bold text-lg disabled:opacity-50">
        {{ saving() ? ('cooklog.saving' | translate) : ('cooklog.save' | translate) }}
      </button>
    } @else {
      @if (blueprint()) {
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-2">
          <p class="text-sm font-semibold text-green-800">🥡 {{ 'cooklog.leftover_blueprint' | translate }}</p>
          <p class="text-green-900 font-medium">{{ blueprint()!.suggestion }}</p>
          <p class="text-sm text-green-700">+{{ blueprint()!.addedMinutes }} min · {{ blueprint()!.nutrition_note }}</p>
        </div>
      }
      <button (click)="finish()"
        class="bg-primary text-white rounded-lg py-4 font-bold text-lg">
        {{ 'cooklog.finish' | translate }}
      </button>
    }
  </div>
</div>
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/cook-log/post-cook-flow/ && git commit -m "feat(cooklog): show estimated nutrition in post-cook flow; store in cooked_versions"
```

---

### Task 6: Recipe detail — health badges + swap calculator

**Files:**
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.ts`
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.html`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/recipe-detail/recipe-detail.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/recipe-detail/recipe-detail.component.html
```

- [ ] **Step 1: Update the component**

Replace the full `recipe-detail.component.ts` with:

```typescript
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../models/recipe.model';
import { CookingModeComponent } from '../cooking-mode/cooking-mode.component';
import { PostCookFlowComponent } from '../../cook-log/post-cook-flow/post-cook-flow.component';
import { CookLogService } from '../../cook-log/cook-log.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';
import { DietaryProfile } from '../../../core/models/dietary-profile.model';
import { Nutrition } from '../../cook-log/cook-log.model';
import { sodiumColor, calorieColor, proteinColor } from '../../health/health-color';
import { SwapEntry, getSwapsFor } from '../../health/swap-calculator';

const PROTEIN_KEYS = ['chicken', 'salmon', 'beef', 'pork', 'tofu', 'shrimp', 'tuna',
                      'pollo', 'ternera', 'cerdo', 'gambas', 'atun', 'egg', 'huevo'];

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [TranslatePipe, CookingModeComponent, PostCookFlowComponent],
  templateUrl: './recipe-detail.component.html',
})
export class RecipeDetailComponent implements OnInit {
  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  cookingMode = signal(false);
  finishedCooking = signal(false);

  profile = signal<DietaryProfile | null>(null);
  avgNutrition = signal<Nutrition | null>(null);
  swapIngredient = signal<string | null>(null);
  selectedSwap = signal<SwapEntry | null>(null);
  availableSwaps = computed(() =>
    this.swapIngredient() ? getSwapsFor(this.swapIngredient()!) : []
  );

  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;
  protected proteinColor = proteinColor;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private cookLog: CookLogService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const [recipe, cooks, profile] = await Promise.all([
        this.recipeService.getById(id),
        this.cookLog.getHistoryForRecipe(id),
        this.dietaryProfile.getProfile().catch(() => null),
      ]);
      this.recipe.set(recipe);
      this.profile.set(profile);

      const withNutrition = cooks.filter(c => c.nutrition);
      if (withNutrition.length > 0) {
        this.avgNutrition.set({
          calories:  Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.calories  ?? 0), 0) / withNutrition.length),
          sodium_mg: Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.sodium_mg ?? 0), 0) / withNutrition.length),
          protein_g: Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.protein_g ?? 0), 0) / withNutrition.length),
        });
      }

      const proteinIng = recipe?.ingredients.find(i =>
        PROTEIN_KEYS.some(p => i.name.toLowerCase().includes(p))
      );
      if (proteinIng) this.swapIngredient.set(proteinIng.name);
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/recipes']);
  }

  toggleSwap(swap: SwapEntry): void {
    this.selectedSwap.update(s => s?.to === swap.to ? null : swap);
  }

  get stepGroups(): Array<{ group: number | null; steps: Recipe['steps'] }> {
    const steps = this.recipe()?.steps ?? [];
    const map = new Map<number | null, Recipe['steps']>();
    for (const step of steps) {
      const key = step.concurrent_group ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    return Array.from(map.entries()).map(([group, steps]) => ({ group, steps }));
  }
}
```

- [ ] **Step 2: Add health section to recipe detail template**

Read the current template first:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/recipe-detail/recipe-detail.component.html
```

Find the line that begins the ingredients section (the `<h2>Ingredientes</h2>` or similar). Insert the health badges block BEFORE ingredients, and the swap calculator block AFTER the ingredients list (before the steps section). Add the following two blocks:

**Health badges block** (insert BEFORE the ingredients `<h2>` heading):
```html
<!-- Health signals (from avg of logged cooks) -->
@if (avgNutrition()) {
  <div class="flex gap-3 mb-4">
    <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
      <p [class]="calorieColor(avgNutrition()!.calories!, profile()?.calorie_target ?? 2200) + ' font-bold text-base'">
        {{ avgNutrition()!.calories }}
      </p>
      <p class="text-xs text-gray-400">{{ 'health.calories' | translate }}</p>
    </div>
    <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
      <p [class]="sodiumColor(avgNutrition()!.sodium_mg!, profile()?.max_sodium_mg ?? 1500) + ' font-bold text-base'">
        {{ avgNutrition()!.sodium_mg }}mg
      </p>
      <p class="text-xs text-gray-400">{{ 'health.sodium' | translate }}</p>
    </div>
    <div class="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center">
      <p [class]="proteinColor(avgNutrition()!.protein_g!, profile()?.protein_target_g ?? 120) + ' font-bold text-base'">
        {{ avgNutrition()!.protein_g }}g
      </p>
      <p class="text-xs text-gray-400">{{ 'health.protein' | translate }}</p>
    </div>
  </div>
}
```

**Swap calculator block** (insert AFTER the ingredients list `</ul>`, BEFORE the steps `<h2>`):
```html
<!-- Swap calculator -->
@if (availableSwaps().length > 0) {
  <div class="mb-6">
    <h3 class="font-semibold text-sm text-gray-700 mb-2">
      {{ 'health.swap_title' | translate }} <span class="text-primary">{{ swapIngredient() }}</span>?
    </h3>
    <div class="flex flex-col gap-2">
      @for (swap of availableSwaps(); track swap.to) {
        <button (click)="toggleSwap(swap)"
          [class]="selectedSwap()?.to === swap.to
            ? 'bg-primary/10 border border-primary rounded-lg p-3 text-left w-full'
            : 'bg-gray-50 border border-gray-200 rounded-lg p-3 text-left w-full'">
          <p class="font-medium text-gray-900 text-sm">→ {{ swap.to }}</p>
          @if (selectedSwap()?.to === swap.to) {
            <div class="flex flex-wrap gap-3 mt-2 text-xs">
              <span [class]="swap.calories_delta <= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                {{ swap.calories_delta > 0 ? '+' : '' }}{{ swap.calories_delta }} cal
              </span>
              <span [class]="swap.sodium_delta <= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                {{ swap.sodium_delta > 0 ? '+' : '' }}{{ swap.sodium_delta }}mg Na
              </span>
              <span [class]="swap.protein_delta >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
                {{ swap.protein_delta > 0 ? '+' : '' }}{{ swap.protein_delta }}g prot
              </span>
              <span class="text-gray-500">{{ swap.cook_time_delta > 0 ? '+' : '' }}{{ swap.cook_time_delta }}min</span>
              <span class="text-gray-400 italic">{{ swap.note }}</span>
            </div>
          }
        </button>
      }
    </div>
  </div>
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/recipes/recipe-detail/ && git commit -m "feat(recipe-detail): add health signal badges and swap calculator"
```

---

### Task 7: Tonight page — weekly health summary + i18n + build + push

**Files:**
- Modify: `src/app/features/tonight/tonight-page.component.ts`
- Modify: `src/app/features/tonight/tonight-page.component.html`
- Modify: `public/assets/i18n/es.json`
- Modify: `public/assets/i18n/en.json`

Read relevant files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/tonight/tonight-page.component.ts
cat /home/valentin/code/ephemeral-cuisine/public/assets/i18n/es.json
```

- [ ] **Step 1: Update TonightPageComponent**

Replace the full `tonight-page.component.ts` with:

```typescript
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';
import { HealthService, WeeklySummary } from '../health/health.service';
import { sodiumColor, calorieColor } from '../health/health-color';

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
  weeklySummary = signal<WeeklySummary | null>(null);
  profile = signal<DietaryProfile | null>(null);

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  protected getExpiryStatus = getExpiryStatus;
  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
    private healthService: HealthService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes, profile] = await Promise.all([
      this.suggestionService.getSuggestions(),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
      this.dietaryProfile.getProfile().catch(() => null),
    ]);

    this.profile.set(profile);
    this.suggestions.set(suggestions.filter(s => s.missingEquipment.length === 0 || s.score > 0));
    this.expiringToday.set(
      (invRes.data ?? []).filter((i: InventoryItem) =>
        ['expired', 'today', 'tomorrow'].includes(getExpiryStatus(i.expiry_date))
      )
    );
    this.loading.set(false);

    // Load weekly summary in background (non-blocking)
    this.healthService.getWeeklySummary(profile).then(s => this.weeklySummary.set(s)).catch(() => null);
  }

  next(): void {
    this.currentIndex.update(i => Math.min(i + 1, this.suggestions().length - 1));
  }

  prev(): void {
    this.currentIndex.update(i => Math.max(i - 1, 0));
  }

  matchedNames(items: InventoryItem[]): string {
    return items.map(i => i.name).join(', ');
  }
}
```

- [ ] **Step 2: Add weekly health card to tonight template**

Read the current template:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/tonight/tonight-page.component.html
```

Find the closing `</div>` of the main suggestion card (the div with class `bg-white border ... rounded-2xl`). Directly AFTER it (but still inside the `@else` block that shows the suggestion), add:

```html
<!-- Weekly health summary -->
@if (weeklySummary() && weeklySummary()!.cook_count > 0) {
  <div class="bg-white border border-gray-200 rounded-xl p-4 mt-2">
    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{{ 'health.this_week' | translate }}</h3>
    <div class="flex gap-3 text-center">
      <div class="flex-1">
        <p [class]="sodiumColor(weeklySummary()!.avg_sodium_mg, profile()?.max_sodium_mg ?? 1500) + ' text-lg font-bold'">
          {{ weeklySummary()!.avg_sodium_mg }}mg
        </p>
        <p class="text-xs text-gray-400">{{ 'health.avg_sodium' | translate }}</p>
      </div>
      <div class="flex-1">
        <p [class]="calorieColor(weeklySummary()!.avg_calories, profile()?.calorie_target ?? 2200) + ' text-lg font-bold'">
          {{ weeklySummary()!.avg_calories }}
        </p>
        <p class="text-xs text-gray-400">{{ 'health.avg_calories' | translate }}</p>
      </div>
      <div class="flex-1">
        <p class="text-lg font-bold text-gray-800">{{ weeklySummary()!.protein_target_hit_days }}/7</p>
        <p class="text-xs text-gray-400">{{ 'health.protein_days' | translate }}</p>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 3: Merge i18n keys**

Read both JSON files first. Add a `"health"` section to both (they won't have it yet). Also add `"cooklog.servings"` to both.

In `es.json`, add this `"health"` section alongside the existing sections:
```json
"health": {
  "calories": "Cal/ración",
  "sodium": "Sodio/ración",
  "protein": "Proteína/ración",
  "this_week": "Esta semana",
  "avg_sodium": "sodio medio/día",
  "avg_calories": "cal medias/día",
  "protein_days": "días proteína",
  "swap_title": "¿Qué pasa si cambias",
  "per_serving": "por ración"
}
```

In `es.json`, add to existing `"cooklog"` section:
```json
"servings": "Raciones"
```

In `en.json`, add `"health"` section:
```json
"health": {
  "calories": "Cal/serving",
  "sodium": "Sodium/serving",
  "protein": "Protein/serving",
  "this_week": "This week",
  "avg_sodium": "avg sodium/day",
  "avg_calories": "avg cal/day",
  "protein_days": "protein days",
  "swap_title": "What if you swapped",
  "per_serving": "per serving"
}
```

In `en.json`, add to existing `"cooklog"` section:
```json
"servings": "Servings"
```

- [ ] **Step 4: Run all tests and build**

```bash
cd /home/valentin/code/ephemeral-cuisine && npm test -- --no-coverage 2>&1 | tail -8
npx ng build --configuration=development 2>&1 | tail -4
```

Expected: all tests pass, build succeeds.

- [ ] **Step 5: Commit and push**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/tonight/ src/app/features/health/ public/assets/i18n/ && git commit -m "feat(health): weekly health summary on Tonight page; health i18n keys" && git push
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| Sodium tracking + daily budget | Tasks 1, 2, 5, 6 — estimated + stored, color-coded everywhere |
| Calorie/macro estimation | Task 1 — estimateNutrition() from combo; Task 5 — stored in cooked_versions |
| GF/DF auto-substitution | ✅ Already done (substitutions.ts from Phase 2) |
| Weekly health summary | Tasks 4, 7 — HealthService + Tonight card |
| Color-coded health signals everywhere | Tasks 2, 5, 6, 7 — sodiumColor/calorieColor/proteinColor in post-cook, recipe detail, tonight |
| "What if I swap X?" calculator | Task 3 + 6 — swap table + recipe detail UI |

**2. Placeholder scan:** None found. All steps have complete code.

**3. Type consistency:**
- `Nutrition` interface (from `cook-log.model.ts`): `{ calories?, sodium_mg?, protein_g? }` — used consistently throughout
- `estimateNutrition` returns `Required<Nutrition>` (all fields defined) — safe to call `.calories` without optional chaining
- `SwapEntry` defined in Task 3, used in Task 6 — consistent field names (`calories_delta`, `sodium_delta`, `protein_delta`, `cook_time_delta`, `note`, `from`, `to`)
- `WeeklySummary` defined in Task 4, used in Task 7 — consistent (`avg_sodium_mg`, `avg_calories`, `protein_target_hit_days`, `cook_count`, `period_days`)
- `sodiumColor`, `calorieColor`, `proteinColor` always take `(value: number, target: number)` — consistent in Tasks 5, 6, 7
