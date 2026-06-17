import { TestBed } from '@angular/core/testing';
import { WakeLockService } from './wake-lock.service';

describe('WakeLockService', () => {
  let service: WakeLockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WakeLockService);
  });

  it('request() resolves without throwing when API unavailable', async () => {
    // jsdom doesn't have wakeLock — should degrade silently
    await expect(service.request()).resolves.not.toThrow();
  });

  it('release() is safe to call before request()', () => {
    expect(() => service.release()).not.toThrow();
  });
});
