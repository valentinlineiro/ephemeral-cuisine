import { Injectable } from '@angular/core';
import { DietaryProfile } from './models/dietary-profile.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DietaryProfileService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(): Promise<DietaryProfile | null> {
    const { data, error } = await this.supabase.client
      .from('dietary_profiles')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertProfile(updates: Partial<Omit<DietaryProfile, 'user_id' | 'updated_at'>>): Promise<DietaryProfile> {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    const { data, error } = await this.supabase.client
      .from('dietary_profiles')
      .upsert({ user_id: user!.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
