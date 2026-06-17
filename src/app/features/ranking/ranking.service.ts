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
