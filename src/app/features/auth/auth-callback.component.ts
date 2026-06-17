import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<div class="flex items-center justify-center min-h-screen"><p class="text-gray-500">Autenticando…</p></div>`,
})
export class AuthCallbackComponent implements OnInit {
  constructor(private supabase: SupabaseService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    if (data.session) {
      this.router.navigate(['/recipes'], { replaceUrl: true });
    } else {
      // PKCE: exchange the code from the URL
      const { error } = await this.supabase.client.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        this.router.navigate(['/login'], { replaceUrl: true });
      } else {
        this.router.navigate(['/recipes'], { replaceUrl: true });
      }
    }
  }
}
