export interface SwapEntry {
  from: string;
  to: string;
  calories_delta: number;
  sodium_delta: number;
  protein_delta: number;
  cook_time_delta: number;
  note: string;
}

export const SWAP_TABLE: SwapEntry[] = [
  { from: 'chicken thigh', to: 'chicken breast',  calories_delta: -90,  sodium_delta: -10,   protein_delta: +4,  cook_time_delta: -5, note: 'Leaner but drier' },
  { from: 'chicken',       to: 'tofu',             calories_delta: -65,  sodium_delta: -50,   protein_delta: -17, cook_time_delta: -5, note: 'Vegan, GF/DF ✓' },
  { from: 'chicken',       to: 'shrimp',           calories_delta: -50,  sodium_delta: +30,   protein_delta: -5,  cook_time_delta: -8, note: 'Faster cook' },
  { from: 'salmon',        to: 'tuna',             calories_delta: -60,  sodium_delta: -5,    protein_delta: +6,  cook_time_delta: 0,  note: 'Higher protein' },
  { from: 'salmon',        to: 'tofu',             calories_delta: -110, sodium_delta: -40,   protein_delta: -10, cook_time_delta: -5, note: 'DF/GF ✓, vegan' },
  { from: 'beef',          to: 'chicken',          calories_delta: -85,  sodium_delta: -10,   protein_delta: +3,  cook_time_delta: -5, note: 'Lower fat' },
  { from: 'pork',          to: 'chicken',          calories_delta: -90,  sodium_delta: -20,   protein_delta: +3,  cook_time_delta: -3, note: 'Lower fat' },
  { from: 'soy sauce',     to: 'tamari',           calories_delta: 0,    sodium_delta: -1200, protein_delta: 0,   cook_time_delta: 0,  note: 'GF ✓' },
  { from: 'cream',         to: 'cashew cream',     calories_delta: -15,  sodium_delta: -5,    protein_delta: +1,  cook_time_delta: 0,  note: 'DF ✓' },
  { from: 'butter',        to: 'olive oil',        calories_delta: +20,  sodium_delta: -820,  protein_delta: 0,   cook_time_delta: 0,  note: 'DF ✓, less sodium' },
  { from: 'pasta',         to: 'rice pasta',       calories_delta: 0,    sodium_delta: 0,     protein_delta: -1,  cook_time_delta: +2, note: 'GF ✓' },
];

export function getSwapsFor(ingredient: string): SwapEntry[] {
  const lower = ingredient.toLowerCase();
  return SWAP_TABLE.filter(s => lower.includes(s.from) || s.from.includes(lower));
}
