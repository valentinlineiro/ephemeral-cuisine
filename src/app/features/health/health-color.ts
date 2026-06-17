type HealthColor = 'text-green-600' | 'text-yellow-600' | 'text-red-600';

/** Sodium per meal vs daily budget. Green <35%, yellow 35–60%, red ≥60%. */
export function sodiumColor(sodium_mg: number, budget_mg: number): HealthColor {
  const ratio = sodium_mg / budget_mg;
  if (ratio < 0.35) return 'text-green-600';
  if (ratio < 0.60) return 'text-yellow-600';
  return 'text-red-600';
}

/** Calories per meal vs daily target. Green <40%, yellow 40–60%, red ≥60%. */
export function calorieColor(calories: number, target: number): HealthColor {
  const ratio = calories / target;
  if (ratio < 0.40) return 'text-green-600';
  if (ratio < 0.60) return 'text-yellow-600';
  return 'text-red-600';
}

/** Protein per meal vs daily target÷3. Green ≥90%, yellow 50–90%, red <50%. */
export function proteinColor(protein_g: number, daily_target_g: number): HealthColor {
  const mealTarget = daily_target_g / 3;
  const ratio = protein_g / mealTarget;
  if (ratio >= 0.9) return 'text-green-600';
  if (ratio >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}
