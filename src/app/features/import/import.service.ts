import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { ImportJob } from '../recipes/models/recipe.model';

@Injectable({ providedIn: 'root' })
export class ImportService {
  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
  ) {}

  async uploadFile(file: File): Promise<ImportJob> {
    const user = this.auth.user();
    if (!user) throw new Error('Not authenticated');

    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await this.supabase.client.storage
      .from('recipe-imports')
      .upload(path, file);
    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await this.supabase.client
      .from('import_jobs')
      .insert({ user_id: user.id, file_path: path, status: 'pending' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ImportJob;
  }

  async getImportJobs(): Promise<ImportJob[]> {
    const { data, error } = await this.supabase.client
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as ImportJob[];
  }

  subscribeToJob(jobId: string, callback: (job: ImportJob) => void): () => void {
    const channel = this.supabase.client
      .channel(`import_job_${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'import_jobs',
        filter: `id=eq.${jobId}`,
      }, (payload) => callback(payload.new as ImportJob))
      .subscribe();

    return () => { this.supabase.client.removeChannel(channel); };
  }
}
