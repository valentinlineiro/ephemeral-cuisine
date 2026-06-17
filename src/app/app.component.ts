import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    protected auth: AuthService,
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('lang') ?? 'es';
    this.translate.use(saved);
  }
}
