import { estimateNutrition } from './nutrition';

describe('estimateNutrition', () => {
  it('returns non-zero calories for a known protein', () => {
    const result = estimateNutrition('chicken', [], '', 1);
    expect(result.calories).toBeGreaterThan(0);
    expect(result.protein_g).toBeGreaterThan(0);
  });

  it('adds sodium from soy sauce seasoning', () => {
    const withSoy = estimateNutrition('chicken', [], 'soy sauce', 1);
    const withoutSoy = estimateNutrition('chicken', [], '', 1);
    expect(withSoy.sodium_mg!).toBeGreaterThan(withoutSoy.sodium_mg!);
  });

  it('divides totals by servings', () => {
    const one = estimateNutrition('chicken', [], '', 1);
    const two = estimateNutrition('chicken', [], '', 2);
    expect(two.calories!).toBeCloseTo(one.calories! / 2, 0);
  });

  it('adds produce contributions', () => {
    const withProduce = estimateNutrition('chicken', ['avocado'], '', 1);
    const without = estimateNutrition('chicken', [], '', 1);
    expect(withProduce.calories!).toBeGreaterThan(without.calories!);
  });

  it('returns zeros for unknown ingredients', () => {
    const result = estimateNutrition('xyz123', [], '', 1);
    expect(result.calories).toBe(0);
    expect(result.sodium_mg).toBe(0);
    expect(result.protein_g).toBe(0);
  });
});
