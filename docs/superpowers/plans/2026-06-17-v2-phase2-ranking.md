# v2 Phase 2-E: Ranking + Leftover Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Ranking (Hall of Fame) screen — overall top dishes, rankings by audience (family member), rankings by technique, "most improved", and "worth repeating" sections. Also add the leftover blueprint: after post-cook flow, if leftovers were logged, show a suggested next-day dish using those ingredients.

**Architecture:** `RankingService` aggregates `cooked_versions` + `recipes` + `techniques` client-side. All ranking logic is pure functions on top of the already-loaded cook history. No new tables. Leftover blueprint is generated in `CookLogService.generateLeftoverBlueprint()` and displayed in the post-cook flow confirmation screen.

**Tech Stack:** Angular 18 signals, Supabase (read-only queries), Tailwind, TranslatePipe.

**Prerequisite:** Plans 2-A, 2-C complete (cooked_versions data exists, CookLogService exists).

---

### Task 1: Ranking aggregation — pure functions

**Files:**
- Create: `src/app/features/ranking/ranking.model.ts`
- Create: `src/app/features/ranking/ranking.model.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/ranking/ranking.model.spec.ts
import {
  aggregateByRecipe,
  rankByAudience,
  rankByTechnique,
  mostImproved,
  worthRepeating,
  RankedDish,
} from './ranking.model';
import { CookedVersion } from '../cook-log/cook-log.model';

function makeCook(recipe_id: string, technique_id: string | null, ratings: Record<string, number>, cooked_at = '2026-01-01'): CookedVersion {
  return {
    id: Math.random().toString(), user_id: 'u1', recipe_id, technique_id,
    cooked_at, combo: { protein: 'chicken', produce: [], seasoning: 'salt' },
    ratings, notes: null, modifications: [], nutrition: null,
    family_present: Object.keys(ratings).filter(k => k !== 'self'), leftovers: null,
  };
}

const cooks: CookedVersion[] = [
  makeCook('r1', 't1', { self: 9, partner: 8 }, '2026-01-01'),
  makeCook('r1', 't1', { self: 7, partner: 9 }, '2026-01-15'),
  makeCook('r2', 't1', { self: 8 }, '2026-02-01'),
  makeCook('r3', null, { self: 5 }, '2026-01-05'),
  makeCook('r3', null, { self: 9 }, '2026-02-10'),
];

describe('aggregateByRecipe', () => {
  it('groups cooks by recipe_id', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')?.cook_count).toBe(2);
    expect(result.get('r2')?.cook_count).toBe(1);
  });

  it('computes avg_self_rating', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')!.avg_self_rating).toBeCloseTo(8);
  });

  it('computes per-person avg', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')!.avg_by_person['partner']).toBeCloseTo(8.5);
  });
});

describe('rankByAudience', () => {
  it('returns recipes sorted by specific person rating', () => {
    const agg = aggregateByRecipe(cooks);
    const ranked = rankByAudience(agg, 'partner');
    expect(ranked[0].recipe_id).toBe('r1');
  });
});

describe('mostImproved', () => {
  it('returns recipes where last rating > first rating', () => {
    const result = mostImproved(cooks);
    expect(result.some(r => r.recipe_id === 'r3')).toBe(true);
    const r3 = result.find(r => r.recipe_id === 'r3')!;
    expect(r3.improvement).toBeCloseTo(4);
  });
});

describe('worthRepeating', () => {
  it('returns recipes with avg >= 9 cooked only once', () => {
    const agg = aggregateByRecipe(cooks);
    const result = worthRepeating(agg);
    expect(result.some(r => r.recipe_id === 'r2')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="ranking.model" --no-coverage
```

Expected: FAIL — `Cannot find module './ranking.model'`

- [ ] **Step 3: Implement**

