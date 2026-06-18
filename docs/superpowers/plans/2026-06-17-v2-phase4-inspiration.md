# v2 Phase 4: Inspiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mood-aware suggestion filtering, flavor outcome prediction on Tonight, "current trend" + flavor diversity analytics on Ranking, new ingredient pairing tips, and prep debt summary in cooking mode.

**Architecture:** Pure functions for all computation (testable, no Angular). SuggestionService gains `MoodFilter` parameter. Ranking page adds two new sections fed by extended `RankingData` (trend + diversity). Flavor predictor and ingredient onboarding are pure lookup tables. Prep debt is a computed getter in `CookingModeComponent`.

**Tech Stack:** Angular 18 signals, computed(), pure TypeScript, ngx-translate TranslatePipe.

---

## File Map

**New:**
- `src/app/features/tonight/flavor-predictor.ts` — `predictFlavors(ingredientNames): string[]`
- `src/app/features/tonight/flavor-predictor.spec.ts`

**Modified:**
- `src/app/features/tonight/suggestion.service.ts` — `MoodFilter` type + `getSuggestions(mood)` + `avgSelfRating`/`avgFamilyRating` on `ScoredRecipe`
- `src/app/features/tonight/suggestion.service.spec.ts` — TDD for mood-aware sorting
- `src/app/features/tonight/tonight-page.component.ts` — mood signal + reload on change + predictFlavors
- `src/app/features/tonight/tonight-page.component.html` — mood chips + flavor tags
- `src/app/features/ranking/ranking.model.ts` — `computeTrend`, `computeFlavorDiversity`, `CookTrend`, `FlavorDiversity` interfaces (appended)
- `src/app/features/ranking/ranking.model.spec.ts` — TDD for new functions
- `src/app/features/ranking/ranking.service.ts` — extend `RankingData` with `trend` + `diversity`
- `src/app/features/ranking/ranking-page.component.html` — trend + diversity sections
- `src/app/features/inventory/add-item-form/add-item-form.component.ts` — `PAIRING_TIPS` + `pairingTip` getter
- `src/app/features/recipes/cooking-mode/cooking-mode.component.ts` — `cookSummary` getter
- `src/app/features/recipes/cooking-mode/cooking-mode.component.html` — prep debt banner
- `public/assets/i18n/es.json`, `en.json` — new keys

---

### Task 1: Flavor outcome predictor (TDD)

**Files:**
- Create: `src/app/features/tonight/flavor-predictor.ts`
- Create: `src/app/features/tonight/flavor-predictor.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/tonight/flavor-predictor.spec.ts
import { predictFlavors } from './flavor-predictor';

describe('predictFlavors', () => {
  it('returns bright for citrus ingredients', () => {
    expect(predictFlavors(['lemon', 'chicken'])).toContain('bright');
  });

  it('returns umami for soy sauce', () => {
    expect(predictFlavors(['soy sauce', 'garlic'])).toContain('umami');
  });

  it('returns aromatic for garlic', () => {
    expect(predictFlavors(['garlic', 'onion'])).toContain('aromatic');
  });

  it('returns at most 3 flavors', () => {
    const result = predictFlavors(['lemon', 'soy', 'chili', 'garlic', 'honey', 'cream']);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for unknown ingredients', () => {
    expect(predictFlavors(['xyz999'])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="flavor-predictor" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './flavor-predictor'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/tonight/flavor-predictor.ts
const FLAVOR_MAP: Array<{ keywords: string[]; flavor: string }> = [
  { keywords: ['lemon', 'lime', 'limón', 'orange', 'naranja', 'ponzu', 'yuzu'], flavor: 'bright' },
  { keywords: ['soy', 'miso', 'fish sauce', 'parmesan', 'anchovy', 'mushroom', 'tamari'], flavor: 'umami' },
  { keywords: ['honey', 'teriyaki', 'mango', 'coconut', 'maple', 'dates'], flavor: 'sweet' },
  { keywords: ['chili', 'jalapeño', 'sriracha', 'gochujang', 'harissa', 'cayenne'], flavor: 'spicy' },
  { keywords: ['garlic', 'onion', 'ajo', 'cebolla', 'shallot'], flavor: 'aromatic' },
  { keywords: ['cream', 'coconut milk', 'butter', 'tahini'], flavor: 'rich' },
  { keywords: ['tomato', 'vinegar', 'tamarind', 'pomegranate'], flavor: 'tangy' },
  { keywords: ['cumin', 'coriander', 'cinnamon', 'cardamom', 'turmeric'], flavor: 'warm' },
];

export function predictFlavors(ingredientNames: string[]): string[] {
  const lower = ingredientNames.map(n => n.toLowerCase());
  const result: string[] = [];
  for (const entry of FLAVOR_MAP) {
    if (entry.keywords.some(k => lower.some(n => n.includes(k)))) {
      if (!result.includes(entry.flavor)) result.push(entry.flavor);
    }
  }
  return result.slice(0, 3);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="flavor-predictor" --no-coverage 2>&1 | tail -6
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/tonight/flavor-predictor.ts src/app/features/tonight/flavor-predictor.spec.ts && git commit -m "feat(tonight): add flavor outcome predictor pure function"
```

