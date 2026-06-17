import { Component, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-ingredient-search',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './ingredient-search.component.html',
})
export class IngredientSearchComponent implements OnInit {
  ingredientsChanged = output<string[]>();
  queryChanged = output<string>();

  expanded = signal(false);
  query = signal('');
  suggestions = signal<string[]>([]);
  selected = signal<string[]>([]);
  filtered = signal<string[]>([]);
  inputText = '';

  constructor(private recipeService: RecipeService) {}

  async ngOnInit(): Promise<void> {
    const all = await this.recipeService.getIngredientSuggestions();
    this.suggestions.set(all);
    this.filtered.set(all.slice(0, 10));
  }

  onInputChange(value: string): void {
    this.inputText = value;
    if (this.expanded()) {
      this.filtered.set(
        this.suggestions()
          .filter(s => s.toLowerCase().includes(value.toLowerCase()) && !this.selected().includes(s))
          .slice(0, 10)
      );
    } else {
      this.query.set(value);
      this.queryChanged.emit(value);
    }
  }

  enterIngredientMode(): void {
    this.expanded.set(true);
    this.inputText = '';
    this.filtered.set(this.suggestions().filter(s => !this.selected().includes(s)).slice(0, 10));
  }

  exitIngredientMode(): void {
    this.expanded.set(false);
    this.inputText = '';
  }

  addIngredient(name: string): void {
    if (!this.selected().includes(name)) {
      this.selected.update(s => [...s, name]);
      this.ingredientsChanged.emit(this.selected());
    }
    this.inputText = '';
    this.filtered.set(this.suggestions().filter(s => !this.selected().includes(s)).slice(0, 10));
  }

  removeIngredient(name: string): void {
    this.selected.update(s => s.filter(i => i !== name));
    this.ingredientsChanged.emit(this.selected());
  }
}
