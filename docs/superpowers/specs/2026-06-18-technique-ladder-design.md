# Technique Complexity Ladder — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Surface existing mastery data on the Techniques page and show a keyword-based "next step" nudge when a technique reaches B+ mastery. No new Supabase schema, no new UI components.

---

## 1. Problem Statement

`TechniqueWithStats`, `calcMastery`, and `MASTERY_COLOR` already exist, but the Techniques page only loads `Technique[]` — mastery grade and cook count are computed but never shown. The page is a static list with no signal of progress or next challenge.

---

## 2. Approach

Three changes, no new files:

1. **`TechniqueService.getTechniquesWithStats()`** — batch method: 2 queries total (techniques + cooked_versions), computes stats in memory, replacing the current `getTechniques()` call in the page.
2. **`getNextStep()` + `NEXT_STEP_TABLE`** in `technique.model.ts` — pure function, static keyword→suggestion table, returns null when mastery < B+ or name doesn't match.
3. **Techniques page** — display mastery grade (color-coded), cook count, and nudge badge per technique.

---

## 3. Batch Data Loading

**File:** `src/app/features/techniques/technique.service.ts`

```typescript
async getTechniquesWithStats(): Promise<TechniqueWithStats[]> {
  const [techRes, cooksRes] = await Promise.all([
    this.supabase.client.from('techniques').select('*').order('name', { ascending: true }),
    this.supabase.client.from('cooked_versions').select('technique_id, ratings'),
  ]);
  const techniques: Technique[] = techRes.data ?? [];
  const cooks: Array<{ technique_id: string | null; ratings: Record<string, number> }> = cooksRes.data ?? [];

  return techniques.map(t => {
    const tc = cooks.filter(c => c.technique_id === t.id);
    const selfRatings = tc.map(c => c.ratings?.['self'] ?? 0).filter(r => r > 0);
    const cook_count = tc.length;
    const avg_rating = selfRatings.length
      ? selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length
      : 0;
    return { ...t, cook_count, avg_rating, mastery: calcMastery(cook_count, avg_rating) };
  });
}
```

Order: `name ASC` — consistent with current `getTechniques()`. Select: `technique_id, ratings` only — no unused columns.

---

## 4. Pure Function: `getNextStep()`

**File:** `src/app/features/techniques/technique.model.ts`

Append to the existing file after `MASTERY_COLOR`:

```typescript
const NUDGE_GRADES = new Set<MasteryGrade>(['B+', 'A-', 'A', 'A+']);

const NEXT_STEP_TABLE: Array<{ keyword: string; next: string }> = [
  { keyword: 'stir-fry',  next: 'Wok hei technique' },
  { keyword: 'sushi',     next: 'Inside-out roll (uramaki)' },
  { keyword: 'pasta',     next: 'Fresh pasta from scratch' },
  { keyword: 'roast',     next: 'Spatchcock & dry brine' },
  { keyword: 'grill',     next: 'Reverse sear' },
  { keyword: 'baking',    next: 'Laminated dough' },
  { keyword: 'omelette',  next: 'French omelette' },
  { keyword: 'pan sauce', next: 'Beurre blanc' },
  { keyword: 'brais',     next: 'Pressure cooking' },
  { keyword: 'knife',     next: 'Brunoise & chiffonade' },
];

export function getNextStep(techniqueName: string, mastery: MasteryGrade): string | null {
  if (!NUDGE_GRADES.has(mastery)) return null;
  const lower = techniqueName.toLowerCase();
  return NEXT_STEP_TABLE.find(e => lower.includes(e.keyword))?.next ?? null;
}
```

**Threshold:** B+ or higher (cook_count ≥ 5 + avg ≥ 9). Below that: no nudge.

**Known limitation:** matching is unidirectional (`techniqueName.includes(keyword)`). "Stir fry" (no hyphen) won't match "stir-fry". Acceptable for MVP — same documented tradeoff as `extractProtein`'s substring matching.

**No nudge shown** when the technique name contains no matching keyword — by design; the feature degrades silently.

---

## 5. Techniques Page

**File:** `src/app/features/techniques/techniques-page/techniques-page.component.ts`

