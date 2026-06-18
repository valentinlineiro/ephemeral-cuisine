# Multi-Dish Timeline — Design Spec

**Date:** 2026-06-18
**Status:** Approved
**Scope:** Orchestrate multiple dishes to finish at the same time — setup, schedule generation, real-time alerts

---

## 1. Problem Statement

When cooking multiple dishes for a meal, the user must mentally calculate when to start each one so everything finishes together. This is error-prone and stressful. The timeline feature removes that mental load: the user says "I want to eat at 20:30" and the app tells them exactly when to start each dish, then alerts them in real time.

---

## 2. Entry Point

A "🍽️ Varios platos" button on the Tonight screen, placed below the suggestion card. Tapping it opens the `MultiDishTimelineComponent` as a full-screen overlay (same pattern as `PostCookFlowComponent` — `fixed inset-0`).

---

## 3. Data Model

**File:** `src/app/features/timeline/timeline.model.ts`

```typescript
export interface DishEntry {
  id: string;           // crypto.randomUUID()
  name: string;
  cookMinutes: number;
  recipeId?: string;    // present when added from recipe library
}

export type SlotStatus = 'pending' | 'alert' | 'started';

export interface TimelineSlot {
  dish: DishEntry;
  startAt: Date;        // targetTime minus cookMinutes
  status: SlotStatus;
}
```

### `buildTimeline(dishes, targetTime)`

Pure function. Input: `DishEntry[]` + `Date`. Output: `TimelineSlot[]`.

Algorithm:
1. Sort dishes by `cookMinutes` descending (longest first)
2. For each dish: `startAt = targetTime - cookMinutes minutes`
3. Return slots with `status: 'pending'`

Constraints:
- Dishes with the same `cookMinutes` keep their insertion order
- If `startAt` is in the past (dish takes longer than time until target), it is still included — the user chose the time, they may be starting late intentionally

---

## 4. Component States

`MultiDishTimelineComponent` has three internal states driven by a `phase` signal: `'setup' | 'active' | 'done'`.

### 4.1 Setup Phase

The user builds their dish list and sets the target time.

**Target time input:**
- HH:MM text input, default = now + 45 minutes, rounded to the nearest 5 minutes
- Stored as a `string` signal (`targetTimeStr`), parsed to `Date` on submit
- **Validation on submit:** must match `^\d{2}:\d{2}$`, hours 00–23, minutes 00–59. If invalid, a `targetTimeError` signal is set and an inline error message is shown below the field. The "Generar" button remains disabled while `targetTimeError` is non-null.

**Adding dishes — two modes:**

*From library:* A text search input filters recipes by name (client-side, no new service call needed — uses existing `RecipeService.getAll()` loaded once). Selecting a recipe creates a `DishEntry` with `name = recipe.name` and `cookMinutes = recipe.cook_time ?? recipe.total_time ?? 30`. The search closes after selection.

*Manual:* Two fields — dish name (text) + cook time (number, minutes). An "Add" button appends the entry. Minimum 1 minute.

**Dish list:** Each entry shows name, cook time in minutes, and a delete button. Minimum 2 dishes required to generate timeline (enforced by disabling the "Generar" button).

**"Generar timeline" button:** Calls `buildTimeline()`, sets `slots` signal, transitions to `active`.

### 4.2 Active Phase

Real-time orchestration view.

**Layout:** Vertical list of `TimelineSlot` items ordered by `startAt` ascending. Each slot shows:
- Dish name
- Formatted start time (HH:MM)
- Countdown: "en X min" (recalculated on each tick)
- Status indicator

**Tick mechanism:** `setInterval` every 15 seconds. On each tick:
- For each slot with `status === 'pending'`: if `Date.now() >= slot.startAt.getTime()` → set status to `'alert'`
- Recalculate countdown displays

