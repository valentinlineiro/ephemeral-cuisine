import { TestBed } from '@angular/core/testing';
import { TechniqueService } from './technique.service';
import { SupabaseService } from '../../core/supabase.service';
import { Technique } from './technique.model';

const technique: Technique = {
  id: 't1', user_id: 'u1', name: 'Stir-fry',
  base_steps: [{ order: 1, text: 'Heat wok' }],
  equipment: ['wok'], skill_level: 'intermediate', created_at: '',
};

function makeClient(listResult: unknown, singleResult: unknown = null, mutateResult: unknown = null) {
  return {
    from: (_: string) => ({
      select: (_2: string) => ({
        order: (_3: string, _4: unknown) => Promise.resolve(listResult),
        eq: (_3: string, _4: string) => ({
          single: () => Promise.resolve(singleResult),
        }),
      }),
      insert: (_2: unknown) => ({
        select: () => ({ single: () => Promise.resolve(mutateResult) }),
      }),
      update: (_2: unknown) => ({
        eq: (_3: string, _4: string) => Promise.resolve(mutateResult),
      }),
      delete: () => ({
        eq: (_3: string, _4: string) => Promise.resolve(mutateResult),
      }),
    }),
  };
}

function makeBatchClient(
  techResult: { data: unknown; error: null },
  cooksResult: { data: unknown; error: null },
) {
  return {
    from: (table: string) => {
      if (table === 'techniques') {
        return {
          select: (_: string) => ({
            order: (_2: string, _3: unknown) => Promise.resolve(techResult),
          }),
        };
      }
      // cooked_versions
      return { select: (_: string) => Promise.resolve(cooksResult) };
    },
  };
}

describe('TechniqueService', () => {
  function setup(l: unknown, s: unknown = null, m: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        TechniqueService,
        { provide: SupabaseService, useValue: { client: makeClient(l, s, m) } },
      ],
    });
    return TestBed.inject(TechniqueService);
  }

  it('getTechniques returns array', async () => {
    const svc = setup({ data: [technique], error: null });
    expect(await svc.getTechniques()).toHaveLength(1);
  });

  it('getTechniques throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db') });
    await expect(svc.getTechniques()).rejects.toThrow('db');
  });

  it('addTechnique inserts and returns technique', async () => {
    const svc = setup({ data: [], error: null }, null, { data: technique, error: null });
    const result = await svc.addTechnique({ name: 'Stir-fry', base_steps: [], equipment: [], skill_level: 'beginner' });
    expect(result.name).toBe('Stir-fry');
  });

  it('deleteTechnique sends delete', async () => {
    const svc = setup({ data: [], error: null }, null, { error: null });
    await expect(svc.deleteTechnique('t1')).resolves.not.toThrow();
  });
});

describe('TechniqueService.getTechniquesWithStats', () => {
  function setupBatch(
    techResult: { data: unknown; error: null },
    cooksResult: { data: unknown; error: null },
  ) {
    TestBed.configureTestingModule({
      providers: [
        TechniqueService,
        { provide: SupabaseService, useValue: { client: makeBatchClient(techResult, cooksResult) } },
      ],
    });
    return TestBed.inject(TechniqueService);
  }

  it('returns empty array when no techniques', async () => {
    const svc = setupBatch({ data: [], error: null }, { data: [], error: null });
    expect(await svc.getTechniquesWithStats()).toEqual([]);
  });

  it('computes cook_count from linked cooked_versions', async () => {
    const svc = setupBatch(
      { data: [technique], error: null },
      { data: [
        { technique_id: 't1', ratings: { self: 8 } },
        { technique_id: 't1', ratings: { self: 9 } },
      ], error: null },
    );
    const result = await svc.getTechniquesWithStats();
    expect(result[0].cook_count).toBe(2);
  });

  it('computes avg_rating from self ratings', async () => {
    const svc = setupBatch(
      { data: [technique], error: null },
      { data: [
        { technique_id: 't1', ratings: { self: 8 } },
        { technique_id: 't1', ratings: { self: 10 } },
      ], error: null },
    );
    const result = await svc.getTechniquesWithStats();
    expect(result[0].avg_rating).toBe(9);
  });

  it('computes mastery grade (5 cooks avg 9 → B+)', async () => {
    const svc = setupBatch(
      { data: [technique], error: null },
      {
        data: Array.from({ length: 5 }, () => ({ technique_id: 't1', ratings: { self: 9 } })),
        error: null,
      },
    );
    const result = await svc.getTechniquesWithStats();
    expect(result[0].mastery).toBe('B+');
  });

  it('ignores cooks with null technique_id', async () => {
    const svc = setupBatch(
      { data: [technique], error: null },
      { data: [{ technique_id: null, ratings: { self: 9 } }], error: null },
    );
    const result = await svc.getTechniquesWithStats();
    expect(result[0].cook_count).toBe(0);
  });
});
