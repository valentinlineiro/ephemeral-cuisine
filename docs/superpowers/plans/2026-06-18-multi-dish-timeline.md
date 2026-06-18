# Multi-Dish Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-dish timeline orchestrator to the Tonight screen that calculates start times for multiple dishes and alerts the user in real time when each one should begin.

**Architecture:** Pure model function (`buildTimeline`) in a new `timeline/` feature folder; thin `MultiDishTimelineComponent` that orchestrates setup → active → done phases using Angular signals and a 15s `setInterval`; wired into the Tonight page as a full-screen overlay triggered by a "Varios platos" button. No Supabase changes.

**Tech Stack:** Angular 18 signals, `setInterval`, `FormsModule`, `TranslatePipe`, `RecipeService.search({})` for lazy library load, Tailwind CSS.

## Global Constraints

- Angular standalone components only — no NgModules
- Use `signal()` / `computed()` / `input()` / `output()` — no `@Input`/`@Output` decorators
- All i18n strings via `TranslatePipe` — no hardcoded UI text except placeholder examples
- TDD for pure functions; build verification for components
- `RecipeService` is injected via constructor DI — do not use `inject()`
- `crypto.randomUUID()` for generating dish IDs
- `setInterval` returns `ReturnType<typeof setInterval>` for type safety

---

### Task 1: Pure model + unit tests

**Files:**
- Create: `src/app/features/timeline/timeline.model.ts`
- Create: `src/app/features/timeline/timeline.model.spec.ts`

**Interfaces:**
- Produces: `DishEntry`, `SlotStatus`, `TimelineSlot`, `buildTimeline(dishes: DishEntry[], targetTime: Date): TimelineSlot[]`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/timeline/timeline.model.spec.ts
import { buildTimeline, DishEntry } from './timeline.model';

function makeDish(name: string, cookMinutes: number, id = name): DishEntry {
  return { id, name, cookMinutes };
}