---

### Task 2: Mood-aware suggestion engine (TDD)

**Files:**
- Modify: `src/app/features/tonight/suggestion.service.ts`
- Create/Modify: `src/app/features/tonight/suggestion.service.spec.ts`

Read the current `suggestion.service.ts` first (already read, but re-read to confirm exact structure before editing).

- [ ] **Step 1: Read current service**

```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/tonight/suggestion.service.ts
```

- [ ] **Step 2: Write failing tests**

The test file needs to mock Supabase and DietaryProfileService. The test should verify that:
- `default` mode uses the existing score sort
- `comfort` mode bubbles up high-rated recipes
- `adventure` mode puts novel recipes first
- `impress` mode bubbles up high family-rated recipes

Since mocking the full service is complex, test only the new `sortByMood` function extracted from the service.

Actually, make `sortByMood` a pure exported function:

```typescript
// src/app/features/tonight/suggestion.service.spec.ts
import { sortByMood } from './suggestion.service';
import { ScoredRecipe } from './suggestion.service';

const make = (overrides: Partial<ScoredRecipe>): ScoredRecipe => ({
  recipe: { id: '1', name: 'r', ingredients: [], steps: [], equipment: [], tags: [], allergens: [], language: 'en', user_id: 'u', created_at: '' } as any,
  score: 5,
  expiryScore: 0,
  isNovel: false,
  missingEquipment: [],
  matchedInventoryItems: [],
  substitutions: [],
  avgSelfRating: 7,
  avgFamilyRating: 7,
  ...overrides,
});

describe('sortByMood', () => {
  it('default mode keeps score order', () => {
    const a = make({ score: 10 });
    const b = make({ score: 5 });
    expect(sortByMood([b, a], 'default')[0]).toBe(a);
  });

  it('comfort mode puts highest avgSelfRating first', () => {
    const low = make({ avgSelfRating: 5 });
    const high = make({ avgSelfRating: 9 });
    expect(sortByMood([low, high], 'comfort')[0]).toBe(high);
  });

  it('adventure mode puts novel recipes first', () => {
    const familiar = make({ isNovel: false });
    const novel = make({ isNovel: true });
    expect(sortByMood([familiar, novel], 'adventure')[0]).toBe(novel);
  });

  it('impress mode puts highest avgFamilyRating first', () => {
    const low = make({ avgFamilyRating: 5 });
    const high = make({ avgFamilyRating: 9 });
    expect(sortByMood([low, high], 'impress')[0]).toBe(high);
  });
});
```

- [ ] **Step 3: Run to verify FAIL**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="suggestion.service.spec" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `sortByMood` not exported, `avgSelfRating` not on ScoredRecipe.

- [ ] **Step 4: Implement**

Replace `suggestion.service.ts` with this updated version (keep everything existing, add the new exports and fields):

