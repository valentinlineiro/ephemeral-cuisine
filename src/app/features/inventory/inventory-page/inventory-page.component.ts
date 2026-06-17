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