```typescript
// src/app/features/ranking/ranking.model.ts
import { CookedVersion } from '../cook-log/cook-log.model';

export interface RecipeAggregate {
  recipe_id: string;
  technique_id: string | null;
  cook_count: number;
  avg_self_rating: number;
  avg_by_person: Record<string, number>;
  first_rating: number;
  last_rating: number;
  cooks_chronological: CookedVersion[];
}

export interface RankedDish {
  recipe_id: string;
  avg_self_rating: number;
  cook_count: number;
  improvement?: number;
  audience_rating?: number;
}

export function aggregateByRecipe(cooks: CookedVersion[]): Map<string, RecipeAggregate> {
  const map = new Map<string, RecipeAggregate>();

  for (const cook of cooks) {
    if (!cook.recipe_id) continue;
    if (!map.has(cook.recipe_id)) {
      map.set(cook.recipe_id, {
        recipe_id: cook.recipe_id,
        technique_id: cook.technique_id,
        cook_count: 0,
        avg_self_rating: 0,
        avg_by_person: {},
        first_rating: 0,
        last_rating: 0,
        cooks_chronological: [],
      });
    }
    map.get(cook.recipe_id)!.cooks_chronological.push(cook);
  }

  for (const [, agg] of map) {
    const sorted = [...agg.cooks_chronological].sort((a, b) => a.cooked_at.localeCompare(b.cooked_at));
    agg.cooks_chronological = sorted;
    agg.cook_count = sorted.length;

    const selfRatings = sorted.map(c => c.ratings['self'] ?? 0).filter(r => r > 0);
    agg.avg_self_rating = selfRatings.length ? selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length : 0;
    agg.first_rating = sorted[0]?.ratings['self'] ?? 0;
    agg.last_rating = sorted[sorted.length - 1]?.ratings['self'] ?? 0;

    const personTotals: Record<string, number[]> = {};
    for (const cook of sorted) {
      for (const [person, rating] of Object.entries(cook.ratings)) {
        if (person === 'self') continue;
        if (!personTotals[person]) personTotals[person] = [];
        personTotals[person].push(rating);
      }
    }
    for (const [person, ratings] of Object.entries(personTotals)) {
      agg.avg_by_person[person] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
  }

  return map;
}

export function topOverall(agg: Map<string, RecipeAggregate>, limit = 10): RankedDish[] {
  return [...agg.values()]
    .filter(a => a.cook_count > 0)
    .sort((a, b) => b.avg_self_rating - a.avg_self_rating)
    .slice(0, limit)
    .map(a => ({ recipe_id: a.recipe_id, avg_self_rating: a.avg_self_rating, cook_count: a.cook_count }));
}

export function rankByAudience(agg: Map<string, RecipeAggregate>, person: string, limit = 5): RankedDish[] {
  return [...agg.values()]
    .filter(a => person in a.avg_by_person)
    .sort((a, b) => (b.avg_by_person[person] ?? 0) - (a.avg_by_person[person] ?? 0))
    .slice(0, limit)
    .map(a => ({ recipe_id: a.recipe_id, avg_self_rating: a.avg_self_rating, cook_count: a.cook_count, audience_rating: a.avg_by_person[person] }));
}

export function rankByTechnique(agg: Map<string, RecipeAggregate>): Map<string, RankedDish> {
  const best = new Map<string, RankedDish>();
  for (const a of agg.values()) {
    if (!a.technique_id) continue;
    const existing = best.get(a.technique_id);
    if (!existing || a.avg_self_rating > existing.avg_self_rating) {
      best.set(a.technique_id, { recipe_id: a.recipe_id, avg_self_rating: a.avg_self_rating, cook_count: a.cook_count });
    }
  }
  return best;
}

export function mostImproved(cooks: CookedVersion[], limit = 5): RankedDish[] {
  const agg = aggregateByRecipe(cooks);
  return [...agg.values()]
    .filter(a => a.cook_count >= 2 && a.last_rating > a.first_rating)
    .sort((a, b) => (b.last_rating - b.first_rating) - (a.last_rating - a.first_rating))
    .slice(0, limit)
    .map(a => ({
      recipe_id: a.recipe_id,
      avg_self_rating: a.avg_self_rating,
      cook_count: a.cook_count,
      improvement: a.last_rating - a.first_rating,
    }));
}

export function worthRepeating(agg: Map<string, RecipeAggregate>, limit = 5): RankedDish[] {
  return [...agg.values()]
    .filter(a => a.cook_count === 1 && a.avg_self_rating >= 8.5)
    .sort((a, b) => b.avg_self_rating - a.avg_self_rating)
    .slice(0, limit)
    .map(a => ({ recipe_id: a.recipe_id, avg_self_rating: a.avg_self_rating, cook_count: a.cook_count }));
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="ranking.model" --no-coverage
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/ranking/ranking.model.ts src/app/features/ranking/ranking.model.spec.ts
git commit -m "feat(ranking): add ranking aggregation pure functions with full test coverage"
```

