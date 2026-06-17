import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn(this.email, this.password);
      this.router.navigate(['/recipes']);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