describe('buildTimeline', () => {
  const target = new Date('2026-06-18T20:30:00');

  it('returns empty array for empty input', () => {
    expect(buildTimeline([], target)).toEqual([]);
  });

  it('produces one slot for a single dish', () => {
    const slots = buildTimeline([makeDish('Chicken', 35)], target);
    expect(slots.length).toBe(1);
    expect(slots[0].dish.name).toBe('Chicken');
  });

  it('sets startAt = targetTime minus cookMinutes', () => {
    const slots = buildTimeline([makeDish('Rice', 20)], target);
    const expected = new Date(target.getTime() - 20 * 60_000);
    expect(slots[0].startAt.getTime()).toBe(expected.getTime());
  });

  it('all slots start with status pending', () => {
    const slots = buildTimeline([makeDish('A', 10), makeDish('B', 20)], target);
    expect(slots.every(s => s.status === 'pending')).toBe(true);
  });

  it('sorts by cookMinutes descending — longest first', () => {
    const dishes = [makeDish('Salad', 5), makeDish('Chicken', 35), makeDish('Rice', 20)];
    const slots = buildTimeline(dishes, target);
    expect(slots[0].dish.name).toBe('Chicken');
    expect(slots[1].dish.name).toBe('Rice');
    expect(slots[2].dish.name).toBe('Salad');
  });

  it('dishes with equal cookMinutes keep insertion order', () => {
    const dishes = [makeDish('A', 20, 'a'), makeDish('B', 20, 'b'), makeDish('C', 20, 'c')];
    const slots = buildTimeline(dishes, target);
    expect(slots.map(s => s.dish.id)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="timeline.model" --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './timeline.model'`

- [ ] **Step 3: Implement the model**

```typescript
// src/app/features/timeline/timeline.model.ts
export interface DishEntry {
  id: string;
  name: string;
  cookMinutes: number;
  recipeId?: string;
}

export type SlotStatus = 'pending' | 'alert' | 'started';

export interface TimelineSlot {
  dish: DishEntry;
  startAt: Date;
  status: SlotStatus;
}

export function buildTimeline(dishes: DishEntry[], targetTime: Date): TimelineSlot[] {
  return [...dishes]
    .sort((a, b) => b.cookMinutes - a.cookMinutes)
    .map(dish => ({
      dish,
      startAt: new Date(targetTime.getTime() - dish.cookMinutes * 60_000),
      status: 'pending' as SlotStatus,
    }));
}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx jest --testPathPattern="timeline.model" --no-coverage 2>&1 | tail -6
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/timeline/timeline.model.ts src/app/features/timeline/timeline.model.spec.ts && git commit -m "feat(timeline): add buildTimeline pure function with unit tests"
```

---

### Task 2: MultiDishTimelineComponent

**Files:**
- Create: `src/app/features/timeline/multi-dish-timeline.component.ts`
- Create: `src/app/features/timeline/multi-dish-timeline.component.html`

**Interfaces:**
- Consumes: `DishEntry`, `TimelineSlot`, `buildTimeline` from `./timeline.model`; `Recipe` from `../recipes/models/recipe.model`
- Produces: `MultiDishTimelineComponent` with `recipes = input<Recipe[]>([])` and `done = output<void>()`

- [ ] **Step 1: Create the component TypeScript**

```typescript
// src/app/features/timeline/multi-dish-timeline.component.ts
import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../recipes/models/recipe.model';
import { DishEntry, TimelineSlot, buildTimeline } from './timeline.model';

type Phase = 'setup' | 'active' | 'done';

@Component({
  selector: 'app-multi-dish-timeline',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './multi-dish-timeline.component.html',
})
export class MultiDishTimelineComponent implements OnInit, OnDestroy {
  recipes = input<Recipe[]>([]);
  done = output<void>();

  phase = signal<Phase>('setup');

  // Setup state
  targetTimeStr = signal('');
  targetTimeError = signal<string | null>(null);
  targetTime = signal<Date | null>(null);
  dishes = signal<DishEntry[]>([]);

  // Library search
  libraryQuery = signal('');
  showLibrary = signal(false);
  filteredRecipes = computed(() => {
    const q = this.libraryQuery().toLowerCase().trim();
    const all = this.recipes();
    return (q ? all.filter(r => r.name.toLowerCase().includes(q)) : all).slice(0, 8);
  });

  // Manual add
  manualName = signal('');
  manualMinutes = signal(20);

  // Active state
  slots = signal<TimelineSlot[]>([]);
  currentAlert = computed(() => this.slots().find(s => s.status === 'alert') ?? null);
  countdowns = signal<Record<string, number>>({});

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const d = new Date(Date.now() + 45 * 60_000);
    const rawMin = d.getMinutes();
    const rounded = Math.round(rawMin / 5) * 5;
    if (rounded >= 60) {
      d.setHours(d.getHours() + 1);
      d.setMinutes(0);
    } else {
      d.setMinutes(rounded);
    }
    this.targetTimeStr.set(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  }

  ngOnDestroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  get canGenerate(): boolean {
    return this.dishes().length >= 2 && this.targetTimeError() === null;
  }

  addFromLibrary(recipe: Recipe): void {
    const dish: DishEntry = {
      id: crypto.randomUUID(),
      name: recipe.name,
      cookMinutes: recipe.cook_time ?? recipe.total_time ?? 30,
      recipeId: recipe.id,
    };
    this.dishes.update(d => [...d, dish]);
    this.libraryQuery.set('');
    this.showLibrary.set(false);
  }

  addManual(): void {
    const name = this.manualName().trim();
    if (!name || this.manualMinutes() < 1) return;
    this.dishes.update(d => [...d, { id: crypto.randomUUID(), name, cookMinutes: this.manualMinutes() }]);
    this.manualName.set('');
    this.manualMinutes.set(20);
  }

  removeDish(id: string): void {
    this.dishes.update(d => d.filter(dish => dish.id !== id));
  }

  generate(): void {
    const str = this.targetTimeStr();
    if (!/^\d{2}:\d{2}$/.test(str)) {
      this.targetTimeError.set('invalid');
      return;
    }
    const [h, m] = str.split(':').map(Number);
    if (h > 23 || m > 59) {
      this.targetTimeError.set('invalid');
      return;
    }
    this.targetTimeError.set(null);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    this.targetTime.set(target);
    this.slots.set(buildTimeline(this.dishes(), target));
    this.phase.set('active');
    this.startTick();
  }

  private startTick(): void {
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 15_000);
  }

  private tick(): void {
    const now = Date.now();
    this.slots.update(slots =>
      slots.map(s =>
        s.status === 'pending' && now >= s.startAt.getTime()
          ? { ...s, status: 'alert' as const }
          : s
      )
    );
    const cd: Record<string, number> = {};
    for (const s of this.slots()) {
      cd[s.dish.id] = Math.max(0, Math.round((s.startAt.getTime() - Date.now()) / 60_000));
    }
    this.countdowns.set(cd);
    if (this.slots().length > 0 && this.slots().every(s => s.status === 'started')) {
      if (this.tickInterval) clearInterval(this.tickInterval);
      this.phase.set('done');
    }
  }

  dismissAlert(slot: TimelineSlot): void {
    this.slots.update(slots =>
      slots.map(s => s.dish.id === slot.dish.id ? { ...s, status: 'started' as const } : s)
    );
    if (this.slots().every(s => s.status === 'started')) {
      if (this.tickInterval) clearInterval(this.tickInterval);
      this.phase.set('done');
    }
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  close(): void {
    this.done.emit();
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/features/timeline/multi-dish-timeline.component.html -->
<div class="fixed inset-0 bg-white z-50 overflow-y-auto">
  <div class="p-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">

    <!-- Alert banner — sticky, one at a time -->
    @if (phase() === 'active' && currentAlert()) {
      <div class="sticky top-0 bg-orange-500 text-white rounded-xl p-4 flex items-center justify-between shadow-lg z-10 cursor-pointer"
           (click)="dismissAlert(currentAlert()!)">
        <p class="font-bold text-base">{{ 'timeline.alert_banner' | translate: { name: currentAlert()!.dish.name } }}</p>
        <span class="text-2xl font-bold ml-4">✓</span>
      </div>
    }

    <h1 class="text-2xl font-bold text-gray-900">{{ 'timeline.title' | translate }}</h1>

    <!-- ── SETUP PHASE ── -->
    @if (phase() === 'setup') {

      <!-- Target time -->
      <section class="flex flex-col gap-1">
        <label class="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {{ 'timeline.target_time' | translate }}
        </label>
        <input type="text" [ngModel]="targetTimeStr()"
          (ngModelChange)="targetTimeStr.set($event); targetTimeError.set(null)"
          placeholder="20:30"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none w-28" />
        @if (targetTimeError()) {
          <p class="text-red-600 text-xs mt-1">Formato inválido. Usa HH:MM (00:00 – 23:59)</p>
        }
      </section>

      <!-- Dish list -->
      @if (dishes().length > 0) {
        <section class="flex flex-col gap-2">
          @for (dish of dishes(); track dish.id) {
            <div class="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <span class="flex-1 text-sm font-medium text-gray-800">{{ dish.name }}</span>
              <span class="text-xs text-gray-400">{{ dish.cookMinutes }} min</span>
              <button (click)="removeDish(dish.id)" class="text-red-400 text-xs px-1">✕</button>
            </div>
          }
        </section>
      }

      <!-- Add from library -->
      <section class="flex flex-col gap-2">
        <button (click)="showLibrary.set(!showLibrary())"
          class="text-sm text-primary font-medium text-left">
          + {{ 'timeline.add_from_library' | translate }}
        </button>
        @if (showLibrary()) {
          <input type="text" [ngModel]="libraryQuery()" (ngModelChange)="libraryQuery.set($event)"
            placeholder="Buscar…"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
          <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
            @for (r of filteredRecipes(); track r.id) {
              <button (click)="addFromLibrary(r)"
                class="flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-left w-full">
                <span class="truncate">{{ r.name }}</span>
                <span class="text-xs text-gray-400 ml-2 shrink-0">{{ r.cook_time ?? r.total_time ?? 30 }} min</span>
              </button>
            }
          </div>
        }
      </section>

      <!-- Add manual -->
      <section class="flex flex-col gap-2">
        <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ 'timeline.add_manual' | translate }}</p>
        <div class="flex gap-2 items-center">
          <input type="text" [ngModel]="manualName()" (ngModelChange)="manualName.set($event)"
            [placeholder]="'timeline.dish_name' | translate"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
          <input type="number" [ngModel]="manualMinutes()" (ngModelChange)="manualMinutes.set(+$event)"
            min="1" max="480"
            class="w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-primary focus:outline-none" />
          <span class="text-xs text-gray-400 shrink-0">{{ 'timeline.minutes' | translate }}</span>
          <button (click)="addManual()"
            class="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shrink-0">
            {{ 'timeline.add' | translate }}
          </button>
        </div>
      </section>

      <button (click)="generate()" [disabled]="!canGenerate"
        class="bg-primary text-white rounded-lg py-4 font-bold text-lg disabled:opacity-40">
        {{ 'timeline.generate' | translate }}
      </button>

      <button (click)="close()" class="text-gray-400 text-sm text-center">
        {{ 'timeline.close' | translate }}
      </button>
    }

    <!-- ── ACTIVE PHASE ── -->
    @if (phase() === 'active') {
      <div class="flex flex-col gap-3">
        @for (slot of slots(); track slot.dish.id) {
          <div [class]="
            slot.status === 'started'
              ? 'flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 opacity-60'
              : slot.status === 'alert'
                ? 'flex items-center gap-3 bg-orange-50 border border-orange-300 rounded-xl p-4'
                : 'flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4'
          ">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 truncate">{{ slot.dish.name }}</p>
              <p class="text-sm text-gray-500">
                {{ 'timeline.starts_at' | translate }} {{ formatTime(slot.startAt) }}
                @if (slot.status === 'pending' && countdowns()[slot.dish.id] > 0) {
                  · {{ 'timeline.in_x_min' | translate: { min: countdowns()[slot.dish.id] } }}
                }
              </p>
            </div>
            @if (slot.status === 'started') {
              <span class="text-green-500 text-xl shrink-0">✓</span>
            } @else if (slot.status === 'alert') {
              <span class="text-orange-500 text-xl shrink-0 animate-pulse">⏰</span>
            }
          </div>
        }
      </div>

      <button (click)="close()" class="text-gray-400 text-sm text-center mt-2">
        {{ 'timeline.close' | translate }}
      </button>
    }

    <!-- ── DONE PHASE ── -->
    @if (phase() === 'done') {
      <div class="text-center py-8 flex flex-col gap-4">
        <p class="text-xl font-bold text-gray-900">
          {{ 'timeline.all_started' | translate: { time: formatTime(targetTime()!) } }}
        </p>
        <button (click)="close()"
          class="bg-primary text-white rounded-lg px-8 py-3 font-bold text-lg mx-auto">
          {{ 'timeline.close' | translate }}
        </button>
      </div>
    }

  </div>
</div>
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/timeline/ && git commit -m "feat(timeline): add MultiDishTimelineComponent with setup/active/done phases"
```

---

### Task 3: Tonight page integration + i18n + all tests + push

**Files:**
- Modify: `src/app/features/tonight/tonight-page.component.ts`
- Modify: `src/app/features/tonight/tonight-page.component.html`
- Modify: `public/assets/i18n/es.json`
- Modify: `public/assets/i18n/en.json`

**Interfaces:**
- Consumes: `MultiDishTimelineComponent` from `../timeline/multi-dish-timeline.component`; `RecipeService` from `../recipes/recipe.service`; `Recipe` from `../recipes/models/recipe.model`

- [ ] **Step 1: Update TonightPageComponent**

Replace the full file with:

```typescript
// src/app/features/tonight/tonight-page.component.ts
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe, MoodFilter } from './suggestion.service';
import { predictFlavors } from './flavor-predictor';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';
import { HealthService, WeeklySummary } from '../health/health.service';
import { sodiumColor, calorieColor } from '../health/health-color';
import { RecipeService } from '../recipes/recipe.service';
import { Recipe } from '../recipes/models/recipe.model';
import { MultiDishTimelineComponent } from '../timeline/multi-dish-timeline.component';

@Component({
  selector: 'app-tonight-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink, MultiDishTimelineComponent],
  templateUrl: './tonight-page.component.html',
})
export class TonightPageComponent implements OnInit {
  suggestions = signal<ScoredRecipe[]>([]);
  currentIndex = signal(0);
  loading = signal(true);
  expiringToday = signal<InventoryItem[]>([]);
  weeklySummary = signal<WeeklySummary | null>(null);
  profile = signal<DietaryProfile | null>(null);

  mood = signal<MoodFilter>('default');

  readonly moodOptions: Array<[MoodFilter, string]> = [
    ['default', '🎯'], ['comfort', '🛋️'], ['adventure', '✨'], ['impress', '⭐']
  ];

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  currentFlavors = computed(() => {
    const s = this.current();
    if (!s) return [];
    const names = [
      ...s.recipe.ingredients.map((i: any) => i.name),
      ...s.matchedInventoryItems.map(i => i.name),
    ];
    return predictFlavors(names);
  });

  // Timeline overlay
  showTimeline = signal(false);
  timelineRecipes = signal<Recipe[]>([]);

  protected getExpiryStatus = getExpiryStatus;
  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
    private healthService: HealthService,
    private recipeService: RecipeService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes, profile] = await Promise.all([
      this.suggestionService.getSuggestions(this.mood()),
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

    this.healthService.getWeeklySummary(profile).then(s => this.weeklySummary.set(s)).catch(() => null);
  }

  async openTimeline(): Promise<void> {
    if (this.timelineRecipes().length === 0) {
      const recipes = await this.recipeService.search({}).catch(() => []);
      this.timelineRecipes.set(recipes);
    }
    this.showTimeline.set(true);
  }

  async setMood(m: MoodFilter): Promise<void> {
    this.mood.set(m);
    this.loading.set(true);
    this.currentIndex.set(0);
    const suggestions = await this.suggestionService.getSuggestions(m);
    this.suggestions.set(suggestions);
    this.loading.set(false);
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

- [ ] **Step 2: Update tonight-page.component.html**

Replace the full file with:

```html
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
    <!-- Mood selector -->
    <div class="flex gap-2 mb-4 overflow-x-auto">
      @for (m of moodOptions; track m[0]) {
        <button (click)="setMood(m[0])"
          [class]="mood() === m[0]
            ? 'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white'
            : 'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600'">
          {{ m[1] }} {{ 'tonight.mood_' + m[0] | translate }}
        </button>
      }
    </div>

    <!-- Main suggestion card -->
    <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">
            @if (current()!.isNovel) { ✨ {{ 'tonight.new_combo' | translate }} }
            @else { {{ 'tonight.familiar' | translate }} }
          </p>
          <h2 class="text-xl font-bold text-gray-900">{{ current()!.recipe.name }}</h2>
          @if (currentFlavors().length > 0) {
            <div class="flex gap-1 flex-wrap mb-2">
              @for (f of currentFlavors(); track f) {
                <span class="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{{ f }}</span>
              }
            </div>
          }
        </div>
        @if (current()!.expiryScore > 5) {
          <span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium ml-2">
            {{ 'tonight.uses_expiring' | translate }}
          </span>
        }
      </div>

      @if (current()!.matchedInventoryItems.length > 0) {
        <p class="text-sm text-gray-600 mb-3">
          {{ 'tonight.you_have' | translate }}: {{ matchedNames(current()!.matchedInventoryItems) }}
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

    <!-- Multi-dish timeline button -->
    <button (click)="openTimeline()"
      class="w-full bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 mb-2">
      🍽️ {{ 'tonight.multi_dish' | translate }}
    </button>

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
  }
</div>

<!-- Timeline overlay -->
@if (showTimeline()) {
  <app-multi-dish-timeline
    [recipes]="timelineRecipes()"
    (done)="showTimeline.set(false)" />
}
```

- [ ] **Step 3: Add i18n keys to es.json**

In `public/assets/i18n/es.json`, add a `"timeline"` section after the `"health"` section, and add `"multi_dish"` key inside the `"tonight"` section.

In `"tonight"` section, add after `"mood_impress"`:
```json
"multi_dish": "Varios platos"
```

New `"timeline"` section to add before the closing `}` of the file:
```json
"timeline": {
  "title": "Varios platos",
  "target_time": "¿A qué hora quieres cenar?",
  "add_from_library": "Buscar receta",
  "add_manual": "Añadir manualmente",
  "dish_name": "Nombre del plato",
  "minutes": "min",
  "add": "Añadir",
  "generate": "Generar timeline",
  "starts_at": "Empieza a las",
  "in_x_min": "en {{min}} min",
  "alert_banner": "¡Empieza {{name}} ahora!",
  "all_started": "Todo en marcha 🎉 · Listo a las {{time}}",
  "close": "Cerrar"
}
```

- [ ] **Step 4: Add i18n keys to en.json**

In `public/assets/i18n/en.json`, add `"multi_dish"` key inside the `"tonight"` section after `"mood_impress"`:
```json
"multi_dish": "Multiple dishes"
```

New `"timeline"` section to add before the closing `}` of the file:
```json
"timeline": {
  "title": "Multiple dishes",
  "target_time": "What time do you want to eat?",
  "add_from_library": "Search recipe",
  "add_manual": "Add manually",
  "dish_name": "Dish name",
  "minutes": "min",
  "add": "Add",
  "generate": "Generate timeline",
  "starts_at": "Starts at",
  "in_x_min": "in {{min}} min",
  "alert_banner": "Start {{name}} now!",
  "all_started": "All started 🎉 · Ready at {{time}}",
  "close": "Close"
}
```

- [ ] **Step 5: Run all tests and build**

```bash
cd /home/valentin/code/ephemeral-cuisine && npm test -- --watchAll=false --no-coverage 2>&1 | tail -8 && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: all tests pass, `Application bundle generation complete.`

- [ ] **Step 6: Commit and push**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/tonight/ public/assets/i18n/ && git commit -m "feat(timeline): wire multi-dish timeline into Tonight page; add i18n keys" && git push
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| Entry point: "Varios platos" button on Tonight below suggestion card | Task 3 template |
| `DishEntry`, `SlotStatus`, `TimelineSlot` interfaces | Task 1 |
| `buildTimeline` pure function: sort DESC, startAt = target - cookMin | Task 1 |
| Setup phase: HH:MM input with validation (regex + range) | Task 2 |
| Setup phase: `targetTimeError` signal, Generar disabled while error | Task 2 |
| Add from library: `RecipeService.search({})` lazy on first open | Task 3 |
| Add manual: name + minutes, minimum 1 min | Task 2 |
| Minimum 2 dishes to generate | Task 2 `canGenerate` getter |
| Active phase: 15s tick, status transitions pending→alert | Task 2 `tick()` |
| One alert banner at a time via `currentAlert = computed(...)` | Task 2 |
| Dismiss alert → 'started'; all started → done | Task 2 `dismissAlert()` |
| Done phase: completion message with target time | Task 2 template |
| `clearInterval` on `ngOnDestroy` | Task 2 |
| 13 i18n keys under `"timeline"` in both JSON files | Task 3 |
| `"tonight.multi_dish"` key | Task 3 |

**2. Placeholder scan:** None found. All steps have complete code.

**3. Type consistency:**
- `DishEntry.id: string` defined in Task 1 → used in Task 2 `addFromLibrary`, `addManual`, `removeDish` — consistent
- `SlotStatus: 'pending' | 'alert' | 'started'` defined in Task 1 → used in Task 2 `tick()`, `dismissAlert()`, template class bindings — consistent
- `TimelineSlot.dish.id` used as track key in template — matches `DishEntry.id` — consistent
- `buildTimeline(dishes: DishEntry[], targetTime: Date): TimelineSlot[]` defined in Task 1 → called in Task 2 `generate()` — consistent
- `Recipe.cook_time` and `Recipe.total_time` from `recipe.model.ts` (both `number | undefined`) — Task 2 uses `recipe.cook_time ?? recipe.total_time ?? 30` — consistent
- `MultiDishTimelineComponent` selector `app-multi-dish-timeline` used in Task 3 template — matches Task 2 declaration — consistent
- `recipes = input<Recipe[]>([])` in Task 2 → `[recipes]="timelineRecipes()"` in Task 3 template — consistent
- `done = output<void>()` in Task 2 → `(done)="showTimeline.set(false)"` in Task 3 template — consistent