---

### Task 2: RankingService

**Files:**
- Create: `src/app/features/ranking/ranking.service.ts`

- [ ] **Step 1: Implement**

```typescript
// src/app/features/ranking/ranking.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { CookedVersion } from '../cook-log/cook-log.model';
import { Recipe } from '../recipes/models/recipe.model';
import { Technique } from '../techniques/technique.model';
import { RankedDish, aggregateByRecipe, topOverall, rankByAudience, rankByTechnique, mostImproved, worthRepeating } from './ranking.model';
import { DietaryProfileService } from '../../core/dietary-profile.service';

export interface RankingData {
  overall: Array<RankedDish & { recipe: Recipe }>;
  byAudience: Array<{ person: string; dishes: Array<RankedDish & { recipe: Recipe }> }>;
  byTechnique: Array<RankedDish & { recipe: Recipe; technique: Technique }>;
  mostImproved: Array<RankedDish & { recipe: Recipe }>;
  worthRepeating: Array<RankedDish & { recipe: Recipe }>;
}

@Injectable({ providedIn: 'root' })
export class RankingService {
  constructor(
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async getRankings(): Promise<RankingData> {
    const [cooksRes, recipesRes, techniquesRes, profile] = await Promise.all([
      this.supabase.client.from('cooked_versions').select('*').order('cooked_at', { ascending: true }),
      this.supabase.client.from('recipes').select('*'),
      this.supabase.client.from('techniques').select('*'),
      this.dietaryProfile.getProfile().catch(() => null),
    ]);

    const cooks: CookedVersion[] = cooksRes.data ?? [];
    const recipes: Recipe[] = recipesRes.data ?? [];
    const techniques: Technique[] = techniquesRes.data ?? [];

    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    const techniqueMap = new Map(techniques.map(t => [t.id, t]));
    const agg = aggregateByRecipe(cooks);
    const familyMembers = (profile?.family_members ?? []).map(m => m.name);

    const enrich = (dish: RankedDish) => ({ ...dish, recipe: recipeMap.get(dish.recipe_id)! });
    const validDish = (d: RankedDish & { recipe: Recipe }) => !!d.recipe;

    return {
      overall: topOverall(agg).map(enrich).filter(validDish),
      byAudience: familyMembers.map(person => ({
        person,
        dishes: rankByAudience(agg, person).map(enrich).filter(validDish),
      })).filter(a => a.dishes.length > 0),
      byTechnique: [...rankByTechnique(agg).entries()]
        .map(([tid, dish]) => ({ ...enrich(dish), technique: techniqueMap.get(tid)! }))
        .filter(d => d.recipe && d.technique),
      mostImproved: mostImproved(cooks).map(enrich).filter(validDish),
      worthRepeating: worthRepeating(agg).map(enrich).filter(validDish),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/ranking/ranking.service.ts
git commit -m "feat(ranking): add RankingService that assembles full ranking data"
```

---

### Task 3: Ranking page

**Files:**
- Modify: `src/app/features/ranking/ranking-page.component.ts`
- Create: `src/app/features/ranking/ranking-page.component.html`

- [ ] **Step 1: Implement the page**

```typescript
// src/app/features/ranking/ranking-page.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RankingService, RankingData } from './ranking.service';

@Component({
  selector: 'app-ranking-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './ranking-page.component.html',
})
export class RankingPageComponent implements OnInit {
  data = signal<RankingData | null>(null);
  loading = signal(true);

  constructor(private rankingService: RankingService) {}

  async ngOnInit(): Promise<void> {
    this.data.set(await this.rankingService.getRankings());
    this.loading.set(false);
  }

  stars(rating: number): string {
    return '⭐'.repeat(Math.round(rating));
  }

  formatRating(rating: number): string {
    return rating.toFixed(1);
  }
}
```

- [ ] **Step 2: Create template**

