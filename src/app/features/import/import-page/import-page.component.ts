import { Component, OnInit, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ImportService } from '../import.service';
import { ImportJob } from '../../recipes/models/recipe.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [TranslatePipe, DatePipe],
  templateUrl: './import-page.component.html',
})
export class ImportPageComponent implements OnInit {
  jobs = signal<ImportJob[]>([]);
  uploading = signal(false);
  error = signal<string | null>(null);
  activeJobId = signal<string | null>(null);
  dragOver = signal(false);

  constructor(private importService: ImportService) {}

  async ngOnInit(): Promise<void> {
    this.jobs.set(await this.importService.getImportJobs());
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) await this.upload(file);
  }

  async onFileChange(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await this.upload(file);
  }

  private async upload(file: File): Promise<void> {
    this.uploading.set(true);
    this.error.set(null);
    try {
      const job = await this.importService.uploadFile(file);
      this.jobs.update(jobs => [job, ...jobs]);
      this.activeJobId.set(job.id);

      const unsub = this.importService.subscribeToJob(job.id, (updated) => {
        this.jobs.update(jobs => jobs.map(j => j.id === updated.id ? updated : j));
        if (updated.status === 'done' || updated.status === 'error') {
          this.activeJobId.set(null);
          unsub();
        }
      });
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.uploading.set(false);
    }
  }

  statusClass(status: string): string {
    return ({
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      done: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
    } as Record<string, string>)[status] ?? '';
  }
}
