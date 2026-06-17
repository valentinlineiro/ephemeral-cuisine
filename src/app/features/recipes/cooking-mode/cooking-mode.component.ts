import { Component, input, output, OnInit, OnDestroy, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe, Step } from '../models/recipe.model';
import { WakeLockService } from './wake-lock.service';
import { StepTimerComponent } from './step-timer/step-timer.component';

interface StepGroup {
  groupIndex: number;
  steps: Step[];
  timersFinished: boolean[];
}

@Component({
  selector: 'app-cooking-mode',
  standalone: true,
  imports: [TranslatePipe, StepTimerComponent],
  templateUrl: './cooking-mode.component.html',
})
export class CookingModeComponent implements OnInit, OnDestroy {
  recipe = input.required<Recipe>();
  exit = output<void>();

  currentGroupIndex = signal(0);
  stepGroups = signal<StepGroup[]>([]);

  constructor(private wakeLock: WakeLockService) {}

  ngOnInit(): void {
    this.wakeLock.request();
    this.buildGroups();
  }

  ngOnDestroy(): void {
    this.wakeLock.release();
  }

  private buildGroups(): void {
    const steps = [...this.recipe().steps].sort((a, b) => a.order - b.order);
    const map = new Map<string, Step[]>();
    for (const step of steps) {
      const key = step.concurrent_group != null ? `g${step.concurrent_group}` : `s${step.order}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    this.stepGroups.set(
      Array.from(map.entries()).map(([, steps], i) => ({
        groupIndex: i,
        steps,
        timersFinished: steps.map(s => !s.time), // no timer = already "done"
      }))
    );
  }

  get currentGroup(): StepGroup {
    return this.stepGroups()[this.currentGroupIndex()];
  }

  get totalGroups(): number {
    return this.stepGroups().length;
  }

  get canAdvance(): boolean {
    return this.currentGroup?.timersFinished.every(Boolean) ?? false;
  }

  get cookSummary(): { totalMin: number; waitMin: number } {
    const groups = this.stepGroups();
    let totalMin = 0;
    let waitMin = 0;
    for (const g of groups) {
      const maxTimer = g.steps.reduce((m, s) => Math.max(m, s.time ?? 0), 0);
      totalMin += maxTimer;
      if (maxTimer > 5) waitMin += maxTimer;
    }
    return { totalMin, waitMin };
  }

  onTimerDone(stepIdx: number): void {
    this.stepGroups.update(groups => {
      const updated = [...groups];
      updated[this.currentGroupIndex()] = {
        ...updated[this.currentGroupIndex()],
        timersFinished: updated[this.currentGroupIndex()].timersFinished.map(
          (v, i) => i === stepIdx ? true : v
        ),
      };
      return updated;
    });
  }

  dismissTimer(stepIdx: number): void {
    this.onTimerDone(stepIdx);
  }

  advance(): void {
    if (this.currentGroupIndex() < this.totalGroups - 1) {
      this.currentGroupIndex.update(i => i + 1);
    } else {
      this.exit.emit();
    }
  }
}
