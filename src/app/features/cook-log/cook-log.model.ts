export interface Combo {
  protein: string;
  produce: string[];
  seasoning: string;
}

export interface Nutrition {
  calories?: number;
  sodium_mg?: number;
  protein_g?: number;
}

export interface LeftoverItem {
  name: string;
  quantity_g: number;
}

export interface CookedVersion {
  id: string;
  user_id: string;
  recipe_id: string | null;
  technique_id: string | null;
  cooked_at: string;
  combo: Combo;
  ratings: Record<string, number>;
  notes: string | null;
  modifications: string[];
  nutrition: Nutrition | null;
  family_present: string[];
  leftovers: { items: LeftoverItem[] } | null;
}

export interface CookLogInput {
  recipe_id?: string;
  technique_id?: string;
  combo: Combo;
  ratings: Record<string, number>;
  notes?: string;
  modifications?: string[];
  nutrition?: Nutrition;
  family_present: string[];
  leftovers?: { items: LeftoverItem[] };
}
