import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Technique, TechniqueWithStats, MasteryGrade, MASTERY_COLOR, getNextStep } from '../technique.model';
import { TechniqueService, AddTechniqueInput } from '../technique.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';

interface BootcampTier {
  tier: number;
  name: string;
  equipment: string[];
  examples: string[];
  unlocked: boolean;
}

const BOOTCAMP_TIER_DEFS: Array<Omit<BootcampTier, 'unlocked'>> = [
  {
    tier: 1,
    name: 'No equipment',
    equipment: [],
    examples: ['Panna cotta', 'Chocolate mousse', 'Tiramisú', 'Truffles'],
  },
  {
    tier: 2,
    name: 'Oven + hand mixer',
    equipment: ['oven', 'hand_mixer'],
    examples: ['Brownies', 'Muffins', 'Cheesecake', 'Crème brûlée'],
  },
  {
    tier: 3,
    name: 'Stand mixer',
    equipment: ['stand_mixer'],
    examples: ['Layer cake', 'Macarons', 'Croissants', 'Laminated dough'],
  },
];

@Component({
  selector: 'app-techniques-page',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './techniques-page.component.html',
})
export class TechniquesPageComponent implements OnInit {
  techniques = signal<TechniqueWithStats[]>([]);
  loading = signal(true);
  showForm = signal(false);

  newName = signal('');
  newSkillLevel = signal<'beginner' | 'intermediate' | 'advanced'>('beginner');
  newEquipment = signal('');
  saving = signal(false);
  formError = signal<string | null>(null);

  bootcampTiers = signal<BootcampTier[]>([]);

  protected masteryColor = (m: MasteryGrade): string => MASTERY_COLOR[m];
  protected nextStep = (t: TechniqueWithStats): string | null => getNextStep(t.name, t.mastery);

  constructor(
    private techniqueService: TechniqueService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    const profile = await this.dietaryProfile.getProfile();
    const equipment = new Set(profile?.equipment ?? []);
    this.bootcampTiers.set(BOOTCAMP_TIER_DEFS.map(t => ({
      ...t,
      unlocked: t.equipment.every(e => equipment.has(e)),
    })));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.techniques.set(await this.techniqueService.getTechniquesWithStats());
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
