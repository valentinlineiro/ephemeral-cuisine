import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-step-timer',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './step-timer.component.html',
})
export class StepTimerComponent implements OnInit, OnDestroy {
  durationMinutes = input.required<number>();
  done = output<void>();

  remainingSeconds = signal(0);
  finished = signal(false);
  private interval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.remainingSeconds.set(this.durationMinutes() * 60);
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const next = this.remainingSeconds() - 1;
      if (next <= 0) {
        this.remainingSeconds.set(0);
        this.finished.set(true);
        this.stop();
        this.vibrate();
        this.done.emit();
      } else {
        this.remainingSeconds.set(next);
      }
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  get display(): string {
    const s = this.remainingSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  private vibrate(): void {
    try { navigator.vibrate?.([300, 100, 300]); } catch {}
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