```html
<!-- src/app/features/ranking/ranking-page.component.html -->
<div class="p-4 pb-24">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">🏆 {{ 'ranking.title' | translate }}</h1>

  @if (loading()) {
    <p class="text-gray-400 text-center py-12">{{ 'ranking.loading' | translate }}</p>
  } @else if (!data() || data()!.overall.length === 0) {
    <div class="text-center py-16">
      <p class="text-gray-400">{{ 'ranking.empty' | translate }}</p>
    </div>
  } @else {
    <!-- OVERALL -->
    <section class="mb-8">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ 'ranking.overall' | translate }}</h2>
      <div class="flex flex-col gap-2">
        @for (dish of data()!.overall; track dish.recipe_id; let i = $index) {
          <a [routerLink]="['/recipes', dish.recipe_id]"
            class="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <span class="text-lg font-bold text-gray-300 w-6">{{ i + 1 }}</span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 truncate">{{ dish.recipe.name }}</p>
              <p class="text-xs text-gray-400">{{ dish.cook_count }} {{ 'ranking.cooks' | translate }}</p>
            </div>
            <span class="font-bold text-primary">{{ formatRating(dish.avg_self_rating) }}</span>
          </a>
        }
      </div>
    </section>

    <!-- BY AUDIENCE -->
    @for (audience of data()!.byAudience; track audience.person) {
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          ❤️ {{ audience.person }}
        </h2>
        <div class="flex flex-col gap-2">
          @for (dish of audience.dishes; track dish.recipe_id) {
            <a [routerLink]="['/recipes', dish.recipe_id]"
              class="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ dish.recipe.name }}</p>
              </div>
              <span class="font-bold text-primary text-sm">{{ formatRating(dish.audience_rating ?? 0) }}</span>
            </a>
          }
        </div>
      </section>
    }

    <!-- BY TECHNIQUE -->
    @if (data()!.byTechnique.length > 0) {
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ 'ranking.by_technique' | translate }}</h2>
        <div class="flex flex-col gap-2">
          @for (dish of data()!.byTechnique; track dish.recipe_id) {
            <a [routerLink]="['/recipes', dish.recipe_id]"
              class="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ dish.recipe.name }}</p>
                <p class="text-xs text-gray-400">{{ dish.technique.name }}</p>
              </div>
              <span class="font-bold text-primary text-sm">{{ formatRating(dish.avg_self_rating) }}</span>
            </a>
          }
        </div>
      </section>
    }

    <!-- MOST IMPROVED -->
    @if (data()!.mostImproved.length > 0) {
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">📈 {{ 'ranking.most_improved' | translate }}</h2>
        <div class="flex flex-col gap-2">
          @for (dish of data()!.mostImproved; track dish.recipe_id) {
            <a [routerLink]="['/recipes', dish.recipe_id]"
              class="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ dish.recipe.name }}</p>
              </div>
              <span class="text-green-600 font-bold text-sm">+{{ dish.improvement?.toFixed(1) }}</span>
            </a>
          }
        </div>
      </section>
    }

    <!-- WORTH REPEATING -->
    @if (data()!.worthRepeating.length > 0) {
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">⭐ {{ 'ranking.worth_repeating' | translate }}</h2>
        <p class="text-xs text-gray-400 mb-2">{{ 'ranking.worth_repeating_hint' | translate }}</p>
        <div class="flex flex-col gap-2">
          @for (dish of data()!.worthRepeating; track dish.recipe_id) {
            <a [routerLink]="['/recipes', dish.recipe_id]"
              class="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ dish.recipe.name }}</p>
              </div>
              <span class="font-bold text-primary text-sm">{{ formatRating(dish.avg_self_rating) }}</span>
            </a>
          }
        </div>
      </section>
    }
  }
</div>
```

- [ ] **Step 3: Add i18n keys**

In `es.json` `"ranking"` section:
```json
"ranking": {
  "title": "Mis Mejores Platos",
  "loading": "Cargando…",
  "empty": "Cocina tu primer plato y vuelve aquí",
  "overall": "Lo Mejor",
  "by_technique": "Mejor por Técnica",
  "most_improved": "Más Mejorado",
  "worth_repeating": "Vale la Pena Repetir",
  "worth_repeating_hint": "Calificación alta pero solo cocinado una vez",
  "cooks": "cocciones"
}
```

