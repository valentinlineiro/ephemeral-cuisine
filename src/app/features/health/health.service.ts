import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';

export interface WeeklySummary {
  avg_sodium_mg: number;
  avg_calories: number;
  protein_target_hit_days: number;
  cook_count: number;
  period_days: number;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private supabase: SupabaseService) {}

  async getWeeklySummary(profile: DietaryProfile | null): Promise<WeeklySummary> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('cooked_at, nutrition')
      .gte('cooked_at', since.toISOString());
    if (error) throw error;

    const cooks = (data ?? []).filter((c: any) => c.nutrition);
    const period_days = 7;
    const cook_count = cooks.length;

    if (cook_count === 0) {
      return { avg_sodium_mg: 0, avg_calories: 0, protein_target_hit_days: 0, cook_count: 0, period_days };
    }

    const totalSodium   = cooks.reduce((s: number, c: any) => s + (c.nutrition?.sodium_mg ?? 0), 0);
    const totalCalories = cooks.reduce((s: number, c: any) => s + (c.nutrition?.calories  ?? 0), 0);

    // Sum protein per calendar day, count days meeting daily target
    const byDay = new Map<string, number>();
    for (const c of cooks) {
      const day = (c.cooked_at as string).split('T')[0];
      byDay.set(day, (byDay.get(day) ?? 0) + (c.nutrition?.protein_g ?? 0));
    }
    const dailyTarget = profile?.protein_target_g ?? 120;
    const protein_target_hit_days = [...byDay.values()].filter(g => g >= dailyTarget).length;

    return {
      avg_sodium_mg: Math.round(totalSodium   / period_days),
      avg_calories:  Math.round(totalCalories / period_days),
      protein_target_hit_days,
      cook_count,
      period_days,
    };
  }
}
