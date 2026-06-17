import { sortByMood, ScoredRecipe } from './suggestion.service';

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
  it('default mode keeps score order (highest score first)', () => {
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
