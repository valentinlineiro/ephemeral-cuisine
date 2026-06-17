import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Technique } from '../technique.model';
import { TechniqueService, AddTechniqueInput } from '../technique.service';

@Component({
  selector: 'app-techniques-page',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './techniques-page.component.html',
})
export class TechniquesPageComponent implements OnInit {
  techniques = signal<Technique[]>([]);
  loading = signal(true);
  showForm = signal(false);

  newName = signal('');
  newSkillLevel = signal<'beginner' | 'intermediate' | 'advanced'>('beginner');
  newEquipment = signal('');
  saving = signal(false);
  formError = signal<string | null>(null);

  constructor(private techniqueService: TechniqueService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.techniques.set(await this.techniqueService.getTechniques());
    this.loading.set(false);
  }

  async addTechnique(): Promise<void> {
    if (!this.newName().trim()) return;
    this.saving.set(true);
    this.formError.set(null);
    try {
      const input: AddTechniqueInput = {
        name: this.newName().trim(),
        skill_level: this.newSkillLevel(),
        equipment: this.newEquipment().split(',').map(s => s.trim()).filter(Boolean),
        base_steps: [],
      };
      await this.techniqueService.addTechnique(input);
      this.newName.set('');
      this.newEquipment.set('');
      this.showForm.set(false);
      await this.load();
    } catch (e: any) {
      this.formError.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTechnique(id: string): Promise<void> {
    await this.techniqueService.deleteTechnique(id);
    await this.load();
  }
}
