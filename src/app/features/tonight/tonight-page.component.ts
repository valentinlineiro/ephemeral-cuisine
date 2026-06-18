// src/app/features/tonight/tonight-page.component.ts
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestionService, ScoredRecipe, MoodFilter } from './suggestion.service';
import { predictFlavors } from './flavor-predictor';
import { InventoryItem, getExpiryStatus } from '../inventory/inventory.model';
import { SupabaseService } from '../../core/supabase.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { DietaryProfile } from '../../core/models/dietary-profile.model';
import { HealthService, WeeklySummary } from '../health/health.service';
import { sodiumColor, calorieColor } from '../health/health-color';
import { RecipeService } from '../recipes/recipe.service';
import { Recipe } from '../recipes/models/recipe.model';
import { MultiDishTimelineComponent } from '../timeline/multi-dish-timeline.component';

@Component({
  selector: 'app-tonight-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink, MultiDishTimelineComponent],
  templateUrl: './tonight-page.component.html',
})
export class TonightPageComponent implements OnInit {
  suggestions = signal<ScoredRecipe[]>([]);
  currentIndex = signal(0);
  loading = signal(true);
  expiringToday = signal<InventoryItem[]>([]);
  weeklySummary = signal<WeeklySummary | null>(null);
  profile = signal<DietaryProfile | null>(null);

  mood = signal<MoodFilter>('default');

  readonly moodOptions: Array<[MoodFilter, string]> = [
    ['default', '🎯'], ['comfort', '🛋️'], ['adventure', '✨'], ['impress', '⭐']
  ];

  current = computed(() => this.suggestions()[this.currentIndex()] ?? null);
  hasAlternatives = computed(() => this.suggestions().length > 1);

  currentFlavors = computed(() => {
    const s = this.current();
    if (!s) return [];
    const names = [
      ...s.recipe.ingredients.map((i: any) => i.name),
      ...s.matchedInventoryItems.map(i => i.name),
    ];
    return predictFlavors(names);
  });

  missingCount = computed(() =>
    Math.max(0, (this.current()?.recipe.ingredients.length ?? 0) -
                 (this.current()?.matchedInventoryItems.length ?? 0))
  );

  // Timeline overlay
  showTimeline = signal(false);
  timelineRecipes = signal<Recipe[]>([]);

  protected getExpiryStatus = getExpiryStatus;
  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;

  constructor(
    private suggestionService: SuggestionService,
    private supabase: SupabaseService,
    private dietaryProfile: DietaryProfileService,
    private healthService: HealthService,
    private recipeService: RecipeService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const [suggestions, invRes, profile] = await Promise.all([
      this.suggestionService.getSuggestions(this.mood()),
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

    this.healthService.getWeeklySummary(profile).then(s => this.weeklySummary.set(s)).catch(() => null);
  }

  async openTimeline(): Promise<void> {
    if (this.timelineRecipes().length === 0) {
      const recipes = await this.recipeService.search({}).catch(() => []);
      this.timelineRecipes.set(recipes);
    }
    this.showTimeline.set(true);
  }

  async setMood(m: MoodFilter): Promise<void> {
    this.mood.set(m);
    this.loading.set(true);
    this.currentIndex.set(0);
    const suggestions = await this.suggestionService.getSuggestions(m);
    this.suggestions.set(suggestions);
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
