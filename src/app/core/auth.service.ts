// src/app/core/auth.service.ts
import { Injectable, OnDestroy, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  private subscription: { unsubscribe: () => void } | null = null;

  constructor(private supabase: SupabaseService) {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
    });

    const { data } = this.supabase.client.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
    this.subscription = data.subscription;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
