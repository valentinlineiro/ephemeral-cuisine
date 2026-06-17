import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe } from './suggestion.service';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';
import { HealthService, WeeklySummary } from '../health/health.service';
import { sodiumColor, calorieColor } from '../health/health-color';

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
  weeklySummary = signal<WeeklySummary | null>(null);
  profile = signal<DietaryProfile | null>(null);

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  protected getExpiryStatus = getExpiryStatus;
  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
    private healthService: HealthService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes, profile] = await Promise.all([
      this.suggestionService.getSuggestions(),
      this.supabase.client.from('inventory_items').select('*').order('expiry_date', { ascending: true }),
      this.dietaryProfile.getProfile().catch(() => null),
    ]);

    this.profile.set(profile);
    this.suggestions.set(suggestions.filter(s => s.missingEquipment.length === 0 || s.score > 0));
    this.expiringToday.set(
      (invRes.data ?? []).filter((i: InventoryItem) =>
        ['expired', 'today', 'tomorrow'].includes(getExpiryStatus(i.expiry_date))
      )
    );
    this.loading.set(false);

    // Load weekly summary in background (non-blocking)
    this.healthService.getWeeklySummary(profile).then(s => this.weeklySummary.set(s)).catch(() => null);
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
