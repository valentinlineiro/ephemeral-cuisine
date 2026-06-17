import { TestBed } from '@angular/core/testing';
import { CookLogService } from './cook-log.service';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { CookedVersion, CookLogInput } from './cook-log.model';

const logInput: CookLogInput = {
  recipe_id: 'r1',
  combo: { protein: 'chicken', produce: ['peppers'], seasoning: 'soy' },
  ratings: { self: 8, partner: 9 },
  family_present: ['partner'],
};

const cookEntry: CookedVersion = {
  id: 'cv1', user_id: 'u1', recipe_id: 'r1', technique_id: null,
  cooked_at: '', combo: logInput.combo, ratings: logInput.ratings,
  notes: null, modifications: [], nutrition: null,
  family_present: ['partner'], leftovers: null,
};

function makeClient(insertResult: unknown, listResult: unknown = null) {
  return {
    from: (_: string) => ({
      insert: (_2: unknown) => ({
        select: () => ({ single: () => Promise.resolve(insertResult) }),
      }),
      select: (_2: string) => ({
        eq: (_3: string, _4: string) => ({
          order: (_5: string, _6: unknown) => Promise.resolve(listResult),
        }),
        order: (_3: string, _4: unknown) => Promise.resolve(listResult),
      }),
    }),
  };
}

describe('CookLogService', () => {
  const mockInventory = { deductItems: jest.fn().mockResolvedValue(undefined) };

  function setup(i: unknown, l: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        CookLogService,
        { provide: SupabaseService, useValue: { client: makeClient(i, l) } },
        { provide: InventoryService, useValue: mockInventory },
      ],
    });
    return TestBed.inject(CookLogService);
  }

  it('logCook inserts and returns cooked version', async () => {
    const svc = setup({ data: cookEntry, error: null });
    const result = await svc.logCook(logInput);
    expect(result.combo.protein).toBe('chicken');
  });

  it('logCook deducts ingredients from inventory', async () => {
    mockInventory.deductItems.mockClear();
    const svc = setup({ data: cookEntry, error: null });
    await svc.logCook({ ...logInput, inventory_deductions: [{ name: 'chicken', quantity: 2 }] });
    expect(mockInventory.deductItems).toHaveBeenCalledWith([{ name: 'chicken', quantity: 2 }]);
  });

  it('getHistoryForRecipe returns array', async () => {
    const svc = setup(null, { data: [cookEntry], error: null });
    expect(await svc.getHistoryForRecipe('r1')).toHaveLength(1);
  });

  it('logCook throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db') });
    await expect(svc.logCook(logInput)).rejects.toThrow('db');
  });
});
