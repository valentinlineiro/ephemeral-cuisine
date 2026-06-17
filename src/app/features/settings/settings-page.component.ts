import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';
import { DietaryProfileService } from '../../core/dietary-profile.service';
import { EQUIPMENT_KEYS, EquipmentKey, FamilyMember } from '../../core/models/dietary-profile.model';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent implements OnInit {
  currentLang = signal(localStorage.getItem('lang') ?? 'es');
  saving = signal(false);
  error = signal<string | null>(null);

  // dietary
  maxSodium = signal(1500);
  calorieTarget = signal(2200);
  proteinTarget = signal(120);

  // equipment
  readonly equipmentKeys = EQUIPMENT_KEYS;
  ownedEquipment = signal<Set<EquipmentKey>>(new Set());

  // family members
  familyMembers = signal<FamilyMember[]>([]);
  newMemberName = signal('');

  constructor(
    protected auth: AuthService,
    private translate: TranslateService,
    private router: Router,
    private dietaryProfile: DietaryProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.dietaryProfile.getProfile();
      if (profile) {
        this.maxSodium.set(profile.max_sodium_mg);
        this.calorieTarget.set(profile.calorie_target);
        this.proteinTarget.set(profile.protein_target_g);
        this.ownedEquipment.set(new Set(profile.equipment as EquipmentKey[]));
        this.familyMembers.set(profile.family_members);
      }
    } catch {
      // no profile yet — defaults are fine
    }
  }

  toggleEquipment(key: EquipmentKey): void {
    const current = new Set(this.ownedEquipment());
    if (current.has(key)) current.delete(key);
    else current.add(key);
    this.ownedEquipment.set(current);
  }

  hasEquipment(key: EquipmentKey): boolean {
    return this.ownedEquipment().has(key);
  }

  addFamilyMember(): void {
    const name = this.newMemberName().trim();
    if (!name) return;
    this.familyMembers.update(m => [...m, { name, restrictions: [], dislikes: [] }]);
    this.newMemberName.set('');
  }

  removeFamilyMember(index: number): void {
    this.familyMembers.update(m => m.filter((_, i) => i !== index));
  }

  toggleRestriction(index: number, restriction: 'gluten_free' | 'lactose_free'): void {
    this.familyMembers.update(members =>
      members.map((m, i) => {
        if (i !== index) return m;
        const has = m.restrictions.includes(restriction);
        return {
          ...m,
          restrictions: has
            ? m.restrictions.filter(r => r !== restriction)
            : [...m.restrictions, restriction],
        };
      })
    );
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.dietaryProfile.upsertProfile({
        max_sodium_mg: this.maxSodium(),
        calorie_target: this.calorieTarget(),
        protein_target_g: this.proteinTarget(),
        equipment: [...this.ownedEquipment()],
        family_members: this.familyMembers(),
      });
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.saving.set(false);
    }
  }

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
