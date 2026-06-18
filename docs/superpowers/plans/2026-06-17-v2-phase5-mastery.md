# v2 Phase 5 Remaining: Mastery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 5 by adding "My Version" (living personal recipe from cook history), recipe export to clipboard, waste prediction insight on the inventory page, and a dessert improvement bootcamp tier display in the Techniques page.

**Architecture:** "My version" aggregates modifications + notes from `cooked_versions` already loaded in recipe detail. Export is a pure formatting function + `navigator.clipboard`. Waste prediction is a computed getter on the existing inventory groups. Dessert bootcamp is a static tier display keyed to technique mastery.

**Already done from Phase 5:**
- ✅ Hall of Fame / Ranking screen (Plan 2-E)
- ✅ Technique mastery scores A-F (calcMastery in technique.model.ts)
- ✅ Family feedback widget (post-cook flow)
- ✅ Leftover blueprint (CookLogService)
- ✅ Cooking confidence score (MASTERY_COLOR)

**Tech Stack:** Angular 18 signals, navigator.clipboard, TranslatePipe, Tailwind.

---

## File Map

**Modified:**
- `src/app/features/recipes/recipe-detail/recipe-detail.component.ts` — add `myVersion` signal + `exportRecipe()` + `exportCopied` signal
- `src/app/features/recipes/recipe-detail/recipe-detail.component.html` — "My version" card + export button
- `src/app/features/inventory/inventory-page/inventory-page.component.ts` — `wasteInsight` computed
- `src/app/features/inventory/inventory-page/inventory-page.component.html` — waste insight banner
- `src/app/features/techniques/techniques-page/techniques-page.component.ts` — dessert bootcamp section
- `src/app/features/techniques/techniques-page/techniques-page.component.html` — bootcamp UI
- `public/assets/i18n/es.json`, `en.json` — new keys

---

### Task 1: "My Version" + recipe export in recipe detail

**Files:**
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.ts`
- Modify: `src/app/features/recipes/recipe-detail/recipe-detail.component.html`

Read both files completely before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/recipe-detail/recipe-detail.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/recipes/recipe-detail/recipe-detail.component.html
```

- [ ] **Step 1: Add MyVersion interface + signals to component**

Add interface at the top of the file (outside the class, after imports):
```typescript
interface MyVersion {
  cookCount: number;
  modifications: string[];
  latestNote: string | null;
  favoriteProtein: string | null;
}
```

Add new signals to the class:
```typescript
myVersion = signal<MyVersion | null>(null);
exportCopied = signal(false);
```

- [ ] **Step 2: Populate myVersion in ngOnInit**

In `ngOnInit`, after the existing cook history is loaded (after `if (withNutrition.length > 0) { ... }`), add:

```typescript
if (cooks.length > 0) {
  const allMods = [...new Set(cooks.flatMap(c => c.modifications ?? []).filter(Boolean))];
  const latestNote = cooks.find(c => c.notes)?.notes ?? null;
  const proteinCounts = new Map<string, number>();
  for (const c of cooks) {
    const p = c.combo.protein?.trim().toLowerCase();
    if (p) proteinCounts.set(p, (proteinCounts.get(p) ?? 0) + 1);
  }
  const favoriteProtein = [...proteinCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  this.myVersion.set({ cookCount: cooks.length, modifications: allMods, latestNote, favoriteProtein });
}
```

- [ ] **Step 3: Add exportRecipe() method to the class**

