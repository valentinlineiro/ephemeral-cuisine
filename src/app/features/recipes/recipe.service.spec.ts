import { TestBed } from '@angular/core/testing';
import { RecipeService } from './recipe.service';
import { SupabaseService } from '../../core/supabase.service';
import { Recipe, RecipeFilter } from './models/recipe.model';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSupabase = { client: { from: mockFrom, rpc: mockRpc } };

const sampleRecipe: Recipe = {
  id: 'r1', user_id: 'u1', name: 'Tortilla',
  language: 'es', equipment: [], ingredients: [],
  steps: [], tags: [], allergens: [], created_at: '2026-01-01',
};

describe('RecipeService', () => {
  let service: RecipeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: mockSupabase }],
    });
    service = TestBed.inject(RecipeService);
    jest.clearAllMocks();
  });

  describe('search()', () => {
    it('returns recipes array on success', async () => {
      const result = { data: [sampleRecipe], error: null };
      const chainable = new Proxy({}, {
        get: (_t, prop) => {
          if (prop === 'then') return undefined; // not a Promise itself
          return () => chainable;
        },
      });
      const orderMock = jest.fn().mockResolvedValue(result);
      const selectMock = jest.fn().mockReturnValue({ ...chainable, order: orderMock });
      mockFrom.mockReturnValue({ select: selectMock });

      const results = await service.search({});
      expect(results).toEqual([{ ...sampleRecipe, is_favorite: false, favorite_recipes: undefined }]);
    });

    it('throws on Supabase error', async () => {
      const result = { data: null, error: { message: 'fail' } };
      const orderMock = jest.fn().mockResolvedValue(result);
      const selectMock = jest.fn().mockReturnValue({ order: orderMock });
      mockFrom.mockReturnValue({ select: selectMock });

      await expect(service.search({})).rejects.toThrow('fail');
    });
  });

  describe('getIngredientSuggestions()', () => {
    it('returns distinct ingredient names', async () => {
      mockRpc.mockResolvedValue({ data: ['pollo', 'arroz'], error: null });
      const result = await service.getIngredientSuggestions();
      expect(result).toEqual(['pollo', 'arroz']);
    });
  });
});
