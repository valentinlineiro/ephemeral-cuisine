export type InventoryCategory = 'protein' | 'produce' | 'dairy' | 'pantry' | 'spice' | 'other';

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  category: InventoryCategory | null;
  created_at: string;
  updated_at: string;
}

export type ExpiryStatus = 'expired' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'none';

export function getExpiryStatus(expiry_date: string | null): ExpiryStatus {
  if (!expiry_date) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiry_date);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'expired';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'this_week';
  return 'later';
}
