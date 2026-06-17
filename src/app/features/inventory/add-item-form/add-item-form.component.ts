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
