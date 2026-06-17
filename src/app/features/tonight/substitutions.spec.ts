import { applySubstitutions } from './substitutions';

describe('applySubstitutions', () => {
  it('replaces soy sauce with tamari when gluten_free', () => {
    const result = applySubstitutions(['soy sauce', 'garlic'], { gluten_free: true, lactose_free: false });
    expect(result).toContain('tamari');
    expect(result).not.toContain('soy sauce');
  });

  it('replaces cream with cashew cream when lactose_free', () => {
    const result = applySubstitutions(['cream', 'onion'], { gluten_free: false, lactose_free: true });
    expect(result).toContain('cashew cream');
    expect(result).not.toContain('cream');
  });

  it('replaces flour tortilla with corn tortilla when gluten_free', () => {
    const result = applySubstitutions(['flour tortilla'], { gluten_free: true, lactose_free: false });
    expect(result).toContain('corn tortilla');
  });

  it('leaves non-restricted ingredients unchanged', () => {
    const result = applySubstitutions(['chicken', 'onion'], { gluten_free: false, lactose_free: false });
    expect(result).toEqual(['chicken', 'onion']);
  });

  it('handles empty list', () => {
    expect(applySubstitutions([], { gluten_free: true, lactose_free: true })).toEqual([]);
  });
});