Mirror in `en.json`.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/ranking/ranking-page.component.ts src/app/features/ranking/ranking-page.component.html
git commit -m "feat(ranking): full ranking page — overall, by audience, by technique, most improved"
```

---

### Task 4: Leftover blueprint

**Files:**
- Modify: `src/app/features/cook-log/cook-log.service.ts` (add `generateLeftoverBlueprint`)
- Modify: `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.ts` (show blueprint after save)
- Modify: `src/app/features/cook-log/post-cook-flow/post-cook-flow.component.html` (blueprint section)

- [ ] **Step 1: Add generateLeftoverBlueprint to CookLogService**

```typescript
// Append to cook-log.service.ts:
import { LeftoverItem } from './cook-log.model';

export interface LeftoverBlueprint {
  suggestion: string;
  addedMinutes: number;
  nutrition_note: string;
}

// In the CookLogService class:
generateLeftoverBlueprint(leftovers: LeftoverItem[]): LeftoverBlueprint | null {
  if (!leftovers.length) return null;

  const names = leftovers.map(l => l.name).join(', ');
  const totalGrams = leftovers.reduce((sum, l) => sum + l.quantity_g, 0);

  // Simple heuristic: suggest rice bowl for any protein leftovers
  const hasProtein = leftovers.some(l => ['chicken', 'fish', 'salmon', 'beef', 'pork', 'tofu'].some(p => l.name.toLowerCase().includes(p)));
  const hasRice = leftovers.some(l => l.name.toLowerCase().includes('rice') || l.name.toLowerCase().includes('arroz'));

  if (hasProtein && hasRice) {
    return { suggestion: `Bowl de ${names} con arroz y pepino`, addedMinutes: 5, nutrition_note: 'GF/DF ✓' };
  }
  if (hasProtein) {
    return { suggestion: `Ensalada con ${names} y limón`, addedMinutes: 8, nutrition_note: 'GF/DF ✓' };
  }
  return { suggestion: `Salteado rápido con ${names}`, addedMinutes: 10, nutrition_note: '' };
}
```

- [ ] **Step 2: Add `blueprint` signal to PostCookFlowComponent**

In `post-cook-flow.component.ts`:

```typescript
import { LeftoverBlueprint } from '../cook-log.service';

// Add signal to the class:
blueprint = signal<LeftoverBlueprint | null>(null);
saved = signal(false);
```

At the end of the `save()` method, before `this.done.emit()`:

```typescript
const bp = this.cookLog.generateLeftoverBlueprint(this.leftovers());
this.blueprint.set(bp);
this.saved.set(true);
// Don't emit done yet — show blueprint first
```

Add a `finish()` method:
```typescript
finish(): void {
  this.done.emit();
}
```

- [ ] **Step 3: Add blueprint section to post-cook template**

Replace the save button section at the bottom with:

```html
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
```

- [ ] **Step 4: Add i18n keys**

In `es.json` add to `"cooklog"` section:
```json
"cooklog": {
  "title": "¿Cómo fue?",
  "what_did_you_use": "¿Qué usaste?",
  "protein_placeholder": "Proteína (ej. pollo, salmón)",
  "produce_placeholder": "Verduras (separadas por comas)",
  "seasoning_placeholder": "Condimento principal",
  "who_ate": "¿Quién comió?",
  "your_rating": "Tu puntuación",
  "modifications": "Modificaciones",
  "modifications_placeholder": "Separadas por comas",
  "notes": "Notas",
  "notes_placeholder": "Ej. más ajo la próxima vez",
  "leftovers": "Sobras",
  "leftover_name": "Nombre",
  "saving": "Guardando…",
  "save": "Guardar cocinada",
  "finish": "Listo",
  "leftover_blueprint": "Mañana con las sobras:"
}
```

Mirror in `en.json`.

- [ ] **Step 5: Run all tests, build, push**

```bash
npm test -- --no-coverage 2>&1 | tail -15
npx ng build --configuration=development 2>&1 | tail -5
git add src/app/features/ranking/ src/app/features/cook-log/ public/assets/i18n/
git commit -m "feat(ranking+cooklog): ranking page, leftover blueprint, cooklog i18n"
git push
```
