import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Recipe } from '../../../features/recipes/models/recipe.model';
import { CookLogService, LeftoverBlueprint } from '../cook-log.service';
import { DietaryProfileService } from '../../../core/dietary-profile.service';
import { FamilyMember } from '../../../core/models/dietary-profile.model';
import { LeftoverItem } from '../cook-log.model';

@Component({
  selector: 'app-post-cook-flow',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './post-cook-flow.component.html',
})
export class PostCookFlowComponent implements OnInit {
  recipe = input.required<Recipe>();
  done = output<void>();

  familyMembers = signal<FamilyMember[]>([]);
  familyPresent = signal<string[]>([]);

  protein = signal('');
  produce = signal('');
  seasoning = signal('');

  selfRating = signal(7);
  familyRatings = signal<Record<string, number>>({});

  modifications = signal('');
  notes = signal('');

  leftoverName = signal('');
  leftoverQty = signal(200);
  leftovers = signal<LeftoverItem[]>([]);

  saving = signal(false);
  error = signal<string | null>(null);
  blueprint = signal<LeftoverBlueprint | null>(null);
  saved = signal(false);

  constructor(
    private cookLog: CookLogService,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const profile = await this.dietaryProfile.getProfile().catch(() => null);
    this.familyMembers.set(profile?.family_members ?? []);
  }

  togglePresent(name: string): void {
    this.familyPresent.update(p =>
      p.includes(name) ? p.filter(n => n !== name) : [...p, name]
    );
  }

  setFamilyRating(name: string, value: number): void {
    this.familyRatings.update(r => ({ ...r, [name]: value }));
  }

  addLeftover(): void {
    const name = this.leftoverName().trim();
    if (!name) return;
    this.leftovers.update(l => [...l, { name, quantity_g: this.leftoverQty() }]);
    this.leftoverName.set('');
    this.leftoverQty.set(200);
  }

  removeLeftover(index: number): void {
    this.leftovers.update(l => l.filter((_, i) => i !== index));
  }

  finish(): void {
    this.done.emit();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const ratings: Record<string, number> = { self: this.selfRating(), ...this.familyRatings() };
      const produceList = this.produce().split(',').map(s => s.trim()).filter(Boolean);
      const modsList = this.modifications().split(',').map(s => s.trim()).filter(Boolean);

      await this.cookLog.logCook({
        recipe_id: this.recipe().id,
        combo: {
          protein: this.protein().trim(),
          produce: produceList,
          seasoning: this.seasoning().trim(),
        },
        ratings,
        notes: this.notes().trim() || undefined,
        modifications: modsList,
        family_present: this.familyPresent(),
        leftovers: this.leftovers().length ? { items: this.leftovers() } : undefined,
        inventory_deductions: [
          ...(this.protein().trim() ? [{ name: this.protein().trim(), quantity: 1 }] : []),
          ...produceList.map(p => ({ name: p, quantity: 1 })),
        ],
      });
      const bp = this.cookLog.generateLeftoverBlueprint(this.leftovers());
      this.blueprint.set(bp);
      this.saved.set(true);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }
}
