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
