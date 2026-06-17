import { Component, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RecipeFilter, Difficulty } from '../models/recipe.model';

@Component({
  selector: 'app-recipe-filter',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './recipe-filter.component.html',
})
export class RecipeFilterComponent {
  filterChanged = output<Partial<RecipeFilter>>();

  expanded = signal(false);
  favorites = signal(false);
  selectedCuisine = signal<string | null>(null);
  selectedMaxTime = signal<number | null>(null);
  selectedDifficulty = signal<Difficulty | null>(null);

  readonly cuisines = ['italiana', 'española', 'mexicana', 'japonesa', 'americana', 'francesa'];
  readonly times = [{ label: '< 15 min', value: 15 }, { label: '< 30 min', value: 30 }, { label: '< 60 min', value: 60 }];
  readonly difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  toggleFavorites(): void {
    this.favorites.update(v => !v);
    this.emit();
  }

  setCuisine(c: string): void {
    this.selectedCuisine.set(this.selectedCuisine() === c ? null : c);
    this.emit();
  }

  setMaxTime(t: number): void {
    this.selectedMaxTime.set(this.selectedMaxTime() === t ? null : t);
    this.emit();
  }

  setDifficulty(d: Difficulty): void {
    this.selectedDifficulty.set(this.selectedDifficulty() === d ? null : d);
    this.emit();
  }

  private emit(): void {
    this.filterChanged.emit({
      favorites_only: this.favorites() || undefined,
      cuisine_type: this.selectedCuisine() ?? undefined,
      max_time: this.selectedMaxTime() ?? undefined,
      difficulty: this.selectedDifficulty() ?? undefined,
    });
  }
}
