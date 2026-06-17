import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'inventory.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'inventory.coming_soon' | translate }}</p>
    </div>
  `,
})
export class InventoryPageComponent {}