```typescript
async exportRecipe(): Promise<void> {
  const r = this.recipe();
  if (!r) return;
  const mv = this.myVersion();

  let md = `# ${r.name}\n`;
  if (r.cuisine_type) md += `*${r.cuisine_type}*\n\n`;
  if (r.description) md += `${r.description}\n\n`;
  if (r.total_time) md += `⏱ ${r.total_time} min · 👥 ${r.servings ?? 2} servings\n\n`;

  md += `## Ingredients\n`;
  for (const ing of r.ingredients) {
    const q = ing.qty ? `${ing.qty}${ing.unit ? ' ' + ing.unit : ''} ` : '';
    md += `- ${q}${ing.name}${ing.prep ? ' — ' + ing.prep : ''}\n`;
  }

  md += `\n## Steps\n`;
  for (const step of [...r.steps].sort((a, b) => a.order - b.order)) {
    md += `${step.order}. ${step.text}${step.time ? ` *(${step.time} min)*` : ''}\n`;
  }

  if (mv && mv.modifications.length > 0) {
    md += `\n## My tweaks\n`;
    for (const mod of mv.modifications) md += `- ${mod}\n`;
  }
  if (mv?.latestNote) md += `\n> ${mv.latestNote}\n`;

  try {
    await navigator.clipboard.writeText(md);
    this.exportCopied.set(true);
    setTimeout(() => this.exportCopied.set(false), 2000);
  } catch {
    // clipboard not available
  }
}
```

- [ ] **Step 4: Add "My Version" card and export button to the template**

Find the section in the template where the `@if (recipe()) { ... }` block has the main content. After the health badges block (or after the swap calculator block if present), but BEFORE the steps section, insert the "My Version" card:

```html
<!-- My version -->
@if (myVersion()) {
  <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-semibold text-sm text-indigo-900">{{ 'recipe.my_version_title' | translate }} ({{ myVersion()!.cookCount }}×)</h3>
      <button (click)="exportRecipe()"
        class="text-xs bg-white border border-indigo-200 rounded-full px-3 py-1 text-indigo-700 font-medium">
        {{ exportCopied() ? '✓ ' + ('recipe.copied' | translate) : ('recipe.export' | translate) }}
      </button>
    </div>
    @if (myVersion()!.favoriteProtein) {
      <p class="text-xs text-indigo-700 mb-1">🥩 {{ 'recipe.fav_protein' | translate }}: <strong>{{ myVersion()!.favoriteProtein }}</strong></p>
    }
    @if (myVersion()!.modifications.length > 0) {
      <div class="flex flex-wrap gap-1 mb-2">
        @for (mod of myVersion()!.modifications; track mod) {
          <span class="text-xs bg-white text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">{{ mod }}</span>
        }
      </div>
    }
    @if (myVersion()!.latestNote) {
      <p class="text-xs text-indigo-600 italic">{{ myVersion()!.latestNote }}</p>
    }
  </div>
}
```

Find the bottom of the recipe detail template where the "I cooked this" button is, and make sure the export button is accessible from the My Version card as shown above.

- [ ] **Step 5: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 6: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/recipes/recipe-detail/ && git commit -m "feat(recipe-detail): add My Version card with cook history aggregation and recipe export"
```

---

### Task 2: Waste prediction insight on inventory page

