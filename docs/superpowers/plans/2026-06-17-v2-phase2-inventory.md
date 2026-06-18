# v2 Phase 2-B: Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Inventory screen — add items with name/qty/unit/expiry, view stock grouped by expiry urgency with colour coding, adjust quantities, and delete items.

**Architecture:** `InventoryService` wraps all Supabase CRUD for `inventory_items`. `InventoryPageComponent` renders a grouped list (expired / today / tomorrow / this week / later / no expiry) using `getExpiryStatus()` from `inventory.model.ts`. Adding items uses a bottom sheet form. Expiry groups are sorted: expired and today at top to drive action.

**Tech Stack:** Angular 18 signals, Supabase, Tailwind, TranslatePipe.

**Prerequisite:** Plan 2-A must be complete (`inventory_items` table exists, `InventoryItem` and `getExpiryStatus` are defined).

---

### Task 1: InventoryService

**Files:**
- Create: `src/app/features/inventory/inventory.service.ts`
- Create: `src/app/features/inventory/inventory.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/features/inventory/inventory.service.spec.ts
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
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --testPathPattern="inventory.service" --no-coverage
```

Expected: FAIL — `Cannot find module './inventory.service'`

- [ ] **Step 3: Implement service**

```typescript
// src/app/features/inventory/inventory.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { InventoryCategory, InventoryItem } from './inventory.model';

export interface AddItemInput {
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  category?: InventoryCategory | null;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private supabase: SupabaseService) {}

  async getItems(): Promise<InventoryItem[]> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  }

  async addItem(input: AddItemInput): Promise<InventoryItem> {
    const { data, error } = await this.supabase.client
      .from('inventory_items')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateQuantity(id: string, quantity: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('inventory_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('inventory_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async deductItems(deductions: Array<{ name: string; quantity: number }>): Promise<void> {
    const items = await this.getItems();
    for (const d of deductions) {
      const match = items.find(i => i.name.toLowerCase() === d.name.toLowerCase());
      if (!match) continue;
      const newQty = Math.max(0, match.quantity - d.quantity);
      if (newQty === 0) await this.deleteItem(match.id);
      else await this.updateQuantity(match.id, newQty);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="inventory.service" --no-coverage
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/inventory/inventory.service.ts src/app/features/inventory/inventory.service.spec.ts
git commit -m "feat(inventory): add InventoryService with CRUD and deduction"
```

---

### Task 2: Add-item form component

**Files:**
- Create: `src/app/features/inventory/add-item-form/add-item-form.component.ts`

This is a bottom-sheet form that emits the new item on save.

- [ ] **Step 1: Create component**

