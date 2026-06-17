import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { SkillLevel, Technique, TechniqueStep, TechniqueWithStats, calcMastery } from './technique.model';

export interface AddTechniqueInput {
  name: string;
  base_steps: TechniqueStep[];
  equipment: string[];
  skill_level: SkillLevel;
}

@Injectable({ providedIn: 'root' })
export class TechniqueService {
  constructor(private supabase: SupabaseService) {}

  async getTechniques(): Promise<Technique[]> {
    const { data, error } = await this.supabase.client
      .from('techniques')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getTechniqueWithStats(id: string): Promise<TechniqueWithStats> {
    const [techniqueRes, cookRes] = await Promise.all([
      this.supabase.client.from('techniques').select('*').eq('id', id).single(),
      this.supabase.client
        .from('cooked_versions')
        .select('ratings')
        .eq('technique_id', id),
    ]);
    if (techniqueRes.error) throw techniqueRes.error;
    if (cookRes.error) throw cookRes.error;

    const cooks: Array<{ ratings: Record<string, number> }> = cookRes.data ?? [];
    const cook_count = cooks.length;
    const selfRatings = cooks.map(c => c.ratings['self'] ?? 0).filter(r => r > 0);
    const avg_rating = selfRatings.length ? selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length : 0;

    return { ...techniqueRes.data, cook_count, avg_rating, mastery: calcMastery(cook_count, avg_rating) };
  }

  async addTechnique(input: AddTechniqueInput): Promise<Technique> {
    const { data, error } = await this.supabase.client
      .from('techniques')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTechnique(id: string, updates: Partial<AddTechniqueInput>): Promise<void> {
    const { error } = await this.supabase.client
      .from('techniques')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async deleteTechnique(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('techniques')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