```typescript
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { Recipe } from '../recipes/models/recipe.model';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { CookedVersion } from '../cook-log/cook-log.model';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

export type MoodFilter = 'default' | 'comfort' | 'adventure' | 'impress';

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  expiryScore: number;
  isNovel: boolean;
  missingEquipment: string[];
  matchedInventoryItems: InventoryItem[];
  substitutions: string[];
  avgSelfRating: number;
  avgFamilyRating: number;
}

const EXPIRY_WEIGHTS: Record<string, number> = {
  expired: 10, today: 8, tomorrow: 5, this_week: 2, later: 0, none: 0,
};

export function sortByMood(items: ScoredRecipe[], mood: MoodFilter): ScoredRecipe[] {
  const sorted = [...items];
  switch (mood) {
    case 'comfort':
      return sorted.sort((a, b) => b.avgSelfRating - a.avgSelfRating);
    case 'adventure':
      return sorted.sort((a, b) => {
        if (a.isNovel !== b.isNovel) return a.isNovel ? -1 : 1;
        return b.score - a.score;
      });
    case 'impress':
      return sorted.sort((a, b) => b.avgFamilyRating - a.avgFamilyRating);
    default:
      return sorted.sort((a, b) => b.score - a.score);
  }
}

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  constructor(
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async getSuggestions(mood: MoodFilter = 'default'): Promise<ScoredRecipe[]> {
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

    // Build per-recipe rating averages from cook history
    const ratingsByRecipe = new Map<string, { selfSum: number; familySum: number; familyCount: number; count: number }>();
    for (const c of cooks) {
      if (!c.recipe_id) continue;
      const existing = ratingsByRecipe.get(c.recipe_id) ?? { selfSum: 0, familySum: 0, familyCount: 0, count: 0 };
      const self = c.ratings?.['self'] ?? 0;
      const familyRatings = Object.entries(c.ratings ?? {}).filter(([k]) => k !== 'self').map(([, v]) => v);
      ratingsByRecipe.set(c.recipe_id, {
        selfSum: existing.selfSum + self,
        familySum: existing.familySum + familyRatings.reduce((s, v) => s + v, 0),
        familyCount: existing.familyCount + familyRatings.length,
        count: existing.count + 1,
      });
    }

    const scored = recipes.map(recipe =>
      this.scoreRecipe(recipe, inventory, usedCombos, ownedEquipment, profile, ratingsByRecipe)
    );

    return sortByMood(
      scored.filter(s => s.missingEquipment.length === 0 || s.score > 0),
      mood,
    );
  }

  private scoreRecipe(
    recipe: Recipe,
    inventory: InventoryItem[],
    usedCombos: Set<string>,
    ownedEquipment: Set<string>,
    profile: DietaryProfile | null,
    ratingsByRecipe: Map<string, { selfSum: number; familySum: number; familyCount: number; count: number }>,
  ): ScoredRecipe {
    const ingredientNames = (recipe.ingredients ?? []).map((i: any) => i.name.toLowerCase());

    const matchedInventoryItems = inventory.filter(inv =>
      ingredientNames.some(name => inv.name.toLowerCase().includes(name) || name.includes(inv.name.toLowerCase()))
    );

    const expiryScore = matchedInventoryItems.reduce((sum, item) => {
      return sum + (EXPIRY_WEIGHTS[getExpiryStatus(item.expiry_date)] ?? 0);
    }, 0);

    const protein = matchedInventoryItems.find(i => i.category === 'protein')?.name ?? '';
    const produce = matchedInventoryItems.filter(i => i.category === 'produce').map(i => i.name).sort();
    const comboKey = `${recipe.id}:${protein}:${produce.join(',')}`;
    const isNovel = !usedCombos.has(comboKey);

    const requiredEquipment: string[] = (recipe as any).equipment ?? [];
    const missingEquipment = requiredEquipment.filter(e => !ownedEquipment.has(e));

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

    const ratings = ratingsByRecipe.get(recipe.id);
    const avgSelfRating = ratings && ratings.count > 0 ? ratings.selfSum / ratings.count : 0;
    const avgFamilyRating = ratings && ratings.familyCount > 0 ? ratings.familySum / ratings.familyCount : 0;

    return { recipe, score, expiryScore, isNovel, missingEquipment, matchedInventoryItems, substitutions, avgSelfRating, avgFamilyRating };
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="suggestion.service.spec" --no-coverage 2>&1 | tail -6
```

Expected: 4 passing (suggestion.service.spec) + existing suggestion specs still pass.

- [ ] **Step 6: Run all tests to check for regressions**

```bash
cd /home/valentin/code/ephemeral-cuisine && npm test -- --no-coverage 2>&1 | tail -5
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/tonight/suggestion.service.ts src/app/features/tonight/suggestion.service.spec.ts && git commit -m "feat(tonight): add mood-aware suggestion sorting (comfort/adventure/impress)"
```

