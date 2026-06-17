import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  currentLang = signal(localStorage.getItem('lang') ?? 'es');

  constructor(
    protected auth: AuthService,
    private translate: TranslateService,
    private router: Router,
  ) {}

  switchLanguage(lang: string): void {
    this.currentLang.set(lang);
    localStorage.setItem('lang', lang);
    this.translate.use(lang);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }
}
