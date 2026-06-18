import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { Recipe } from '../recipes/models/recipe.model';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { CookedVersion } from '../cook-log/cook-log.model';
import { DietaryProfile } from '../../core/models/dietary-profile.model';
import { extractProtein, predictRating } from './combo-predictor';

export type MoodFilter = 'default' | 'comfort' | 'adventure' | 'impress';

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  expiryScore: number;
  isNovel: boolean;
  missingEquipment: string[];
  matchedInventoryItems: InventoryItem[];
  substitutions: string[];
  avgSelfRating: number;
  avgFamilyRating: number;
  predictedRating: number | null;
}

const EXPIRY_WEIGHTS: Record<string, number> = {
  expired: 10, today: 8, tomorrow: 5, this_week: 2, later: 0, none: 0,
};

export function sortByMood(items: ScoredRecipe[], mood: MoodFilter): ScoredRecipe[] {
  const sorted = [...items];
  switch (mood) {
    case 'comfort':
      return sorted.sort((a, b) => b.avgSelfRating - a.avgSelfRating);
    case 'adventure':
      return sorted.sort((a, b) => {
        if (a.isNovel !== b.isNovel) return a.isNovel ? -1 : 1;
        return b.score - a.score;
      });
    case 'impress':
      return sorted.sort((a, b) => b.avgFamilyRating - a.avgFamilyRating);
    default:
      return sorted.sort((a, b) => b.score - a.score);
  }
}

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  constructor(
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async getSuggestions(mood: MoodFilter = 'default'): Promise<ScoredRecipe[]> {
    const [recipesRes, cooksRes, invRes, profile] = await Promise.all([
      this.supabase.client.from('recipes').select('*').order('name', { ascending: true }),
      this.supabase.client.from('cooked_versions').select('*').order('cooked_at', { ascending: false }),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
      this.dietaryProfile.getProfile().catch(() => null),
    ]);

    const recipes: Recipe[] = recipesRes.data ?? [];
    const cooks: CookedVersion[] = cooksRes.data ?? [];
    const inventory: InventoryItem[] = invRes.data ?? [];

    if (recipes.length === 0) return [];

    const usedCombos = new Set(cooks.map(c => `${c.recipe_id}:${c.combo.protein}:${(c.combo.produce ?? []).sort().join(',')}`));
    const ownedEquipment = new Set(profile?.equipment ?? []);

    const ratingsByRecipe = new Map<string, { selfSum: number; familySum: number; familyCount: number; count: number }>();
    for (const c of cooks) {
      if (!c.recipe_id) continue;
      const existing = ratingsByRecipe.get(c.recipe_id) ?? { selfSum: 0, familySum: 0, familyCount: 0, count: 0 };
      const self = c.ratings?.['self'] ?? 0;
      const familyRatings = Object.entries(c.ratings ?? {}).filter(([k]) => k !== 'self').map(([, v]) => v);
      ratingsByRecipe.set(c.recipe_id, {
        selfSum: existing.selfSum + self,
        familySum: existing.familySum + familyRatings.reduce((s, v) => s + v, 0),
        familyCount: existing.familyCount + familyRatings.length,
        count: existing.count + 1,
      });
    }

    const recipeCuisineMap = new Map(recipes.map(r => [r.id, r.cuisine_type]));

    const scored = recipes.map(recipe =>
      this.scoreRecipe(recipe, inventory, usedCombos, ownedEquipment, profile, ratingsByRecipe, cooks, recipeCuisineMap)
    );

    return sortByMood(scored, mood);
  }

  private scoreRecipe(
    recipe: Recipe,
    inventory: InventoryItem[],
    usedCombos: Set<string>,
    ownedEquipment: Set<string>,
    profile: DietaryProfile | null,
    ratingsByRecipe: Map<string, { selfSum: number; familySum: number; familyCount: number; count: number }>,
    cooks: CookedVersion[],
    recipeCuisineMap: Map<string, string | undefined>,
  ): ScoredRecipe {
    const ingredientNames = (recipe.ingredients ?? []).map((i: any) => i.name.toLowerCase());

    const matchedInventoryItems = inventory.filter(inv =>
      ingredientNames.some(name => inv.name.toLowerCase().includes(name) || name.includes(inv.name.toLowerCase()))
    );

    const expiryScore = matchedInventoryItems.reduce((sum, item) => {
      return sum + (EXPIRY_WEIGHTS[getExpiryStatus(item.expiry_date)] ?? 0);
    }, 0);

    const protein = matchedInventoryItems.find(i => i.category === 'protein')?.name ?? '';
    const produce = matchedInventoryItems.filter(i => i.category === 'produce').map(i => i.name).sort();
    const comboKey = `${recipe.id}:${protein}:${produce.join(',')}`;
    const isNovel = !usedCombos.has(comboKey);

    const requiredEquipment: string[] = (recipe as any).equipment ?? [];
    const missingEquipment = requiredEquipment.filter(e => !ownedEquipment.has(e));

    const partnerRestrictions = profile?.family_members.find(m =>
      m.restrictions.includes('gluten_free') || m.restrictions.includes('lactose_free')
    );
    const substitutions: string[] = partnerRestrictions ? ingredientNames.filter(name =>
      (partnerRestrictions.restrictions.includes('gluten_free') && ['soy sauce', 'flour', 'bread crumbs'].some(s => name.includes(s))) ||
      (partnerRestrictions.restrictions.includes('lactose_free') && ['cream', 'butter', 'milk', 'cheese'].some(s => name.includes(s)))
    ) : [];

    const score =
      expiryScore * 3 +
      (isNovel ? 5 : 0) +
      (missingEquipment.length === 0 ? 3 : -10) +
      matchedInventoryItems.length;

    const ratings = ratingsByRecipe.get(recipe.id);
    const avgSelfRating = ratings && ratings.count > 0 ? ratings.selfSum / ratings.count : 0;
    const avgFamilyRating = ratings && ratings.familyCount > 0 ? ratings.familySum / ratings.familyCount : 0;

    const targetProtein = extractProtein(ingredientNames);
    const predictedRating = predictRating(cooks, recipeCuisineMap, targetProtein, recipe.cuisine_type);

    return { recipe, score, expiryScore, isNovel, missingEquipment, matchedInventoryItems, substitutions, avgSelfRating, avgFamilyRating, predictedRating };
  }
}
