import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../models/recipe.model';
import { CookingModeComponent } from '../cooking-mode/cooking-mode.component';
import { PostCookFlowComponent } from '../../cook-log/post-cook-flow/post-cook-flow.component';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.recipe.set(await this.recipeService.getById(id));
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/recipes']);
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
