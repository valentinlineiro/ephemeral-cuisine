import { getSwapsFor } from './swap-calculator';

describe('getSwapsFor', () => {
  it('returns swaps when ingredient matches a known entry', () => {
    const swaps = getSwapsFor('chicken thigh');
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps[0].from).toContain('chicken');
  });

  it('returns swaps for salmon', () => {
    const swaps = getSwapsFor('salmon');
    expect(swaps.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown ingredient', () => {
    expect(getSwapsFor('durian paste')).toHaveLength(0);
  });

  it('swap entry has required fields with numeric deltas', () => {
    const swaps = getSwapsFor('chicken');
    expect(typeof swaps[0].calories_delta).toBe('number');
    expect(typeof swaps[0].sodium_delta).toBe('number');
    expect(typeof swaps[0].protein_delta).toBe('number');
    expect(typeof swaps[0].cook_time_delta).toBe('number');
  });
});
