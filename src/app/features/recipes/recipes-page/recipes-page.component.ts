import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { AuthService } from '../../../core/auth.service';
import { Recipe, RecipeFilter } from '../models/recipe.model';
import { RecipeCardComponent } from '../recipe-card/recipe-card.component';
import { RecipeFilterComponent } from '../recipe-filter/recipe-filter.component';
import { IngredientSearchComponent } from '../ingredient-search/ingredient-search.component';

@Component({
  selector: 'app-recipes-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink, RecipeCardComponent, RecipeFilterComponent, IngredientSearchComponent],
  templateUrl: './recipes-page.component.html',
})
export class RecipesPageComponent implements OnInit {
  recipes = signal<Recipe[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  private filter: RecipeFilter = {};

  constructor(
    private recipeService: RecipeService,
    private auth: AuthService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async onFilterChanged(partial: Partial<RecipeFilter>): Promise<void> {
    this.filter = { ...this.filter, ...partial };
    await this.load();
  }

  async onQueryChanged(query: string): Promise<void> {
    this.filter = { ...this.filter, query: query || undefined };
    await this.load();
  }

  async onIngredientsChanged(ingredients: string[]): Promise<void> {
    this.filter = { ...this.filter, ingredients: ingredients.length ? ingredients : undefined };
    await this.load();
  }

  async onFavoriteToggled(recipeId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const isFav = await this.recipeService.toggleFavorite(recipeId, user.id);
    this.recipes.update(rs => rs.map(r => r.id === recipeId ? { ...r, is_favorite: isFav } : r));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.recipes.set(await this.recipeService.search(this.filter));
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
