# Shopping Gap Detector — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Show a motivational "almost there" badge on the Tonight suggestion card when the user is missing ≤ 3 ingredients. No new queries, no model changes.

---

## 1. Problem Statement

The Tonight card already shows which inventory items the user has ("Tienes: pollo, limón"). It does not tell the user what they're *missing*. When a user is only 1–2 ingredients away from being able to cook a recipe, this is a strong motivational signal — but currently invisible.

---

## 2. Approach

Pure computed signal in `TonightPageComponent`. All required data is already present in `ScoredRecipe.matchedInventoryItems` (loaded by `SuggestionService`) and `ScoredRecipe.recipe.ingredients`. Zero new Supabase queries, zero changes to `SuggestionService` or `ScoredRecipe`.

---

## 3. Logic

**File:** `src/app/features/tonight/tonight-page.component.ts`

Add one computed signal:

```typescript
missingCount = computed(() =>
  Math.max(0, (this.current()?.recipe.ingredients.length ?? 0) -
               (this.current()?.matchedInventoryItems.length ?? 0))
);
```

**Known limitation (documented, not fixed):** `matchedInventoryItems` counts inventory *items* that matched at least one recipe ingredient via substring, not recipe ingredients covered 1:1. In practice this is accurate enough for the motivational use case. `Math.max(0, ...)` guards the edge case where fuzzy matching causes `matchedInventoryItems.length` to exceed `recipe.ingredients.length`.

**Display rule:** show only when `missingCount() >= 1 && missingCount() <= 3`. Gap = 0 is already covered by the "Tienes: X" line. Gap > 3 is noise.

---

## 4. Template

**File:** `src/app/features/tonight/tonight-page.component.html`

Insert immediately after the existing `@if (current()!.matchedInventoryItems.length > 0)` block and before the substitutions block — so inventory info stays grouped (what you have + what you're missing) and contiguous:

```html
@if (missingCount() === 1) {
  <p class="text-sm text-amber-600 font-medium mb-1">
    {{ 'tonight.missing_one' | translate }}
  </p>
} @else if (missingCount() <= 3) {
  <p class="text-sm text-amber-600 font-medium mb-1">
    {{ 'tonight.missing_n' | translate: { n: missingCount() } }}
  </p>
}
```

Amber (`text-amber-600`) matches the predicted rating chip — "almost there" tone, not alarming red.

---

## 5. i18n

**Files:** `public/assets/i18n/es.json`, `public/assets/i18n/en.json`

Add inside the existing `"tonight"` section:

| Key | ES | EN |
|---|---|---|
| `tonight.missing_one` | `🛒 Solo te falta 1 ingrediente` | `🛒 Just 1 ingredient to go` |
| `tonight.missing_n` | `🛒 Solo te faltan {{n}} ingredientes` | `🛒 Just {{n}} ingredients to go` |

---

## 6. Testing

The `missingCount` computed depends on `current()` which is a signal — unit testing via the Angular `TestBed` would require mocking signals. Since the logic is a single `Math.max(0, a - b)` expression, the meaningful test is an integration check: verify the chip renders when `missingCount` is 1, 2, or 3, and does not render when 0 or > 3.

Test cases to cover in `tonight-page.component.spec.ts` (or equivalent):

| Scenario | `ingredients.length` | `matchedItems.length` | Expected |
|---|---|---|---|
| Gap = 0 (has everything) | 5 | 5 | No chip |
| Gap = 1 | 5 | 4 | `missing_one` chip |
| Gap = 2 | 5 | 3 | `missing_n` chip with n=2 |
| Gap = 3 | 5 | 2 | `missing_n` chip with n=3 |
| Gap = 4 (too many) | 5 | 1 | No chip |
| Fuzzy over-match guard | 3 | 5 | No chip (clamped to 0) |

---

## 7. File Map

**Modified files:**
- `src/app/features/tonight/tonight-page.component.ts` — add `missingCount` computed signal
- `src/app/features/tonight/tonight-page.component.html` — add chip between "Tienes" and equipment blocks
- `public/assets/i18n/es.json` — add `tonight.missing_one`, `tonight.missing_n`
- `public/assets/i18n/en.json` — add `tonight.missing_one`, `tonight.missing_n`

**New files:** none  
**Unchanged:** `SuggestionService`, `ScoredRecipe`, all other components, Supabase schema.

---

## 8. Out of Scope

- Showing gap on recipe-detail (independent future change)
- Listing *which* ingredients are missing by name (gap ≤ 3 names would require iterating ingredients vs inventory — separate feature)
- Shopping list generation
- Push notifications for missing ingredients