**Files:**
- Modify: `src/app/features/inventory/inventory-page/inventory-page.component.ts`
- Modify: `src/app/features/inventory/inventory-page/inventory-page.component.html`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/inventory/inventory-page/inventory-page.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/inventory/inventory-page/inventory-page.component.html
```

- [ ] **Step 1: Add wasteInsight computed to component**

The `groups` signal already exists (ExpiryGroup[] where each group has `status` and `items`). Add a computed that identifies expired items:

```typescript
wasteInsight = computed<{ count: number; categories: string[] } | null>(() => {
  const expiredGroup = this.groups().find(g => g.status === 'expired');
  if (!expiredGroup || expiredGroup.items.length === 0) return null;
  const cats = [...new Set(expiredGroup.items.map(i => i.category).filter((c): c is string => !!c))];
  return { count: expiredGroup.items.length, categories: cats };
});
```

- [ ] **Step 2: Add waste insight banner to template**

Read the template to find the right placement. Insert the waste insight banner AFTER the urgency alert banner (the red/orange banner that shows expired/today items) and BEFORE the grouped item list:

```html
@if (wasteInsight()) {
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
    <p class="font-medium">🗑️ {{ 'inventory.waste_insight' | translate: { count: wasteInsight()!.count } }}</p>
    @if (wasteInsight()!.categories.length > 0) {
      <p class="text-xs text-amber-600 mt-1">{{ 'inventory.waste_categories' | translate }}: {{ wasteInsight()!.categories.map(c => ('inventory.cat_' + c)).join(', ') }}</p>
    }
    <p class="text-xs text-amber-600 mt-1">{{ 'inventory.waste_tip' | translate }}</p>
  </div>
}
```

**Note on the categories display:** The `'inventory.cat_' + c` string is not a real i18n key usage — we can't interpolate the `translate` pipe dynamically in the template. Use a helper method instead.

Add to the component class:
```typescript
categoryLabel(cat: string): string {
  // Returns the category key for translation lookup
  return 'inventory.cat_' + cat;
}
```

Update the template to use a `@for`:
```html
@if (wasteInsight()) {
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
    <p class="font-medium">🗑️ {{ 'inventory.waste_insight' | translate: { count: wasteInsight()!.count } }}</p>
    @if (wasteInsight()!.categories.length > 0) {
      <p class="text-xs text-amber-600 mt-1">
        {{ 'inventory.waste_categories' | translate }}:
        @for (cat of wasteInsight()!.categories; track cat; let last = $last) {
          {{ categoryLabel(cat) | translate }}{{ last ? '' : ', ' }}
        }
      </p>
    }
    <p class="text-xs text-amber-600 mt-1">{{ 'inventory.waste_tip' | translate }}</p>
  </div>
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/inventory/inventory-page/ && git commit -m "feat(inventory): add waste prediction insight for expired items"
```

---

### Task 3: Dessert improvement bootcamp in Techniques page

**Files:**
- Modify: `src/app/features/techniques/techniques-page/techniques-page.component.ts`
- Modify: `src/app/features/techniques/techniques-page/techniques-page.component.html`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/techniques/techniques-page/techniques-page.component.ts
cat /home/valentin/code/ephemeral-cuisine/src/app/features/techniques/techniques-page/techniques-page.component.html
```

Also read the Technique model to understand the structure:
```bash
cat /home/valentin/code/ephemeral-cuisine/src/app/features/techniques/technique.model.ts
```

- [ ] **Step 1: Add dessert bootcamp data to component**

Add a constant at module level (above `@Component`):

```typescript
interface BootcampTier {
  tier: number;
  name: string;
  equipment: string[];
  examples: string[];
  unlocked: boolean;
}

const BOOTCAMP_TIERS: Array<Omit<BootcampTier, 'unlocked'>> = [
  {
    tier: 1,
    name: 'No equipment',
    equipment: [],
    examples: ['Panna cotta', 'Mousse de chocolate', 'Tiramisú', 'Trufas'],
  },
  {
    tier: 2,
    name: 'Oven + hand mixer',
    equipment: ['oven', 'hand_mixer'],
    examples: ['Brownies', 'Muffins', 'Cheesecake', 'Crema catalana'],
  },
  {
    tier: 3,
    name: 'Stand mixer',
    equipment: ['stand_mixer'],
    examples: ['Layer cake', 'Macarons', 'Croissants', 'Laminated dough'],
  },
];
```

Add a computed to the component class that determines which tiers are unlocked based on owned equipment:

```typescript
// Inject DietaryProfileService if not already present
// Add: profile = signal<DietaryProfile | null>(null);

bootcampTiers = signal<BootcampTier[]>([]);
```

In `ngOnInit`, after loading profile/techniques, build bootcamp tiers:
```typescript
const equipment = new Set(profile?.equipment ?? []);
this.bootcampTiers.set(BOOTCAMP_TIERS.map(t => ({
  ...t,
  unlocked: t.equipment.every(e => equipment.has(e)),
})));
```

**Note:** Read the existing techniques-page component carefully — if it already loads a profile, reuse it. If not, inject `DietaryProfileService`.

- [ ] **Step 2: Add bootcamp section to template**

At the bottom of the template (after the techniques list, inside the main content area), add:

```html
<!-- Dessert bootcamp -->
<section class="mt-8 mb-4">
  <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ 'techniques.bootcamp_title' | translate }}</h2>
  <div class="flex flex-col gap-3">
    @for (tier of bootcampTiers(); track tier.tier) {
      <div [class]="tier.unlocked
        ? 'bg-white border border-green-200 rounded-xl p-4'
        : 'bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-60'">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm">{{ tier.unlocked ? '🔓' : '🔒' }}</span>
          <h3 class="font-semibold text-sm text-gray-900">{{ 'techniques.bootcamp_tier' | translate }} {{ tier.tier }}: {{ tier.name }}</h3>
        </div>
        @if (tier.equipment.length > 0) {
          <p class="text-xs text-gray-400 mb-2">{{ 'techniques.bootcamp_needs' | translate }}: {{ tier.equipment.join(', ') }}</p>
        }
        <div class="flex flex-wrap gap-1">
          @for (ex of tier.examples; track ex) {
            <span class="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{{ ex }}</span>
          }
        </div>
      </div>
    }
  </div>
</section>
```

- [ ] **Step 3: Build to verify**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | grep -E "error TS|Error|complete"
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add src/app/features/techniques/ && git commit -m "feat(techniques): add dessert improvement bootcamp with equipment-gated tiers"
```

---

### Task 4: i18n + full test suite + build + push

**Files:**
- Modify: `public/assets/i18n/es.json`
- Modify: `public/assets/i18n/en.json`

Read both files before editing:
```bash
cat /home/valentin/code/ephemeral-cuisine/public/assets/i18n/es.json
cat /home/valentin/code/ephemeral-cuisine/public/assets/i18n/en.json
```

- [ ] **Step 1: Add i18n keys**

In `es.json`, add to the existing `"recipe"` section:
```json
"my_version_title": "Mi versión",
"fav_protein": "Proteína favorita",
"export": "Exportar",
"copied": "Copiado"
```

In `es.json`, add to the existing `"inventory"` section:
```json
"waste_insight": "{{count}} ingrediente(s) caducados",
"waste_categories": "Categorías afectadas",
"waste_tip": "Compra menos cantidad la próxima vez o úsalos antes"
```

In `es.json`, add to the existing `"techniques"` section:
```json
"bootcamp_title": "Bootcamp de repostería",
"bootcamp_tier": "Nivel",
"bootcamp_needs": "Necesitas",
"bootcamp_locked": "Bloqueado"
```

In `en.json`, add to the existing `"recipe"` section:
```json
"my_version_title": "My version",
"fav_protein": "Fav protein",
"export": "Export",
"copied": "Copied!"
```

In `en.json`, add to the existing `"inventory"` section:
```json
"waste_insight": "{{count}} item(s) expired",
"waste_categories": "Common categories",
"waste_tip": "Try buying less next time or use these sooner"
```

In `en.json`, add to the existing `"techniques"` section:
```json
"bootcamp_title": "Dessert bootcamp",
"bootcamp_tier": "Tier",
"bootcamp_needs": "Requires",
"bootcamp_locked": "Locked"
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/valentin/code/ephemeral-cuisine && npm test -- --no-coverage 2>&1 | tail -8
```

Expected: all tests passing.

- [ ] **Step 3: Build**

```bash
cd /home/valentin/code/ephemeral-cuisine && npx ng build --configuration=development 2>&1 | tail -4
```

Expected: `Application bundle generation complete.`

- [ ] **Step 4: Commit and push**

```bash
cd /home/valentin/code/ephemeral-cuisine && git add public/assets/i18n/ && git commit -m "feat(i18n): add phase 5 keys — my version, waste insight, dessert bootcamp" && git push
```

---

## Self-Review

**Spec coverage:**

| Phase 5 remaining requirement | Task |
|---|---|
| "My version" auto-recipes | Task 1 — cook history → modifications + notes aggregated in recipe detail |
| Recipe export / sharing | Task 1 — Markdown export to clipboard from recipe detail |
| Waste prediction + behavior insight | Task 2 — expired item count + category insight on inventory page |
| Dessert improvement bootcamp | Task 3 — tier display gated by equipment in Techniques page |
| Predictive combo rating engine | Not implemented — requires 50+ cook history to be meaningful |
| Multi-dish timeline | Not implemented — complex scheduling algorithm, not enough recipe step data |

**Placeholder scan:** None found.

**Type consistency:**
- `MyVersion` interface defined above the class (outside `@Component`) in recipe-detail component
- `BootcampTier` interface defined at module level in techniques-page component
- `wasteInsight` computed returns `{ count: number; categories: string[] } | null` — template safely guards with `@if (wasteInsight())`
- `exportCopied` is a `signal<boolean>` — set to `true` then reset via `setTimeout` (no memory leak concern in Angular lifecycle)
- `bootcampTiers` is a `signal<BootcampTier[]>` populated in `ngOnInit` from `BOOTCAMP_TIERS` with `unlocked` field resolved from equipment set
