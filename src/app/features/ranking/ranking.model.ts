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

// ─── Trend + Flavor Diversity ───

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
  { name: 'citrus',     label: 'Citrus',     keywords: ['lemon', 'lime', 'limón', 'orange', 'naranja', 'ponzu', 'yuzu'] },
  { name: 'umami',      label: 'Umami',      keywords: ['soy', 'miso', 'fish sauce', 'parmesan', 'anchovy', 'mushroom', 'tamari'] },
  { name: 'warm_spice', label: 'Warm spice', keywords: ['cumin', 'coriander', 'cinnamon', 'cardamom', 'turmeric', 'garam masala'] },
  { name: 'heat',       label: 'Heat',       keywords: ['chili', 'jalapeño', 'sriracha', 'gochujang', 'harissa', 'cayenne'] },
  { name: 'fresh_herb', label: 'Fresh herb', keywords: ['cilantro', 'basil', 'mint', 'parsley', 'dill', 'coriander'] },
  { name: 'sweet',      label: 'Sweet',      keywords: ['honey', 'teriyaki', 'mango', 'coconut', 'maple', 'dates'] },
];

export function computeTrend(
  cooks: CookedVersion[],
  recipes: Array<{ id: string; cuisine_type?: string }>,
): CookTrend {
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
