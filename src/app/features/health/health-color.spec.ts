import { sodiumColor, calorieColor, proteinColor } from './health-color';

describe('sodiumColor', () => {
  // budget = 1500mg. green < 35%, yellow 35–60%, red > 60%
  it('returns green when sodium is well under budget', () => {
    expect(sodiumColor(200, 1500)).toBe('text-green-600');
  });
  it('returns yellow when sodium is approaching budget', () => {
    expect(sodiumColor(700, 1500)).toBe('text-yellow-600');
  });
  it('returns red when sodium exceeds 60% of budget', () => {
    expect(sodiumColor(1200, 1500)).toBe('text-red-600');
  });
});

describe('calorieColor', () => {
  // target = 2200. green < 40%, yellow 40–60%, red > 60%
  it('returns green when calories are well under target', () => {
    expect(calorieColor(400, 2200)).toBe('text-green-600');
  });
  it('returns yellow when calories are in the middle range', () => {
    expect(calorieColor(950, 2200)).toBe('text-yellow-600');
  });
  it('returns red when calories exceed 60% of target per meal', () => {
    expect(calorieColor(1400, 2200)).toBe('text-red-600');
  });
});

describe('proteinColor', () => {
  // per-meal protein target = daily_target / 3. green ≥90%, yellow 50–90%, red <50%
  it('returns green when protein meets the per-meal target', () => {
    expect(proteinColor(40, 120)).toBe('text-green-600');  // 40g / (120/3=40g) = 100%
  });
  it('returns yellow when protein is moderate', () => {
    expect(proteinColor(25, 120)).toBe('text-yellow-600'); // 25/40 = 62.5%
  });
  it('returns red when protein is very low', () => {
    expect(proteinColor(10, 120)).toBe('text-red-600');    // 10/40 = 25%
  });
});
