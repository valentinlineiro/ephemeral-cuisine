import { predictFlavors } from './flavor-predictor';

describe('predictFlavors', () => {
  it('returns bright for citrus ingredients', () => {
    expect(predictFlavors(['lemon', 'chicken'])).toContain('bright');
  });

  it('returns umami for soy sauce', () => {
    expect(predictFlavors(['soy sauce', 'garlic'])).toContain('umami');
  });

  it('returns aromatic for garlic', () => {
    expect(predictFlavors(['garlic', 'onion'])).toContain('aromatic');
  });

  it('returns at most 3 flavors', () => {
    const result = predictFlavors(['lemon', 'soy', 'chili', 'garlic', 'honey', 'cream']);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for unknown ingredients', () => {
    expect(predictFlavors(['xyz999'])).toHaveLength(0);
  });
});
