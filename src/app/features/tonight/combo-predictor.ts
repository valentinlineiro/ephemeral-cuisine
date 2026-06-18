import { CookedVersion } from '../cook-log/cook-log.model';

export const PROTEIN_KEYS = [
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

/** Returns the first protein keyword found in ingredientNames, or null for vegetarian dishes. */
export function extractProtein(ingredientNames: string[]): string | null {
  for (const name of ingredientNames) {
    const lower = name.toLowerCase();
    const key = PROTEIN_KEYS.find(k => lower.includes(k) || k.includes(lower));
    if (key) return key;
  }
  return null;
}

/**
 * Predicts the user's self-rating for a recipe based on past cooks with the same
 * protein and cuisine type. Returns null when targetProtein is null or pool < minSamples.
 *
 * Cuisine filter: skipped entirely when targetCuisineType is undefined.
 * Protein matching: substring bidirectional (case-insensitive). Known limitation:
 * compound strings like "pollo y chorizo" will match "pollo" — acceptable for MVP.
 */
export function predictRating(
  history: CookedVersion[],
  recipeCuisineMap: Map<string, string | undefined>,
  targetProtein: string | null,
  targetCuisineType: string | undefined,
  minSamples = 2,
): number | null {
  if (targetProtein === null) return null;
  const lower = targetProtein.toLowerCase();

  const pool = history.filter(cook => {
    const cp = (cook.combo?.protein ?? '').toLowerCase();
    if (!cp) return false;
    if (!cp.includes(lower) && !lower.includes(cp)) return false;
    if (targetCuisineType !== undefined) {
      if (!cook.recipe_id) return false;
      return recipeCuisineMap.get(cook.recipe_id) === targetCuisineType;
    }
    return true;
  });

  if (pool.length < minSamples) return null;
  const sum = pool.reduce((s, c) => s + (c.ratings?.['self'] ?? 0), 0);
  return Math.round((sum / pool.length) * 10) / 10;
}