---

### Task 3: Tonight page — mood chips + flavor tags

**Files:**
- Modify: `src/app/features/tonight/tonight-page.component.ts`
- Modify: `src/app/features/tonight/tonight-page.component.html`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/tonight/tonight-page.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/tonight/tonight-page.component.html
```

- [ ] **Step 1: Update tonight-page.component.ts**

Add these to the component:

```typescript
import { MoodFilter } from './suggestion.service';
import { predictFlavors } from './flavor-predictor';

// New signals
mood = signal<MoodFilter>('default');

// Computed — flavors for the current suggestion
currentFlavors = computed(() => {
  const s = this.current();
  if (!s) return [];
  const names = [
    ...s.recipe.ingredients.map(i => i.name),
    ...s.matchedInventoryItems.map(i => i.name),
  ];
  return predictFlavors(names);
});
```

Update `setMood(m: MoodFilter)` method and call on mood chip click:
```typescript
async setMood(m: MoodFilter): Promise<void> {
  this.mood.set(m);
  this.loading.set(true);
  this.currentIndex.set(0);
  const suggestions = await this.suggestionService.getSuggestions(m);
  this.suggestions.set(suggestions);
  this.loading.set(false);
}
```

In `ngOnInit`, change `this.suggestionService.getSuggestions()` → `this.suggestionService.getSuggestions(this.mood())`.

- [ ] **Step 2: Update tonight-page.component.html**

Add mood chips ABOVE the suggestion card (inside the `@else` block, before the card div):

```html
<!-- Mood selector -->
<div class="flex gap-2 mb-4">
  @for (m of ([['default', '🎯'], ['comfort', '🛋️'], ['adventure', '✨'], ['impress', '⭐']] as const); track m[0]) {
    <button (click)="setMood(m[0])"
      [class]="mood() === m[0]
        ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white'
        : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600'">
      {{ m[1] }} {{ 'tonight.mood_' + m[0] | translate }}
    </button>
  }
