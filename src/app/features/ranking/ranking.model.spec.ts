import {
  aggregateByRecipe,
  rankByAudience,
  rankByTechnique,
  mostImproved,
  worthRepeating,
  RankedDish,
} from './ranking.model';
import { CookedVersion } from '../cook-log/cook-log.model';

function makeCook(recipe_id: string, technique_id: string | null, ratings: Record<string, number>, cooked_at = '2026-01-01'): CookedVersion {
  return {
    id: Math.random().toString(), user_id: 'u1', recipe_id, technique_id,
    cooked_at, combo: { protein: 'chicken', produce: [], seasoning: 'salt' },
    ratings, notes: null, modifications: [], nutrition: null,
    family_present: Object.keys(ratings).filter(k => k !== 'self'), leftovers: null,
  };
}

const cooks: CookedVersion[] = [
  makeCook('r1', 't1', { self: 9, partner: 8 }, '2026-01-01'),
  makeCook('r1', 't1', { self: 7, partner: 9 }, '2026-01-15'),
  makeCook('r2', 't1', { self: 8.7 }, '2026-02-01'),
  makeCook('r3', null, { self: 5 }, '2026-01-05'),
  makeCook('r3', null, { self: 9 }, '2026-02-10'),
];

describe('aggregateByRecipe', () => {
  it('groups cooks by recipe_id', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')?.cook_count).toBe(2);
    expect(result.get('r2')?.cook_count).toBe(1);
  });

  it('computes avg_self_rating', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')!.avg_self_rating).toBeCloseTo(8);
  });

  it('computes per-person avg', () => {
    const result = aggregateByRecipe(cooks);
    expect(result.get('r1')!.avg_by_person['partner']).toBeCloseTo(8.5);
  });
});

describe('rankByAudience', () => {
  it('returns recipes sorted by specific person rating', () => {
    const agg = aggregateByRecipe(cooks);
    const ranked = rankByAudience(agg, 'partner');
    expect(ranked[0].recipe_id).toBe('r1');
  });
});

describe('mostImproved', () => {
  it('returns recipes where last rating > first rating', () => {
    const result = mostImproved(cooks);
    expect(result.some(r => r.recipe_id === 'r3')).toBe(true);
    const r3 = result.find(r => r.recipe_id === 'r3')!;
    expect(r3.improvement).toBeCloseTo(4);
  });
});

describe('worthRepeating', () => {
  it('returns recipes with avg >= 8.5 cooked only once', () => {
    const agg = aggregateByRecipe(cooks);
    const result = worthRepeating(agg);
    expect(result.some(r => r.recipe_id === 'r2')).toBe(true);
  });
});

import { computeTrend, computeFlavorDiversity } from './ranking.model';

const makeCookForAnalytics = (overrides: Partial<CookedVersion>): CookedVersion => ({
  id: '1', user_id: 'u', recipe_id: 'r1', technique_id: null,
  cooked_at: new Date().toISOString(),
  combo: { protein: 'chicken', produce: [], seasoning: '' },
  ratings: { self: 8 },
  notes: null, modifications: [], nutrition: null, family_present: [], leftovers: null,
  ...overrides,
});

describe('computeTrend', () => {
  it('identifies dominant protein from recent cooks', () => {
    const cooks = [
      makeCookForAnalytics({ combo: { protein: 'chicken', produce: [], seasoning: '' } }),
      makeCookForAnalytics({ combo: { protein: 'chicken', produce: [], seasoning: '' } }),
      makeCookForAnalytics({ combo: { protein: 'salmon', produce: [], seasoning: '' } }),
    ];
    const trend = computeTrend(cooks, []);
    expect(trend.dominantProtein).toBe('chicken');
  });

  it('counts total recent cooks', () => {
    const cooks = [makeCookForAnalytics({}), makeCookForAnalytics({}), makeCookForAnalytics({})];
    const trend = computeTrend(cooks, []);
    expect(trend.cookCountRecent).toBe(3);
  });
});

describe('computeFlavorDiversity', () => {
  it('detects citrus from lemon in produce', () => {
    const cooks = [makeCookForAnalytics({ combo: { protein: 'chicken', produce: ['lemon'], seasoning: '' } })];
    const result = computeFlavorDiversity(cooks);
    const citrus = result.categories.find(c => c.name === 'citrus');
    expect(citrus?.count).toBeGreaterThan(0);
  });

  it('lists uncovered categories as missing', () => {
    const cooks = [makeCookForAnalytics({ combo: { protein: 'chicken', produce: ['lemon'], seasoning: '' } })];
    const result = computeFlavorDiversity(cooks);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('covers categories when diverse ingredients used', () => {
    const cooks = [
      makeCookForAnalytics({ combo: { protein: 'salmon', produce: ['lemon'], seasoning: 'miso' } }),
      makeCookForAnalytics({ combo: { protein: 'chicken', produce: ['chili'], seasoning: 'cumin' } }),
    ];
    const result = computeFlavorDiversity(cooks);
    expect(result.categories.filter(c => c.count > 0).length).toBeGreaterThan(0);
  });
});
