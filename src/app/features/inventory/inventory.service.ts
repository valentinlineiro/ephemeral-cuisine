import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryCategory, InventoryItem } from './inventory.model';

export interface AddItemInput {
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  category?: InventoryCategory | null;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private supabase: SupabaseService) {}

  async getItems(): Promise<InventoryItem[]> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  }

  async addItem(input: AddItemInput): Promise<InventoryItem> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateQuantity(id: string, quantity: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('inventory_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('inventory_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async deductItems(deductions: Array<{ name: string; quantity: number }>): Promise<void> {
    const items = await this.getItems();
    for (const d of deductions) {
      const match = items.find(i => i.name.toLowerCase() === d.name.toLowerCase());
      if (!match) continue;
      const newQty = Math.max(0, match.quantity - d.quantity);
      if (newQty === 0) await this.deleteItem(match.id);
      else await this.updateQuantity(match.id, newQty);
    }
  }
}
