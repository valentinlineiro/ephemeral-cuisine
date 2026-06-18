import { extractProtein, predictRating } from './combo-predictor';
import { CookedVersion } from '../cook-log/cook-log.model';

function makeCook(
  protein: string,
  selfRating: number,
  recipeId: string | null = 'r1',
): CookedVersion {
  return {
    id: 'c1',
    user_id: 'u1',
    recipe_id: recipeId,
    technique_id: null,
    cooked_at: '2026-01-01',
    combo: { protein, produce: [], seasoning: '' },
    ratings: { self: selfRating },
    notes: null,
    modifications: [],
    nutrition: null,
    family_present: [],
    leftovers: null,
  };
}

const MAP = new Map<string, string | undefined>([
  ['r1', 'mediterranean'],
  ['r2', 'thai'],
]);

describe('extractProtein', () => {
  it('returns null for empty array', () => {
    expect(extractProtein([])).toBeNull();
  });

  it('returns null when no protein keyword matches', () => {
    expect(extractProtein(['tomato', 'onion', 'garlic'])).toBeNull();
  });

  it('returns first matching protein keyword', () => {
    expect(extractProtein(['chicken breast', 'garlic', 'lemon'])).toBe('chicken');
  });

  it('returns protein for tofu', () => {
    expect(extractProtein(['tofu', 'avocado'])).toBe('tofu');
  });
});

describe('predictRating', () => {
  it('returns null when targetProtein is null', () => {
    expect(predictRating([], MAP, null, undefined)).toBeNull();
  });

  it('returns null with empty history', () => {
    expect(predictRating([], MAP, 'chicken', 'mediterranean')).toBeNull();
  });

  it('returns null with only 1 matching cook (below minSamples=2)', () => {
    expect(predictRating([makeCook('chicken', 8)], MAP, 'chicken', 'mediterranean')).toBeNull();
  });

  it('returns average of 2 matching cooks rounded to 1 decimal', () => {
    const cooks = [makeCook('chicken', 8), makeCook('chicken', 9)];
    expect(predictRating(cooks, MAP, 'chicken', 'mediterranean')).toBe(8.5);
  });

  it('excludes cooks with protein mismatch', () => {
    const cooks = [makeCook('salmon', 9), makeCook('salmon', 10)];
    expect(predictRating(cooks, MAP, 'chicken', 'mediterranean')).toBeNull();
  });

  it('excludes cooks with cuisine mismatch when targetCuisineType is defined', () => {
    const cooks = [makeCook('chicken', 9, 'r2'), makeCook('chicken', 10, 'r2')];
    expect(predictRating(cooks, MAP, 'chicken', 'mediterranean')).toBeNull();
  });

  it('skips cuisine filter when targetCuisineType is undefined', () => {
    const cooks = [makeCook('chicken', 8, 'r1'), makeCook('chicken', 9, 'r2')];
    expect(predictRating(cooks, MAP, 'chicken', undefined)).toBe(8.5);
  });

  it('excludes cooks with null recipe_id when targetCuisineType is defined', () => {
    const cooks = [makeCook('chicken', 9, null), makeCook('chicken', 10, null)];
    expect(predictRating(cooks, MAP, 'chicken', 'mediterranean')).toBeNull();
  });

  it('uses ratings?.self ?? 0 for cooks missing the self key', () => {
    const cook1 = makeCook('chicken', 8);
    const cook2: CookedVersion = { ...makeCook('chicken', 0, 'r1'), ratings: {} };
    expect(predictRating([cook1, cook2], MAP, 'chicken', 'mediterranean')).toBe(4);
  });
});
