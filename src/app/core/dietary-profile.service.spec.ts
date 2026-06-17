import { TestBed } from '@angular/core/testing';
import { DietaryProfileService } from './dietary-profile.service';
import { SupabaseService } from './supabase.service';
import { DietaryProfile } from './models/dietary-profile.model';

const mockProfile: DietaryProfile = {
  user_id: 'u1',
  max_sodium_mg: 1500,
  calorie_target: 2200,
  protein_target_g: 120,
  equipment: ['oven', 'wok'],
  family_members: [{ name: 'Partner', restrictions: ['gluten_free', 'lactose_free'], dislikes: ['mushrooms'] }],
  updated_at: '2026-06-17T00:00:00Z',
};

function makeSupabaseMock(getResult: unknown, upsertResult: unknown) {
  return {
    client: {
      from: (_: string) => ({
        select: (_: string) => ({ maybeSingle: () => Promise.resolve(getResult) }),
        upsert: (_: unknown) => ({
          select: () => ({ single: () => Promise.resolve(upsertResult) }),
        }),
      }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
      },
    },
  };
}

describe('DietaryProfileService', () => {
  function setup(getResult: unknown, upsertResult: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        DietaryProfileService,
        { provide: SupabaseService, useValue: makeSupabaseMock(getResult, upsertResult) },
      ],
    });
    return TestBed.inject(DietaryProfileService);
  }

  it('getProfile returns null when no row exists', async () => {
    const svc = setup({ data: null, error: null });
    expect(await svc.getProfile()).toBeNull();
  });

  it('getProfile returns profile when row exists', async () => {
    const svc = setup({ data: mockProfile, error: null });
    const result = await svc.getProfile();
    expect(result?.max_sodium_mg).toBe(1500);
    expect(result?.equipment).toContain('oven');
  });

  it('getProfile throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db error') });
    await expect(svc.getProfile()).rejects.toThrow('db error');
  });

  it('upsertProfile merges user_id and returns saved row', async () => {
    const svc = setup({ data: null, error: null }, { data: mockProfile, error: null });
    const result = await svc.upsertProfile({ max_sodium_mg: 1500 });
    expect(result.user_id).toBe('u1');
  });

  it('upsertProfile throws on error', async () => {
    const svc = setup({ data: null, error: null }, { data: null, error: new Error('write error') });
    await expect(svc.upsertProfile({ max_sodium_mg: 1500 })).rejects.toThrow('write error');
  });
});
