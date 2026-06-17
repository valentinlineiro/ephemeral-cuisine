import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<div class="flex items-center justify-center min-h-screen text-gray-500">Autenticando…</div>`,
})
export class AuthCallbackComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      if (this.auth.session()) {
        this.router.navigate(['/recipes'], { replaceUrl: true });
      }
    });
  }
}
