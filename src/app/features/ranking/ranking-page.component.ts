import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RankingService, RankingData } from './ranking.service';

@Component({
  selector: 'app-ranking-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './ranking-page.component.html',
})
export class RankingPageComponent implements OnInit {
  data = signal<RankingData | null>(null);
  loading = signal(true);

  constructor(private rankingService: RankingService) {}

  async ngOnInit(): Promise<void> {
    this.data.set(await this.rankingService.getRankings());
    this.loading.set(false);
  }

  formatRating(rating: number): string {
    return rating.toFixed(1);
  }
}
