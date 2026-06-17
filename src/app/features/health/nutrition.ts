import { Nutrition } from '../cook-log/cook-log.model';

// Values per 100g. Portions: protein ~150g, each produce ~80g, seasoning ~5g.
const NUTRITION_TABLE: Record<string, Required<Nutrition>> = {
  // Proteins
  chicken:   { calories: 165, sodium_mg: 74,   protein_g: 31 },
  pollo:     { calories: 165, sodium_mg: 74,   protein_g: 31 },
  salmon:    { calories: 208, sodium_mg: 59,   protein_g: 20 },
  beef:      { calories: 250, sodium_mg: 72,   protein_g: 26 },
  ternera:   { calories: 250, sodium_mg: 72,   protein_g: 26 },
  pork:      { calories: 242, sodium_mg: 62,   protein_g: 27 },
  cerdo:     { calories: 242, sodium_mg: 62,   protein_g: 27 },
  tofu:      { calories: 76,  sodium_mg: 7,    protein_g: 8  },
  shrimp:    { calories: 99,  sodium_mg: 111,  protein_g: 24 },
  gambas:    { calories: 99,  sodium_mg: 111,  protein_g: 24 },
  tuna:      { calories: 132, sodium_mg: 47,   protein_g: 28 },
  atun:      { calories: 132, sodium_mg: 47,   protein_g: 28 },
  egg:       { calories: 155, sodium_mg: 124,  protein_g: 13 },
  huevo:     { calories: 155, sodium_mg: 124,  protein_g: 13 },
  // Produce
  tomato:    { calories: 18,  sodium_mg: 5,    protein_g: 1  },
  tomate:    { calories: 18,  sodium_mg: 5,    protein_g: 1  },
  pepper:    { calories: 31,  sodium_mg: 4,    protein_g: 1  },
  pimiento:  { calories: 31,  sodium_mg: 4,    protein_g: 1  },
  onion:     { calories: 40,  sodium_mg: 4,    protein_g: 1  },
  cebolla:   { calories: 40,  sodium_mg: 4,    protein_g: 1  },
  spinach:   { calories: 23,  sodium_mg: 79,   protein_g: 3  },
  espinaca:  { calories: 23,  sodium_mg: 79,   protein_g: 3  },
  avocado:   { calories: 160, sodium_mg: 7,    protein_g: 2  },
  aguacate:  { calories: 160, sodium_mg: 7,    protein_g: 2  },
  mango:     { calories: 60,  sodium_mg: 1,    protein_g: 1  },
  cucumber:  { calories: 16,  sodium_mg: 2,    protein_g: 1  },
  pepino:    { calories: 16,  sodium_mg: 2,    protein_g: 1  },
  garlic:    { calories: 149, sodium_mg: 17,   protein_g: 6  },
  ajo:       { calories: 149, sodium_mg: 17,   protein_g: 6  },
  // Seasonings (used ~5g)
  'soy sauce':  { calories: 53,  sodium_mg: 5493, protein_g: 8  },
  tamari:       { calories: 53,  sodium_mg: 4000, protein_g: 8  },
  salt:         { calories: 0,   sodium_mg: 38758, protein_g: 0 },
  sal:          { calories: 0,   sodium_mg: 38758, protein_g: 0 },
  miso:         { calories: 199, sodium_mg: 3728, protein_g: 12 },
};

function lookup(name: string, portionG: number): Required<Nutrition> {
  const lower = name.trim().toLowerCase();
  const key = Object.keys(NUTRITION_TABLE).find(k => lower.includes(k) || k.includes(lower));
  if (!key) return { calories: 0, sodium_mg: 0, protein_g: 0 };
  const per100 = NUTRITION_TABLE[key];
  return {
    calories:   Math.round((per100.calories   * portionG) / 100),
    sodium_mg:  Math.round((per100.sodium_mg  * portionG) / 100),
    protein_g:  Math.round((per100.protein_g  * portionG) / 100),
  };
}

function add(a: Required<Nutrition>, b: Required<Nutrition>): Required<Nutrition> {
  return {
    calories:  a.calories  + b.calories,
    sodium_mg: a.sodium_mg + b.sodium_mg,
    protein_g: a.protein_g + b.protein_g,
  };
}

export function estimateNutrition(
  protein: string,
  produce: string[],
  seasoning: string,
  servings = 2,
): Required<Nutrition> {
  let total = lookup(protein, 150);
  for (const p of produce) total = add(total, lookup(p, 80));
  if (seasoning) total = add(total, lookup(seasoning, 5));
  const s = Math.max(1, servings);
  return {
    calories:  Math.round(total.calories  / s),
    sodium_mg: Math.round(total.sodium_mg / s),
    protein_g: Math.round(total.protein_g / s),
  };
}