Changes:
- Import `TechniqueWithStats`, `MASTERY_COLOR`, `getNextStep`, `MasteryGrade` from `technique.model`
- Change `techniques = signal<Technique[]>([])` → `signal<TechniqueWithStats[]>([])`
- Replace `this.techniqueService.getTechniques()` call in `load()` with `getTechniquesWithStats()`
- Add two protected helpers:

```typescript
protected masteryColor = (m: MasteryGrade): string => MASTERY_COLOR[m];
protected nextStep = (t: TechniqueWithStats): string | null => getNextStep(t.name, t.mastery);
```

**File:** `src/app/features/techniques/techniques-page/techniques-page.component.html`

In the technique list item, **replace** the existing `{{ t.skill_level }}` display with the mastery chip + cook count + nudge. `skill_level` is a static self-declaration; mastery is computed from actual cook history and is strictly more informative. Result: 1–2 lines per card (not 3–4).

```html
<span [class]="'text-xs font-bold ' + masteryColor(t.mastery)">{{ t.mastery }}</span>
<span class="text-xs text-gray-400">{{ t.cook_count }} {{ 'techniques.cooks' | translate }}</span>

@if (nextStep(t)) {
  <p class="text-xs text-indigo-600 font-medium mt-1">
    {{ 'techniques.next_step' | translate }}: {{ nextStep(t) }}
  </p>
}
```

New techniques with 0 cooks display `F  0 cocciones` — the red F acts as a motivator to start cooking.
```

---

## 6. i18n

**Files:** `public/assets/i18n/es.json`, `public/assets/i18n/en.json`

Add inside the existing `"techniques"` section:

| Key | ES | EN |
|---|---|---|
| `techniques.cooks` | `cocciones` | `cooks` |
| `techniques.next_step` | `Prueba después` | `Try next` |

"cocciones" is the correct culinary Spanish term. "cooks" is acceptable as an English cooking noun.

---

## 7. Testing

`getNextStep()` is a pure function — test in `technique.model.ts`'s existing spec file (or a new `technique.model.spec.ts`).

| Test | Input | Expected |
|---|---|---|
| Below threshold returns null | `('stir-fry', 'B')` | `null` |
| At threshold B+ returns suggestion | `('stir-fry', 'B+')` | `'Wok hei technique'` |
| A grade returns suggestion | `('sushi roll', 'A')` | `'Inside-out roll (uramaki)'` |
| No keyword match returns null | `('tagine', 'A+')` | `null` |
| Case-insensitive | `('Stir-Fry', 'A')` | `'Wok hei technique'` |
| Partial match (brais) | `('braising', 'B+')` | `'Pressure cooking'` |
| F grade returns null | `('pasta', 'F')` | `null` |

`getTechniquesWithStats()` — test in `technique.service.spec.ts`:

| Test | Scenario | Expected |
|---|---|---|
| Empty techniques | No techniques in DB | `[]` |
| cook_count computed | 2 cooks linked to technique | `cook_count = 2` |
| avg_rating computed | cooks with self ratings 8, 10 | `avg_rating = 9` |
| mastery computed | cook_count=5, avg=9 | `mastery = 'B+'` |
| Unlinked cooks ignored | cook with technique_id null | not counted |

---

## 8. File Map

**Modified files:**
- `src/app/features/techniques/technique.model.ts` — add `NEXT_STEP_TABLE`, `NUDGE_GRADES`, `getNextStep()`
- `src/app/features/techniques/technique.service.ts` — add `getTechniquesWithStats()`
- `src/app/features/techniques/techniques-page/techniques-page.component.ts` — use `TechniqueWithStats`, add helpers
- `src/app/features/techniques/techniques-page/techniques-page.component.html` — mastery chip + cook count + nudge badge
- `public/assets/i18n/es.json` — add `techniques.cooks`, `techniques.next_step`
- `public/assets/i18n/en.json` — add `techniques.cooks`, `techniques.next_step`

**New files:** none  
**Unchanged:** Supabase schema, routing, all other components.

---

## 9. Out of Scope

- Generalizing the Dessert Bootcamp to other categories
- Allowing users to define their own progression paths
- Showing next-step nudge on recipe-detail or Tonight
- Internationalization of the `next` values in `NEXT_STEP_TABLE` (English-only for MVP)
