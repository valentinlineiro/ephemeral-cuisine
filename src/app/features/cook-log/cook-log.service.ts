import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { CookedVersion, CookLogInput, LeftoverItem } from './cook-log.model';

export interface LeftoverBlueprint {
  suggestion: string;
  addedMinutes: number;
  nutrition_note: string;
}

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

  generateLeftoverBlueprint(leftovers: LeftoverItem[]): LeftoverBlueprint | null {
    if (!leftovers.length) return null;

    const names = leftovers.map(l => l.name).join(', ');

    const hasProtein = leftovers.some(l =>
      ['chicken', 'fish', 'salmon', 'beef', 'pork', 'tofu'].some(p => l.name.toLowerCase().includes(p))
    );
    const hasRice = leftovers.some(l =>
      l.name.toLowerCase().includes('rice') || l.name.toLowerCase().includes('arroz')
    );

    if (hasProtein && hasRice) {
      return { suggestion: `Bowl de ${names} con arroz y pepino`, addedMinutes: 5, nutrition_note: 'GF/DF ✓' };
    }
    if (hasProtein) {
      return { suggestion: `Ensalada con ${names} y limón`, addedMinutes: 8, nutrition_note: 'GF/DF ✓' };
    }
    return { suggestion: `Salteado rápido con ${names}`, addedMinutes: 10, nutrition_note: '' };
  }
}