</div>
```

Add flavor tags inside the suggestion card, below the recipe name (find the card's `<p>` recipe name element and insert after it):

```html
@if (currentFlavors().length > 0) {
  <div class="flex gap-1 flex-wrap mb-1">
    @for (f of currentFlavors(); track f) {
      <span class="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{{ f }}</span>
    }
  </div>
}
```

**NOTE:** The `@for` with `as const` tuple may cause a parser error. Use a simpler approach:

Define `readonly MOOD_OPTIONS` in the component class:
```typescript
readonly moodOptions: Array<[MoodFilter, string]> = [
  ['default', '🎯'], ['comfort', '🛋️'], ['adventure', '✨'], ['impress', '⭐']
];
```

Then in the template:
```html
@for (m of moodOptions; track m[0]) {
  <button (click)="setMood(m[0])"
    [class]="mood() === m[0]
      ? 'px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white'
      : 'px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600'">
    {{ m[1] }} {{ 'tonight.mood_' + m[0] | translate }}
  </button>
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/tonight/ && git commit -m "feat(tonight): mood chips and flavor outcome tags on suggestion card"
```

---

### Task 4: Trend + Flavor Diversity analytics (TDD)

**Files:**
- Modify: `src/app/features/ranking/ranking.model.ts` (append new interfaces + functions)
- Modify: `src/app/features/ranking/ranking.model.spec.ts` (add new test cases)

Read current files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/ranking/ranking.model.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/ranking/ranking.model.spec.ts
```

- [ ] **Step 1: Write failing tests (append to existing spec)**

```typescript
// Append to ranking.model.spec.ts

import { computeTrend, computeFlavorDiversity } from './ranking.model';
import { CookedVersion } from '../cook-log/cook-log.model';
import { Recipe } from '../recipes/models/recipe.model';

const makeCook = (overrides: Partial<CookedVersion>): CookedVersion => ({
  id: '1', user_id: 'u', recipe_id: 'r1', technique_id: null,
  cooked_at: new Date().toISOString(),
  combo: { protein: 'chicken', produce: [], seasoning: '' },
  ratings: { self: 8 },
  notes: null, modifications: [], nutrition: null, family_present: [], leftovers: null,
  ...overrides,
});

describe('computeTrend', () => {
  it('identifies dominant protein from recent cooks', () => {
    const cooks = [
      makeCook({ combo: { protein: 'chicken', produce: [], seasoning: '' } }),
      makeCook({ combo: { protein: 'chicken', produce: [], seasoning: '' } }),
      makeCook({ combo: { protein: 'salmon', produce: [], seasoning: '' } }),
    ];
    const trend = computeTrend(cooks, []);
    expect(trend.dominantProtein).toBe('chicken');
  });

  it('counts total recent cooks', () => {
    const cooks = [makeCook({}), makeCook({}), makeCook({})];
    const trend = computeTrend(cooks, []);
    expect(trend.cookCountRecent).toBe(3);
  });
});

describe('computeFlavorDiversity', () => {
  it('detects citrus from lemon in produce', () => {
    const cooks = [makeCook({ combo: { protein: 'chicken', produce: ['lemon'], seasoning: '' } })];
    const result = computeFlavorDiversity(cooks);
    const citrus = result.categories.find(c => c.name === 'citrus');
    expect(citrus?.count).toBeGreaterThan(0);
  });

  it('lists uncovered categories as missing', () => {
    const cooks = [makeCook({ combo: { protein: 'chicken', produce: ['lemon'], seasoning: '' } })];
    const result = computeFlavorDiversity(cooks);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('returns empty missing when all categories used', () => {
    const cooks = [
      makeCook({ combo: { protein: 'salmon', produce: ['lemon'], seasoning: 'miso' } }),
      makeCook({ combo: { protein: 'chicken', produce: ['chili'], seasoning: 'cumin' } }),
      makeCook({ combo: { protein: 'beef', produce: ['garlic'], seasoning: 'honey' } }),
      makeCook({ combo: { protein: 'tofu', produce: ['cilantro'], seasoning: 'tomato' } }),
    ];
    const result = computeFlavorDiversity(cooks);
    // at least some categories should be covered
    expect(result.categories.filter(c => c.count > 0).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="ranking.model.spec" --no-coverage 2>&1 | tail -8
```

Expected: FAIL — `computeTrend` and `computeFlavorDiversity` not exported.

- [ ] **Step 3: Append implementations to ranking.model.ts**

Read the current ranking.model.ts file completely first, then append (do NOT replace existing code):

```typescript
// ────── Trend + Flavor Diversity ──────

import { CookedVersion } from '../cook-log/cook-log.model';
// Note: Recipe is already imported if the model already has it — otherwise add:
// import { Recipe } from '../recipes/models/recipe.model';

export interface CookTrend {
  dominantProtein: string | null;
  dominantCuisine: string | null;
  cookCountRecent: number;
  totalCooks: number;
}

export interface FlavorDiversityCategory {
  name: string;
  label: string;
  count: number;
}

export interface FlavorDiversity {
  categories: FlavorDiversityCategory[];
  missing: string[];
}

const FLAVOR_CATEGORIES: Array<{ name: string; label: string; keywords: string[] }> = [
  { name: 'citrus',      label: 'Citrus',      keywords: ['lemon', 'lime', 'limón', 'orange', 'naranja', 'ponzu', 'yuzu'] },
  { name: 'umami',       label: 'Umami',        keywords: ['soy', 'miso', 'fish sauce', 'parmesan', 'anchovy', 'mushroom', 'tamari'] },
  { name: 'warm_spice',  label: 'Warm spice',   keywords: ['cumin', 'coriander', 'cinnamon', 'cardamom', 'turmeric', 'ras el hanout', 'garam masala'] },
  { name: 'heat',        label: 'Heat',         keywords: ['chili', 'jalapeño', 'sriracha', 'gochujang', 'harissa', 'cayenne'] },
  { name: 'fresh_herb',  label: 'Fresh herb',   keywords: ['cilantro', 'basil', 'mint', 'parsley', 'dill', 'coriander'] },
  { name: 'sweet',       label: 'Sweet',        keywords: ['honey', 'teriyaki', 'mango', 'coconut', 'maple', 'dates'] },
];

export function computeTrend(cooks: CookedVersion[], recipes: Array<{ id: string; cuisine_type?: string }>): CookTrend {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = cooks.filter(c => new Date(c.cooked_at) >= cutoff);

  const proteinCounts = new Map<string, number>();
  for (const c of recent) {
    const p = c.combo.protein?.trim().toLowerCase();
    if (p) proteinCounts.set(p, (proteinCounts.get(p) ?? 0) + 1);
  }
  const dominantProtein = [...proteinCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const cuisineCounts = new Map<string, number>();
  for (const c of recent) {
    if (!c.recipe_id) continue;
    const cuisine = recipeMap.get(c.recipe_id)?.cuisine_type?.trim();
    if (cuisine) cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
  }
  const dominantCuisine = [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { dominantProtein, dominantCuisine, cookCountRecent: recent.length, totalCooks: cooks.length };
}

export function computeFlavorDiversity(cooks: CookedVersion[]): FlavorDiversity {
  const counts = new Map<string, number>(FLAVOR_CATEGORIES.map(c => [c.name, 0]));

  for (const cook of cooks) {
    const allIngredients = [
      cook.combo.protein ?? '',
      ...(cook.combo.produce ?? []),
      cook.combo.seasoning ?? '',
    ].map(s => s.toLowerCase());

    for (const cat of FLAVOR_CATEGORIES) {
      if (cat.keywords.some(k => allIngredients.some(ing => ing.includes(k)))) {
        counts.set(cat.name, (counts.get(cat.name) ?? 0) + 1);
      }
    }
  }

  const categories = FLAVOR_CATEGORIES.map(c => ({
    name: c.name, label: c.label, count: counts.get(c.name) ?? 0,
  }));
  const missing = categories.filter(c => c.count === 0).map(c => c.label);

  return { categories, missing };
}
```

**Important:** The `ranking.model.ts` already imports things at the top. Add only the missing imports. `CookedVersion` is in `'../cook-log/cook-log.model'`. Read existing imports before adding new ones.

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="ranking.model.spec" --no-coverage 2>&1 | tail -8
```

Expected: all tests passing (existing + 5 new).

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/ranking/ranking.model.ts src/app/features/ranking/ranking.model.spec.ts && git commit -m "feat(ranking): add computeTrend and computeFlavorDiversity analytics functions"
```

---

### Task 5: Ranking service + page — trend and diversity sections

**Files:**
- Modify: `src/app/features/ranking/ranking.service.ts` — extend RankingData + populate trend/diversity
- Modify: `src/app/features/ranking/ranking-page.component.html` — add two new sections

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/ranking/ranking.service.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/ranking/ranking-page.component.html
```

- [ ] **Step 1: Update ranking.service.ts**

Add to imports:
```typescript
import { computeTrend, computeFlavorDiversity, CookTrend, FlavorDiversity } from './ranking.model';
```

Extend `RankingData` interface (add to the existing interface):
```typescript
export interface RankingData {
  overall: Array<RankedDish & { recipe: Recipe }>;
  byAudience: Array<{ person: string; dishes: Array<RankedDish & { recipe: Recipe }> }>;
  byTechnique: Array<RankedDish & { recipe: Recipe; technique: Technique }>;
  mostImproved: Array<RankedDish & { recipe: Recipe }>;
  worthRepeating: Array<RankedDish & { recipe: Recipe }>;
  trend: CookTrend;
  diversity: FlavorDiversity;
}
```

In `getRankings()`, after building `agg`, add:
```typescript
const trend = computeTrend(cooks, recipes);
const diversity = computeFlavorDiversity(cooks);
```

And add them to the return object:
```typescript
return {
  overall: ...,
  byAudience: ...,
  byTechnique: ...,
  mostImproved: ...,
  worthRepeating: ...,
  trend,
  diversity,
};
```

- [ ] **Step 2: Update ranking-page.component.html**

After the "WORTH REPEATING" section's closing `</section>`, add two new sections BEFORE the closing `}` of the `@else` block:

```html
<!-- CURRENT TREND -->
@if (data()!.trend.cookCountRecent > 0) {
  <section class="mb-8">
    <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ 'ranking.trend_title' | translate }}</h2>
    <div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 text-sm">
      @if (data()!.trend.dominantProtein) {
        <div class="flex items-center gap-2">
          <span class="text-gray-400">🥩</span>
          <span class="text-gray-700">{{ 'ranking.trend_protein' | translate }}: <strong class="text-gray-900">{{ data()!.trend.dominantProtein }}</strong></span>
        </div>
      }
      @if (data()!.trend.dominantCuisine) {
        <div class="flex items-center gap-2">
          <span class="text-gray-400">🌍</span>
          <span class="text-gray-700">{{ 'ranking.trend_cuisine' | translate }}: <strong class="text-gray-900">{{ data()!.trend.dominantCuisine }}</strong></span>
        </div>
      }
      <div class="flex items-center gap-2">
        <span class="text-gray-400">🍳</span>
        <span class="text-gray-500">{{ data()!.trend.cookCountRecent }} {{ 'ranking.trend_cooks_month' | translate }}</span>
      </div>
    </div>
  </section>
}