*Note: a 15s interval means an alert can appear up to 15 seconds late. This is an accepted tradeoff — real-time precision is not required for cooking orchestration, and 15s is imperceptible in practice.*

**Alert state:** When a slot reaches `alert`, a sticky banner appears at the top of the screen:
> "¡Empieza [nombre] ahora!"

The banner stays visible until the user taps it → slot transitions to `'started'`, banner dismisses.

Only one alert banner shown at a time. If multiple slots reach their `startAt` simultaneously, they queue: the next banner appears after the user dismisses the current one.

**Transition to Done:** When all slots are `'started'`, automatically transition to `done` phase.

**Interval cleanup:** `clearInterval` on `ngOnDestroy`.

### 4.3 Done Phase

Shows a completion message: "Todo en marcha 🎉 · Todo listo a las [targetTime]". A "Cerrar" button emits `done` output and the Tonight page hides the overlay.

---

## 5. Integration — Tonight Page

**`tonight-page.component.ts`:**
- Add `showTimeline = signal(false)`
- Add `timelineRecipes = signal<Recipe[]>([])`
- Add `openTimeline()` method: loads recipes lazily on first tap via `RecipeService.search({})` (only if `timelineRecipes()` is empty), then sets `showTimeline(true)`. Subsequent opens reuse the cached signal.

**`tonight-page.component.html`:**
- Button below the suggestion card: `(click)="openTimeline()"`
- `@if (showTimeline())` wraps `<app-multi-dish-timeline [recipes]="timelineRecipes()" (done)="showTimeline.set(false)" />`

The `MultiDishTimelineComponent` receives `recipes` as an input to avoid re-fetching. Recipes are **not** loaded on Tonight page mount — only on first tap of the button.

---

## 6. i18n Keys

13 keys added to both `es.json` and `en.json` under a `"timeline"` section:

| Key | ES | EN |
|---|---|---|
| `title` | Varios platos | Multiple dishes |
| `target_time` | ¿A qué hora quieres cenar? | What time do you want to eat? |
| `add_from_library` | Buscar receta | Search recipe |
| `add_manual` | Añadir manualmente | Add manually |
| `dish_name` | Nombre del plato | Dish name |
| `minutes` | minutos | minutes |
| `add` | Añadir | Add |
| `generate` | Generar timeline | Generate timeline |
| `starts_at` | Empieza a las | Starts at |
| `in_x_min` | en {{min}} min | in {{min}} min |
| `alert_banner` | ¡Empieza {{name}} ahora! | Start {{name}} now! |
| `all_started` | Todo en marcha 🎉 · Todo listo a las {{time}} | All started 🎉 · Everything ready at {{time}} |
| `close` | Cerrar | Close |

---

## 7. File Map

**New files:**
- `src/app/features/timeline/timeline.model.ts`
- `src/app/features/timeline/timeline.model.spec.ts`
- `src/app/features/timeline/multi-dish-timeline.component.ts`
- `src/app/features/timeline/multi-dish-timeline.component.html`

**Modified files:**
- `src/app/features/tonight/tonight-page.component.ts`
- `src/app/features/tonight/tonight-page.component.html`
- `public/assets/i18n/es.json`
- `public/assets/i18n/en.json`

**Unchanged:** Supabase schema, routing, auth, all other components.

---

## 8. Testing

`timeline.model.spec.ts` covers:
- `buildTimeline` sorts by `cookMinutes` descending
- `startAt` equals `targetTime - cookMinutes`
- All slots start with `status: 'pending'`
- Single dish produces one slot
- Dishes with identical cook times keep insertion order
- `buildTimeline` with empty array returns empty array

No component tests — the component is a thin orchestration shell over the pure model function. Build verification is sufficient.

---

## 9. Out of Scope

- Push notifications / OS alerts (requires service worker setup)
- Persisting timeline sessions to Supabase
- Linking timeline dishes to the post-cook flow
- Multi-dish timeline accessible from anywhere other than Tonight
