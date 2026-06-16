import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Recipe, RecipeFilter } from './models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  constructor(private supabase: SupabaseService) {}

  async search(filter: RecipeFilter): Promise<Recipe[]> {
    let query = this.supabase.client
      .from('recipes')
      .select(`*, favorite_recipes!left(user_id)`);

    if (filter.query) {
      query = query.textSearch('search_vector', filter.query, { type: 'plain' });
    }

    if (filter.ingredients?.length) {
      // @> containment: recipe must include ALL selected ingredients
      const containsAll = filter.ingredients.map(i => ({ name: i }));
      query = query.contains('ingredients', JSON.stringify(containsAll));
    }

    if (filter.cuisine_type) {
      query = query.eq('cuisine_type', filter.cuisine_type);
    }

    if (filter.max_time) {
      query = query.lte('total_time', filter.max_time);
    }

    if (filter.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }

    if (filter.equipment_required?.length) {
      query = query.contains('equipment', filter.equipment_required);
    }

    if (filter.allergens_exclude?.length) {
      // Exclude recipes that overlap with the given allergens
      query = query.not('allergens', 'ov', `{${filter.allergens_exclude.join(',')}}`);
    }

    if (filter.favorites_only) {
      query = query.not('favorite_recipes', 'is', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((r: any) => ({
      ...r,
      is_favorite: Array.isArray(r.favorite_recipes) && r.favorite_recipes.length > 0,
      favorite_recipes: undefined,
    }));
  }

  async getById(id: string): Promise<Recipe | null> {
    const { data, error } = await this.supabase.client
      .from('recipes')
      .select(`*, favorite_recipes!left(user_id)`)
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      ...data,
      is_favorite: Array.isArray(data.favorite_recipes) && data.favorite_recipes.length > 0,
      favorite_recipes: undefined,
    };
  }

  async toggleFavorite(recipeId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('favorite_recipes')
      .select('recipe_id')
      .eq('recipe_id', recipeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      await this.supabase.client
        .from('favorite_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('user_id', userId);
      return false;
    } else {
      const { error } = await this.supabase.client
        .from('favorite_recipes')
        .insert({ recipe_id: recipeId, user_id: userId });
      if (error) {
        // Unique constraint violation (23505) means concurrent tap already inserted — re-query truth
        if (error.code === '23505') {
          const { data: existing } = await this.supabase.client
            .from('favorite_recipes')
            .select('recipe_id')
            .eq('recipe_id', recipeId)
            .eq('user_id', userId)
            .maybeSingle();
          return !!existing;
        }
        throw new Error(error.message);
      }
      return true;
    }
  }

  async getIngredientSuggestions(): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .rpc('get_distinct_ingredients');
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