```typescript
// src/app/features/inventory/add-item-form/add-item-form.component.ts
import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InventoryService, AddItemInput } from '../inventory.service';
import { InventoryCategory } from '../inventory.model';

const CATEGORIES: InventoryCategory[] = ['protein', 'produce', 'dairy', 'pantry', 'spice', 'other'];
const UNITS = ['ud', 'g', 'kg', 'ml', 'l', 'taza', 'cucharada'];

@Component({
  selector: 'app-add-item-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 bg-black/40 z-40" (click)="cancelled.emit()"></div>
    <div class="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 z-50 flex flex-col gap-4">
      <h2 class="text-lg font-bold text-gray-900">{{ 'inventory.add_item' | translate }}</h2>

      <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {{ 'inventory.name' | translate }}
        <input type="text" [(ngModel)]="name" name="name" [placeholder]="'inventory.name_placeholder' | translate"
          class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none" />
      </label>

      <div class="flex gap-3">
        <label class="flex flex-col gap-1 text-sm font-medium text-gray-700 flex-1">
          {{ 'inventory.quantity' | translate }}
          <input type="number" [(ngModel)]="quantity" name="qty" min="0.1" step="0.1"
            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-medium text-gray-700 w-28">
          {{ 'inventory.unit' | translate }}
          <select [(ngModel)]="unit" name="unit"
            class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none">
            @for (u of units; track u) { <option [value]="u">{{ u }}</option> }
          </select>
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {{ 'inventory.expiry' | translate }}
        <input type="date" [(ngModel)]="expiryDate" name="expiry"
          class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none" />
      </label>

      <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {{ 'inventory.category' | translate }}
        <select [(ngModel)]="category" name="cat"
          class="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none">
          <option value="">—</option>
          @for (c of categories; track c) { <option [value]="c">{{ 'inventory.cat_' + c | translate }}</option> }
        </select>
      </label>

      @if (error()) { <p class="text-red-600 text-sm">{{ error() }}</p> }

      <div class="flex gap-3">
        <button (click)="cancelled.emit()" class="flex-1 border border-gray-300 rounded-lg py-3 text-gray-700 font-medium">
          {{ 'inventory.cancel' | translate }}
        </button>
        <button (click)="save()" [disabled]="saving() || !name.trim()"
          class="flex-1 bg-primary text-white rounded-lg py-3 font-medium disabled:opacity-50">
          {{ 'inventory.save' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class AddItemFormComponent {
  saved = output<void>();
  cancelled = output<void>();

  name = '';
  quantity = 1;
  unit = 'ud';
  expiryDate = '';
  category: InventoryCategory | '' = '';

  readonly units = UNITS;
  readonly categories = CATEGORIES;
  saving = signal(false);
  error = signal<string | null>(null);

  constructor(private inventory: InventoryService) {}

  async save(): Promise<void> {
    if (!this.name.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const input: AddItemInput = {
        name: this.name.trim(),
        quantity: this.quantity,
        unit: this.unit,
        expiry_date: this.expiryDate || null,
        category: this.category || null,
      };
      await this.inventory.addItem(input);
      this.saved.emit();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/inventory/add-item-form/
git commit -m "feat(inventory): add AddItemFormComponent bottom sheet"
```

---

### Task 3: Inventory page — grouped list

**Files:**
- Modify: `src/app/features/inventory/inventory-page/inventory-page.component.ts`

- [ ] **Step 1: Replace the stub with the real page**

