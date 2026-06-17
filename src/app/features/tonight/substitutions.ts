interface DietaryFlags {
  gluten_free: boolean;
  lactose_free: boolean;
}

const SUBSTITUTION_RULES: Array<[string, string, keyof DietaryFlags]> = [
  ['soy sauce', 'tamari', 'gluten_free'],
  ['flour tortilla', 'corn tortilla', 'gluten_free'],
  ['wheat flour', 'rice flour', 'gluten_free'],
  ['bread crumbs', 'gluten-free bread crumbs', 'gluten_free'],
  ['pasta', 'rice pasta', 'gluten_free'],
  ['cream', 'cashew cream', 'lactose_free'],
  ['butter', 'coconut oil', 'lactose_free'],
  ['milk', 'oat milk', 'lactose_free'],
  ['parmesan', 'nutritional yeast', 'lactose_free'],
  ['yogurt', 'coconut yogurt', 'lactose_free'],
  ['cheese', 'vegan cheese', 'lactose_free'],
];

export function applySubstitutions(ingredients: string[], flags: DietaryFlags): string[] {
  return ingredients.map(ingredient => {
    const lower = ingredient.toLowerCase();
    for (const [original, substitute, flag] of SUBSTITUTION_RULES) {
      if (flags[flag] && lower.includes(original)) {
        return ingredient.replace(new RegExp(original, 'i'), substitute);
      }
    }
    return ingredient;
  });
}

export function needsSubstitution(ingredients: string[], flags: DietaryFlags): boolean {
  return ingredients.some(ingredient => {
    const lower = ingredient.toLowerCase();
    return SUBSTITUTION_RULES.some(([original, , flag]) => flags[flag] && lower.includes(original));
  });
}
