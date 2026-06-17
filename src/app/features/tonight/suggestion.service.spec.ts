import { TestBed } from '@angular/core/testing';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { Recipe } from '../recipes/models/recipe.model';
import { InventoryItem } from '../inventory/inventory.model';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const recipe: Recipe = {
  id: 'r1', user_id: 'u1', name: 'Chicken Tagine',
  ingredients: [{ name: 'chicken', qty: 2, unit: 'ud' }, { name: 'cilantro', qty: 1, unit: 'bundle' }],
  steps: [], tags: [], allergens: [], equipment: ['oven'],
  cuisine_type: null, difficulty: 'medium', prep_time: 10, cook_time: 40, servings: 2, language: 'es',
} as any;

const inventory: InventoryItem[] = [
  { id: 'i1', user_id: 'u1', name: 'chicken', quantity: 4, unit: 'ud', expiry_date: daysFromNow(2), category: 'protein', created_at: '', updated_at: '' },
  { id: 'i2', user_id: 'u1', name: 'cilantro', quantity: 1, unit: 'bundle', expiry_date: daysFromNow(1), category: 'produce', created_at: '', updated_at: '' },
];

const profile: DietaryProfile = {
  user_id: 'u1', max_sodium_mg: 1500, calorie_target: 2200, protein_target_g: 120,
  equipment: ['oven', 'wok'], family_members: [], updated_at: '',
};

function makeClient(recipes: unknown, cooks: unknown, inv: unknown) {
  return {
    from: (table: string) => {
      if (table === 'recipes') return { select: () => ({ order: () => Promise.resolve({ data: recipes, error: null }) }) };
      if (table === 'cooked_versions') return { select: () => ({ order: () => Promise.resolve({ data: cooks, error: null }) }) };
      if (table === 'inventory_items') return { select: () => ({ order: () => Promise.resolve({ data: inv, error: null }) }) };
      return {};
    },
  };
}

describe('SuggestionService', () => {
  function setup(recipes: unknown, cooks: unknown, inv: unknown, prof: DietaryProfile | null = profile) {
    TestBed.configureTestingModule({
      providers: [
        SuggestionService,
        { provide: SupabaseService, useValue: { client: makeClient(recipes, cooks, inv) } },
        { provide: DietaryProfileService, useValue: { getProfile: () => Promise.resolve(prof) } },
      ],
    });
    return TestBed.inject(SuggestionService);
  }

  it('returns empty array when no recipes', async () => {
    const svc = setup([], [], []);
    expect(await svc.getSuggestions()).toHaveLength(0);
  });

  it('scores recipe higher when inventory contains expiring ingredients', async () => {
    const svc = setup([recipe], [], inventory);
    const suggestions = await svc.getSuggestions();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].recipe.id).toBe('r1');
    expect(suggestions[0].expiryScore).toBeGreaterThan(0);
  });

  it('marks recipe as equipment missing when user lacks required equipment', async () => {
    const noOvenProfile: DietaryProfile = { ...profile, equipment: ['wok'] };
    const svc = setup([recipe], [], inventory, noOvenProfile);
    const suggestions = await svc.getSuggestions();
    expect(suggestions[0].missingEquipment).toContain('oven');
  });

  it('marks recipe as novel when combo never cooked', async () => {
    const svc = setup([recipe], [], inventory);
    const suggestions = await svc.getSuggestions();
    expect(suggestions[0].isNovel).toBe(true);
  });
});