```typescript
// src/app/features/inventory/inventory-page/inventory-page.component.ts
import { Component, OnInit, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { InventoryItem, ExpiryStatus, getExpiryStatus } from '../inventory.model';
import { InventoryService } from '../inventory.service';
import { AddItemFormComponent } from '../add-item-form/add-item-form.component';

interface ExpiryGroup {
  status: ExpiryStatus;
  labelKey: string;
  items: InventoryItem[];
  urgent: boolean;
}

const GROUP_ORDER: ExpiryStatus[] = ['expired', 'today', 'tomorrow', 'this_week', 'later', 'none'];

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [TranslatePipe, AddItemFormComponent],
  templateUrl: './inventory-page.component.html',
})
export class InventoryPageComponent implements OnInit {
  items = signal<InventoryItem[]>([]);
  loading = signal(true);
  showForm = signal(false);

  groups = computed<ExpiryGroup[]>(() => {
    const map = new Map<ExpiryStatus, InventoryItem[]>();
    for (const item of this.items()) {
      const s = getExpiryStatus(item.expiry_date);
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(item);
    }
    return GROUP_ORDER
      .filter(s => map.has(s))
      .map(s => ({
        status: s,
        labelKey: `inventory.group_${s}`,
        items: map.get(s)!,
        urgent: s === 'expired' || s === 'today',
      }));
  });

  urgentCount = computed(() =>
    this.items().filter(i => ['expired', 'today'].includes(getExpiryStatus(i.expiry_date))).length
  );

  constructor(private inventory: InventoryService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.inventory.getItems());
    this.loading.set(false);
  }

  async adjustQuantity(item: InventoryItem, delta: number): Promise<void> {
    const newQty = Math.max(0, item.quantity + delta);
    if (newQty === 0) {
      await this.inventory.deleteItem(item.id);
    } else {
      await this.inventory.updateQuantity(item.id, newQty);
    }
    await this.load();
  }

  async deleteItem(id: string): Promise<void> {
    await this.inventory.deleteItem(id);
    await this.load();
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/features/inventory/inventory-page/inventory-page.component.html -->
<div class="p-4 pb-24">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold text-gray-900">{{ 'inventory.title' | translate }}</h1>
    <button (click)="showForm.set(true)"
      class="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-light shadow">
      +
    </button>
  </div>

  @if (urgentCount() > 0) {
    <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
      ⚠️ {{ urgentCount() }} {{ 'inventory.expiry_alert' | translate }}
    </div>
  }

  @if (loading()) {
    <p class="text-gray-400 text-center py-12">{{ 'inventory.loading' | translate }}</p>
  } @else if (items().length === 0) {
    <div class="text-center py-16">
      <p class="text-gray-400 mb-4">{{ 'inventory.empty' | translate }}</p>
      <button (click)="showForm.set(true)" class="bg-primary text-white px-6 py-3 rounded-lg font-medium">
        {{ 'inventory.add_first' | translate }}
      </button>
    </div>
  } @else {
    @for (group of groups(); track group.status) {
      <section class="mb-6">
        <h2 [class]="group.urgent ? 'text-sm font-semibold text-red-600 uppercase tracking-wide mb-2' : 'text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2'">
          {{ group.labelKey | translate }}
        </h2>
        <div class="flex flex-col gap-2">
          @for (item of group.items; track item.id) {
            <div class="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 truncate">{{ item.name }}</p>
                @if (item.expiry_date) {
                  <p [class]="group.urgent ? 'text-xs text-red-500' : 'text-xs text-gray-400'">
                    {{ item.expiry_date }}
                  </p>
                }
              </div>
              <div class="flex items-center gap-2">
                <button (click)="adjustQuantity(item, -1)" class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center">−</button>
                <span class="w-16 text-center text-sm font-medium text-gray-800">{{ item.quantity }} {{ item.unit }}</span>
                <button (click)="adjustQuantity(item, 1)" class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center">+</button>
              </div>
              <button (click)="deleteItem(item.id)" class="text-red-400 ml-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
          }
        </div>
      </section>
    }
  }
</div>

@if (showForm()) {
  <app-add-item-form
    (saved)="showForm.set(false); load()"
    (cancelled)="showForm.set(false)" />
}
```

- [ ] **Step 3: Add new i18n keys to both JSON files**

In `es.json`, merge into the existing `"inventory"` section:
```json
"inventory": {
  "title": "Inventario",
  "add_item": "Añadir ingrediente",
  "name": "Nombre",
  "name_placeholder": "Ej. Pollo, Yogur, Cilantro",
  "quantity": "Cantidad",
  "unit": "Unidad",
  "expiry": "Fecha de caducidad",
  "category": "Categoría",
  "save": "Guardar",
  "cancel": "Cancelar",
  "loading": "Cargando…",
  "empty": "Tu inventario está vacío",
  "add_first": "Añade tu primer ingrediente",
  "expiry_alert": "ingrediente(s) caducan hoy o ya han caducado",
  "group_expired": "Caducados",
  "group_today": "Caducan hoy",
  "group_tomorrow": "Mañana",
  "group_this_week": "Esta semana",
  "group_later": "Más adelante",
  "group_none": "Sin fecha",
  "cat_protein": "Proteína",
  "cat_produce": "Verdura / Fruta",
  "cat_dairy": "Lácteo",
  "cat_pantry": "Despensa",
  "cat_spice": "Especias",
  "cat_other": "Otro"
}
```

Mirror in `en.json` with English labels.

- [ ] **Step 4: Build and verify**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.`

- [ ] **Step 5: Final commit and push**

```bash
git add src/app/features/inventory/ public/assets/i18n/
git commit -m "feat(inventory): full inventory page — grouped list, add form, quantity controls"
git push
```
