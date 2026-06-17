import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { CookedVersion, CookLogInput } from './cook-log.model';

export interface CookLogInputWithDeductions extends CookLogInput {
  inventory_deductions?: Array<{ name: string; quantity: number }>;
}

@Injectable({ providedIn: 'root' })
export class CookLogService {
  constructor(
    private supabase: SupabaseService,
    private inventoryService: InventoryService,
  ) {}

  async logCook(input: CookLogInputWithDeductions): Promise<CookedVersion> {
    const { inventory_deductions, ...payload } = input;
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    if (inventory_deductions?.length) {
      await this.inventoryService.deductItems(inventory_deductions);
    }

    return data;
  }

  async getHistoryForRecipe(recipe_id: string): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .eq('recipe_id', recipe_id)
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getHistoryForTechnique(technique_id: string): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .eq('technique_id', technique_id)
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getRecentCooks(limit = 20): Promise<CookedVersion[]> {
    const { data, error } = await this.supabase.client
      .from('cooked_versions')
      .select('*')
      .order('cooked_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).slice(0, limit);
  }
}
