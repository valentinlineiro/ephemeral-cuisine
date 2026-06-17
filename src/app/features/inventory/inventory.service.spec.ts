import { TestBed } from '@angular/core/testing';
import { InventoryService } from './inventory.service';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryItem } from './inventory.model';

const item: InventoryItem = {
  id: 'i1', user_id: 'u1', name: 'Chicken thighs', quantity: 4,
  unit: 'ud', expiry_date: '2026-06-19', category: 'protein',
  created_at: '', updated_at: '',
};

function makeClient(select: unknown, insert: unknown = null, update: unknown = null, del: unknown = null) {
  return {
    from: (_: string) => ({
      select: (_2: string) => ({
        order: (_3: string, _4: unknown) => Promise.resolve(select),
      }),
      insert: (_2: unknown) => ({
        select: () => ({ single: () => Promise.resolve(insert) }),
      }),
      update: (_2: unknown) => ({
        eq: (_3: string, _4: string) => Promise.resolve(update),
      }),
      delete: () => ({
        eq: (_3: string, _4: string) => Promise.resolve(del),
      }),
    }),
  };
}

describe('InventoryService', () => {
  function setup(s: unknown, i: unknown = null, u: unknown = null, d: unknown = null) {
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        { provide: SupabaseService, useValue: { client: makeClient(s, i, u, d) } },
      ],
    });
    return TestBed.inject(InventoryService);
  }

  it('getItems returns array', async () => {
    const svc = setup({ data: [item], error: null });
    expect(await svc.getItems()).toHaveLength(1);
  });

  it('getItems throws on error', async () => {
    const svc = setup({ data: null, error: new Error('db') });
    await expect(svc.getItems()).rejects.toThrow('db');
  });

  it('addItem inserts and returns new item', async () => {
    const svc = setup({ data: [], error: null }, { data: item, error: null });
    const result = await svc.addItem({ name: 'Chicken thighs', quantity: 4, unit: 'ud', expiry_date: '2026-06-19', category: 'protein' });
    expect(result.name).toBe('Chicken thighs');
  });

  it('updateQuantity sends patch', async () => {
    const svc = setup({ data: [], error: null }, null, { error: null });
    await expect(svc.updateQuantity('i1', 2)).resolves.not.toThrow();
  });

  it('deleteItem sends delete', async () => {
    const svc = setup({ data: [], error: null }, null, null, { error: null });
    await expect(svc.deleteItem('i1')).resolves.not.toThrow();
  });
});
