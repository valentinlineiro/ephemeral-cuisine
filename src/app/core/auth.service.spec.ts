// src/app/core/auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const mockAuth = {
  getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
};

const mockSupabase = { client: { auth: mockAuth } };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: mockSupabase }],
    });
    service = TestBed.inject(AuthService);
  });

  it('session signal is null on init', () => {
    expect(service.session()).toBeNull();
  });

  it('user signal is null on init', () => {
    expect(service.user()).toBeNull();
  });

  it('signIn calls supabase signInWithOtp', async () => {
    await service.signIn('test@example.com');
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('signOut calls supabase signOut', async () => {
    await service.signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });
});