<!-- FLAVOR DIVERSITY -->
<section class="mb-8">
  <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ 'ranking.diversity_title' | translate }}</h2>
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
    @for (cat of data()!.diversity.categories; track cat.name) {
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-500 w-24 flex-shrink-0">{{ cat.label }}</span>
        <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div class="bg-primary rounded-full h-2 transition-all"
            [style.width]="(cat.count > 0 ? Math.min(cat.count * 20, 100) : 4) + '%'"></div>
        </div>
        <span class="text-xs text-gray-400 w-6 text-right">{{ cat.count }}</span>
      </div>
    }
    @if (data()!.diversity.missing.length > 0) {
      <p class="text-xs text-amber-600 mt-1">{{ 'ranking.diversity_try' | translate }}: {{ data()!.diversity.missing.join(', ') }}</p>
    }
  </div>
</section>
```

**Note:** The template uses `Math.min(...)`. Add `protected Math = Math;` to `RankingPageComponent`:
```typescript
protected Math = Math;
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/ranking/ && git commit -m "feat(ranking): add current trend and flavor diversity sections"
```

---

### Task 6: New ingredient onboarding + prep debt calculator

**Files:**
- Modify: `src/app/features/inventory/add-item-form/add-item-form.component.ts` — inline template, add `PAIRING_TIPS` and `pairingTip` getter
- Modify: `src/app/features/recipes/cooking-mode/cooking-mode.component.ts` — add `cookSummary` getter
- Modify: `src/app/features/recipes/cooking-mode/cooking-mode.component.html` — add prep debt banner

Read both component files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/inventory/add-item-form/add-item-form.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/cooking-mode/cooking-mode.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/cooking-mode/cooking-mode.component.html
```

