// src/app/features/timeline/multi-dish-timeline.component.ts
import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../recipes/models/recipe.model';
import { DishEntry, TimelineSlot, buildTimeline } from './timeline.model';

type Phase = 'setup' | 'active' | 'done';

@Component({
  selector: 'app-multi-dish-timeline',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './multi-dish-timeline.component.html',
})
export class MultiDishTimelineComponent implements OnInit, OnDestroy {
  recipes = input<Recipe[]>([]);
  done = output<void>();

  phase = signal<Phase>('setup');

  // Setup state
  targetTimeStr = signal('');
  targetTimeError = signal<string | null>(null);
  targetTime = signal<Date | null>(null);
  dishes = signal<DishEntry[]>([]);

  // Library search
  libraryQuery = signal('');
  showLibrary = signal(false);
  filteredRecipes = computed(() => {
    const q = this.libraryQuery().toLowerCase().trim();
    const all = this.recipes();
    return (q ? all.filter(r => r.name.toLowerCase().includes(q)) : all).slice(0, 8);
  });

  // Manual add
  manualName = signal('');
  manualMinutes = signal(20);

  // Active state
  slots = signal<TimelineSlot[]>([]);
  currentAlert = computed(() => this.slots().find(s => s.status === 'alert') ?? null);
  countdowns = signal<Record<string, number>>({});

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const d = new Date(Date.now() + 45 * 60_000);
    const rawMin = d.getMinutes();
    const rounded = Math.round(rawMin / 5) * 5;
    if (rounded >= 60) {
      d.setHours(d.getHours() + 1);
      d.setMinutes(0);
    } else {
      d.setMinutes(rounded);
    }
    this.targetTimeStr.set(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  }

  ngOnDestroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  get canGenerate(): boolean {
    return this.dishes().length >= 2 && this.targetTimeError() === null;
  }

  addFromLibrary(recipe: Recipe): void {
    const dish: DishEntry = {
      id: crypto.randomUUID(),
      name: recipe.name,
      cookMinutes: recipe.cook_time ?? recipe.total_time ?? 30,
      recipeId: recipe.id,
    };
    this.dishes.update(d => [...d, dish]);
    this.libraryQuery.set('');
    this.showLibrary.set(false);
  }

  addManual(): void {
    const name = this.manualName().trim();
    if (!name || this.manualMinutes() < 1) return;
    this.dishes.update(d => [...d, { id: crypto.randomUUID(), name, cookMinutes: this.manualMinutes() }]);
    this.manualName.set('');
    this.manualMinutes.set(20);
  }

  removeDish(id: string): void {
    this.dishes.update(d => d.filter(dish => dish.id !== id));
  }

  generate(): void {
    const str = this.targetTimeStr();
    if (!/^\d{2}:\d{2}$/.test(str)) {
      this.targetTimeError.set('invalid');
      return;
    }
    const [h, m] = str.split(':').map(Number);
    if (h > 23 || m > 59) {
      this.targetTimeError.set('invalid');
      return;
    }
    this.targetTimeError.set(null);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    this.targetTime.set(target);
    this.slots.set(buildTimeline(this.dishes(), target));
    this.phase.set('active');
    this.startTick();
  }

  private startTick(): void {
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 15_000);
  }

  private tick(): void {
    const now = Date.now();
    this.slots.update(slots =>
      slots.map(s =>
        s.status === 'pending' && now >= s.startAt.getTime()
          ? { ...s, status: 'alert' as const }
          : s
      )
    );
    const cd: Record<string, number> = {};
    for (const s of this.slots()) {
      cd[s.dish.id] = Math.max(0, Math.round((s.startAt.getTime() - Date.now()) / 60_000));
    }
    this.countdowns.set(cd);
    if (this.slots().length > 0 && this.slots().every(s => s.status === 'started')) {
      if (this.tickInterval) clearInterval(this.tickInterval);
      this.phase.set('done');
    }
  }

  dismissAlert(slot: TimelineSlot): void {
    this.slots.update(slots =>
      slots.map(s => s.dish.id === slot.dish.id ? { ...s, status: 'started' as const } : s)
    );
    if (this.slots().every(s => s.status === 'started')) {
      if (this.tickInterval) clearInterval(this.tickInterval);
      this.phase.set('done');
    }
  }

  formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  close(): void {
    this.done.emit();
  }
}
