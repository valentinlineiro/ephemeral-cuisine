# Predictive Combo Rating — Design Spec

**Date:** 2026-06-18
**Status:** Approved
**Scope:** Predict how the user will rate a recipe suggestion based on cook history with similar protein + cuisine combos. Shown as a chip on the Tonight suggestion card.

---

## 1. Problem Statement

The Tonight screen shows one recipe suggestion. The user has no quick signal for whether they'll enjoy it based on past experience. A predicted rating ("~8.5 ⭐ predicho") from similar previous cooks gives them that signal at a glance — without requiring them to navigate to recipe detail or ranking.

---

## 2. Approach

Pure function `predictRating()` in a new `combo-predictor.ts` file. `SuggestionService` already loads all `cooked_versions` and all `recipes` in a single `Promise.all` — no extra DB calls needed. A `Map<string, string | undefined>` (`recipe_id → cuisine_type`) built from the recipes array is passed to `scoreRecipe()`, which calls `predictRating()` to enrich each `ScoredRecipe` with `predictedRating: number | null`.

---

## 3. Pure Functions

**File:** `src/app/features/tonight/combo-predictor.ts`

### `extractProtein(ingredientNames: string[]): string | null`

Scans `ingredientNames` (lowercase) for a match against `PROTEIN_KEYS`. Returns the **first match** found — no tie-breaking logic, first occurrence wins. Returns `null` if no protein keyword is found (vegetarian/vegan dishes).

```typescript
const PROTEIN_KEYS = [
  'chicken', 'pollo',
  'salmon', 'salmón',
  'beef', 'ternera', 'carne',
  'pork', 'cerdo',
  'tofu',
  'shrimp', 'gambas',
  'tuna', 'atún', 'atun',
  'egg', 'huevo',
  'lamb', 'cordero',
  'cod', 'bacalao',
  'turkey', 'pavo',
];
```

### `predictRating(history, recipeCuisineMap, targetProtein, targetCuisineType, minSamples?): number | null`

```typescript
export function predictRating(
  history: CookedVersion[],
  recipeCuisineMap: Map<string, string | undefined>,
  targetProtein: string | null,
  targetCuisineType: string | undefined,
  minSamples = 2,
): number | null
```

**Algorithm:**
1. If `targetProtein` is null → return null immediately (no protein to match against)
2. Filter `history` to build a similarity pool:
   - **Protein match:** `cook.combo.protein` and `targetProtein` match if either contains the other (case-insensitive). Cooks with empty `combo.protein` are excluded.
   - **Cuisine match:** if `targetCuisineType` is defined, `recipeCuisineMap.get(cook.recipe_id)` must equal `targetCuisineType`. If `targetCuisineType` is undefined, the cuisine filter is **skipped entirely** (any cuisine qualifies).
3. If `pool.length < minSamples` → return null
4. Return `Math.round((sum of pool[i].ratings?.['self'] ?? 0) / pool.length * 10) / 10` (1 decimal) — consistent with how `scoreRecipe()` handles ratings in `suggestion.service.ts`

**Known limitations (documented, not fixed):**
- Substring matching can produce false positives for compound protein strings (e.g., `"pollo y chorizo"` matches `"pollo"`). Acceptable for MVP given typical combo.protein entries are single-word.
- Cooks with `recipe_id === null` are excluded when `targetCuisineType` is defined (no map entry → cuisine mismatch). When `targetCuisineType` is undefined, they are included if protein matches — this is intentional: technique-only cooks can still inform protein preference.
- O(recipes × cooks) per `getSuggestions()` call. Imperceptible at < 500 each.

---

## 4. SuggestionService Changes

**`ScoredRecipe` interface** — add one field:
```typescript
predictedRating: number | null;
```

**`getSuggestions()`** — after building `ratingsByRecipe`, build:
```typescript
const recipeCuisineMap = new Map(recipes.map(r => [r.id, r.cuisine_type]));
```
Pass `recipeCuisineMap` and `cooks` to `scoreRecipe()`.

**`scoreRecipe()`** — at the end, before returning:
```typescript
const targetProtein = extractProtein((recipe.ingredients ?? []).map((i: any) => i.name.toLowerCase()));
const predictedRating = predictRating(cooks, recipeCuisineMap, targetProtein, recipe.cuisine_type);
return { ..., predictedRating };
```

`cooks` (the full `CookedVersion[]`) and `recipeCuisineMap` are added as parameters to `scoreRecipe()`.

---

## 5. UI — Tonight Suggestion Card

**Location:** Below the recipe name, above the flavor tag strip, inside the existing suggestion card.

**Condition:** Only rendered when `current()!.predictedRating !== null`.

```html
@if (current()!.predictedRating !== null) {
  <p class="text-sm text-amber-600 font-medium mb-1">
    {{ 'tonight.predicted_rating' | translate: { rating: current()!.predictedRating } }}
  </p>
}
```

**i18n key:**

| Key | ES | EN |
|---|---|---|
| `tonight.predicted_rating` | `~{{rating}} ⭐ predicho` | `~{{rating}} ⭐ predicted` |

---

## 6. Testing

**`combo-predictor.spec.ts`** covers `predictRating` and `extractProtein`:

| Test | Expected |
|---|---|
| `extractProtein([])` | null |
| `extractProtein(['tomato', 'onion'])` | null (no protein) |
| `extractProtein(['chicken', 'garlic'])` | `'chicken'` |
| `extractProtein(['tofu', 'avocado'])` | `'tofu'` |
| `predictRating([], ...)` | null |
| 1 matching cook | null (below minSamples=2) |
| 2 matching cooks, ratings 8 and 9 | 8.5 |
| protein mismatch → excluded from pool | null |
| cuisine mismatch → excluded from pool | null |
| `targetCuisineType` undefined → cuisine filter skipped | matches across cuisines |
| `targetProtein` null → null immediately | null |
| `recipe_id === null` cook, `targetCuisineType` defined → excluded | excluded |

---

## 7. File Map

**New files:**
- `src/app/features/tonight/combo-predictor.ts`
- `src/app/features/tonight/combo-predictor.spec.ts`

**Modified files:**
- `src/app/features/tonight/suggestion.service.ts` — `ScoredRecipe` + `scoreRecipe` + `getSuggestions`
- `src/app/features/tonight/tonight-page.component.html` — predicted rating chip
- `public/assets/i18n/es.json` — `tonight.predicted_rating`
- `public/assets/i18n/en.json` — `tonight.predicted_rating`

**Unchanged:** Supabase schema, routing, all other components.

---

## 8. Out of Scope

- Tokenizing combo.protein to avoid false positives on compound strings
- Weighting recent cooks more heavily than older ones
- Showing predicted rating anywhere other than the Tonight card
- Persisting predictions to DB
