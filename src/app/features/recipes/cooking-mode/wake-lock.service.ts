import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private lock: WakeLockSentinel | null = null;

  async request(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.lock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Permission denied or API unavailable — degrade silently
    }
  }

  release(): void {
    this.lock?.release().catch(() => {});
    this.lock = null;
  }
}