- [ ] **Step 1: Add PAIRING_TIPS to AddItemFormComponent**

The component has an inline template. Add the constant at module level (above `@Component`):

```typescript
const PAIRING_TIPS: Record<string, string> = {
  sumac: 'Sprinkle on veggies or chicken; pairs with yogurt and onion',
  "za'atar": 'Mix with olive oil for dipping; rub on chicken before grilling',
  harissa: 'Spicy North African paste; great in stews, eggs, or marinades',
  miso: 'Dissolve in warm water for glazes or soups; adds umami depth',
  tahini: 'Blend with lemon + garlic for sauces; great in dressings or hummus',
  gochujang: 'Korean chili paste; perfect for stir-fries and marinades',
  tamarind: 'Sour-sweet; key in Thai peanut sauce and Indian chutneys',
  'preserved lemon': 'Use sparingly; adds intense citrus to tagines and salads',
  'ras el hanout': 'North African spice blend; try on lamb, chicken, or roasted carrots',
  'black garlic': 'Sweet and earthy; blend into dressings or rub on steak',
  shiso: 'Japanese herb with mint+basil notes; wrap sushi or top salads',
  cardamom: 'Warm and floral; pair with chicken, rice, or desserts',
};
```

Add a getter to the class:
```typescript
get pairingTip(): string | null {
  const lower = this.name.trim().toLowerCase();
  for (const [key, tip] of Object.entries(PAIRING_TIPS)) {
    if (lower.includes(key)) return tip;
  }
  return null;
}
```

In the inline template, after the name input (`<input type="text" [(ngModel)]="name" ...>`), add:
```html
@if (pairingTip) {
  <p class="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mt-1">💡 {{ pairingTip }}</p>
}
```

- [ ] **Step 2: Add cookSummary to CookingModeComponent**

Add a getter to the class (after `get canAdvance()`):

