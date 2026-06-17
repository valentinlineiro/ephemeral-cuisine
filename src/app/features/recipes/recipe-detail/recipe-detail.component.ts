import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../models/recipe.model';
import { CookingModeComponent } from '../cooking-mode/cooking-mode.component';
import { PostCookFlowComponent } from '../../cook-log/post-cook-flow/post-cook-flow.component';
import { CookLogService } from '../../cook-log/cook-log.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';
import { DietaryProfile } from '../../../core/models/dietary-profile.model';
import { Nutrition } from '../../cook-log/cook-log.model';
import { sodiumColor, calorieColor, proteinColor } from '../../health/health-color';
import { SwapEntry, getSwapsFor } from '../../health/swap-calculator';

const PROTEIN_KEYS = ['chicken', 'salmon', 'beef', 'pork', 'tofu', 'shrimp', 'tuna',
                      'pollo', 'ternera', 'cerdo', 'gambas', 'atun', 'egg', 'huevo'];

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [TranslatePipe, CookingModeComponent, PostCookFlowComponent],
  templateUrl: './recipe-detail.component.html',
})
export class RecipeDetailComponent implements OnInit {
  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  cookingMode = signal(false);
  finishedCooking = signal(false);
  profile = signal<DietaryProfile | null>(null);
  avgNutrition = signal<Nutrition | null>(null);
  swapIngredient = signal<string | null>(null);
  selectedSwap = signal<SwapEntry | null>(null);
  availableSwaps = computed(() =>
    this.swapIngredient() ? getSwapsFor(this.swapIngredient()!) : []
  );

  protected sodiumColor = sodiumColor;
  protected calorieColor = calorieColor;
  protected proteinColor = proteinColor;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private cookLog: CookLogService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const [recipe, cooks, profile] = await Promise.all([
        this.recipeService.getById(id),
        this.cookLog.getHistoryForRecipe(id),
        this.dietaryProfile.getProfile().catch(() => null),
      ]);
      this.recipe.set(recipe);
      this.profile.set(profile);

      const withNutrition = cooks.filter(c => c.nutrition);
      if (withNutrition.length > 0) {
        this.avgNutrition.set({
          calories:  Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.calories  ?? 0), 0) / withNutrition.length),
          sodium_mg: Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.sodium_mg ?? 0), 0) / withNutrition.length),
          protein_g: Math.round(withNutrition.reduce((s, c) => s + (c.nutrition!.protein_g ?? 0), 0) / withNutrition.length),
        });
      }

      const proteinIng = recipe?.ingredients.find(i =>
        PROTEIN_KEYS.some(p => i.name.toLowerCase().includes(p))
      );
      if (proteinIng) this.swapIngredient.set(proteinIng.name);
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/recipes']);
  }

  toggleSwap(swap: SwapEntry): void {
    this.selectedSwap.update(s => s?.to === swap.to ? null : swap);
  }

  get stepGroups(): Array<{ group: number | null; steps: Recipe['steps'] }> {
    const steps = this.recipe()?.steps ?? [];
    const map = new Map<number | null, Recipe['steps']>();
    for (const step of steps) {
      const key = step.concurrent_group ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    return Array.from(map.entries()).map(([group, steps]) => ({ group, steps }));
  }
}
