export interface FamilyMember {
  name: string;
  restrictions: Array<'gluten_free' | 'lactose_free'>;
  dislikes: string[];
}

export interface DietaryProfile {
  user_id: string;
  max_sodium_mg: number;
  calorie_target: number;
  protein_target_g: number;
  equipment: string[];
  family_members: FamilyMember[];
  updated_at: string;
}

export const EQUIPMENT_KEYS = [
  'oven', 'microwave', 'air_fryer', 'hand_mixer', 'stand_mixer',
  'bamboo_mat', 'sharp_knife', 'food_processor', 'blender',
  'pressure_cooker', 'slow_cooker', 'wok', 'cast_iron',
] as const;

export type EquipmentKey = typeof EQUIPMENT_KEYS[number];