```typescript
get cookSummary(): { totalMin: number; timerMin: number } {
  const groups = this.stepGroups();
  let totalMin = 0;
  let timerMin = 0;
  for (const g of groups) {
    const maxTimer = g.steps.reduce((m, s) => Math.max(m, s.time ?? 0), 0);
    totalMin += maxTimer;
    // Steps with a timer > 5 min are considered "wait time"
    if (maxTimer > 5) timerMin += maxTimer;
  }
  return { totalMin, timerMin };
}
```

- [ ] **Step 3: Read cooking-mode template and add prep debt banner**

Read the template first:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/cooking-mode/cooking-mode.component.html
```

At the top of the template (before the step display, after the header), add a compact summary banner:

```html
@if (cookSummary.totalMin > 0) {
  <div class="flex gap-3 text-xs text-gray-500 px-4 py-2 bg-gray-50 border-b border-gray-100">
    <span>⏱ ~{{ cookSummary.totalMin }}min</span>
    @if (cookSummary.timerMin > 0) {
      <span>· {{ cookSummary.timerMin }}min waiting</span>
    }
  </div>
}
```

- [ ] **Step 4: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/inventory/add-item-form/ src/app/features/recipes/cooking-mode/ && git commit -m "feat: add ingredient pairing tips and prep debt summary in cooking mode"
```

---

### Task 7: i18n + full test suite + build + push

**Files:**
- Modify: `public/assets/i18n/es.json`
- Modify: `public/assets/i18n/en.json`

Read both JSON files first:
```bash
cat /home/valentin/code/ephemeral-cuisine/public/assets/i18n/es.json
cat /home/valentin/code/ephemeral-cuisine/public/assets/i18n/en.json
```

- [ ] **Step 1: Add new i18n keys**

In `es.json`, add to the existing `"tonight"` section:
```json
"mood_default": "Mejor",
"mood_comfort": "Confort",
"mood_adventure": "Aventura",
"mood_impress": "Impresionar"
```

In `es.json`, add to the existing `"ranking"` section:
```json
"trend_title": "Tu tendencia",
"trend_protein": "Proteína dominante",
"trend_cuisine": "Cocina dominante",
"trend_cooks_month": "cocinados este mes",
"diversity_title": "Diversidad de sabores",
"diversity_try": "Prueba también"
```

In `en.json`, add to the existing `"tonight"` section:
```json
"mood_default": "Best",
"mood_comfort": "Comfort",
"mood_adventure": "Adventure",
"mood_impress": "Impress"
```

In `en.json`, add to the existing `"ranking"` section:
```json
"trend_title": "Your trend",
"trend_protein": "Top protein",
"trend_cuisine": "Top cuisine",
"trend_cooks_month": "cooks this month",
"diversity_title": "Flavor diversity",
"diversity_try": "Try adding"
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/valentin/code/ephemeral-cuisine && npm test -- --no-coverage 2>&1 | tail -8
```

Expected: all tests passing.

- [ ] **Step 3: Build**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit and push**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add public/assets/i18n/ && git commit -m "feat(i18n): add mood and trend/diversity keys for phase 4 inspiration features" && git push
```

---

## Self-Review

**Spec coverage:**

| Phase 4 requirement | Task |
|---|---|
| Mood-aware suggestion (comfort/adventure/impress) | Tasks 2, 3 |
| Flavor outcome prediction | Tasks 1, 3 |
| "What's my current trend?" dashboard | Tasks 4, 5 |
| Flavor diversity dashboard | Tasks 4, 5 |
| New ingredient onboarding | Task 6 |
| Prep debt calculator | Task 6 |
| Menu → Inspiration (OCR) | Not implemented — requires external image OCR API |
| Progressive complexity ladder | Not implemented — depends on technique progression data not yet in schema |

**Placeholder scan:** None — all tasks have complete code.

**Type consistency:**
- `MoodFilter` exported from `suggestion.service.ts`, imported in tonight component
- `ScoredRecipe` gains `avgSelfRating` and `avgFamilyRating` — the `sortByMood` tests use them
- `CookTrend` and `FlavorDiversity` exported from `ranking.model.ts`, imported in `ranking.service.ts`
- `RankingData` in `ranking.service.ts` uses `CookTrend` and `FlavorDiversity` from model (consistent)
- `predictFlavors` takes `string[]` (ingredient names) in both spec and tonight component
- `computeTrend` second argument accepts `Array<{id: string; cuisine_type?: string}>` (Recipe-compatible)
