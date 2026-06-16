// src/app/core/supabase.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('exposes a supabase client', () => {
    expect(service.client).toBeDefined();
    expect(typeof service.client.from).toBe('function');
  });

  it('exposes the auth namespace', () => {
    expect(service.client.auth).toBeDefined();
  });
});
