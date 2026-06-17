import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-ranking-page',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'ranking.title' | translate }}</h1>
      <p class="text-gray-500 mt-2">{{ 'ranking.coming_soon' | translate }}</p>
    </div>
  `,
})
export class RankingPageComponent {}
