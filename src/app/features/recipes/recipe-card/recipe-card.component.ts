import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../models/recipe.model';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './recipe-card.component.html',
})
export class RecipeCardComponent {
  recipe = input.required<Recipe>();
  favoriteToggled = output<string>();
}
