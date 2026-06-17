import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-tonight-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './tonight-page.component.html',
})
export class TonightPageComponent implements OnInit {
  suggestions = signal<ScoredRecipe[]>([]);
  currentIndex = signal(0);
  loading = signal(true);
  expiringToday = signal<InventoryItem[]>([]);

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  protected getExpiryStatus = getExpiryStatus;

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes] = await Promise.all([
      this.suggestionService.getSuggestions(),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
    ]);

    this.suggestions.set(suggestions.filter(s => s.missingEquipment.length === 0 || s.score > 0));
    this.expiringToday.set(
      (invRes.data ?? []).filter((i: InventoryItem) =>
        ['expired', 'today', 'tomorrow'].includes(getExpiryStatus(i.expiry_date))
      )
    );
    this.loading.set(false);
  }

  next(): void {
    this.currentIndex.update(i => Math.min(i + 1, this.suggestions().length - 1));
  }

  prev(): void {
    this.currentIndex.update(i => Math.max(i - 1, 0));
  }

  matchedNames(items: InventoryItem[]): string {
    return items.map(i => i.name).join(', ');
  }
}
