# Ephemeral Cuisine

A mobile-first personal recipe database. Import recipes from JSON or Markdown files, browse and filter your collection, and cook step-by-step with concurrent timers.

## Features

- **Import** — drag and drop JSON or Markdown recipe files; background parsing via Supabase Edge Functions
- **Browse** — full-text search, ingredient containment filter ("what do I have at home?"), cuisine type, difficulty, max time, and favorites
- **Recipe detail** — ingredients with quantity and mise en place, steps with per-step timers, concurrent step grouping
- **Cooking mode** — full-screen step-by-step guide with countdown timers, haptic alerts, wake lock (screen stays on), and concurrent step support
- **i18n** — Spanish (default) and English, switchable at runtime
- **Auth** — magic-link login via Supabase Auth (no passwords)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18, standalone components, signals |
| Styling | Tailwind CSS v3 |
| i18n | @ngx-translate/core v18 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Hosting | Cloudflare Pages |
| Testing | Jest + jest-preset-angular |

## Project structure

```
src/app/
├── core/
│   ├── supabase.service.ts     # Supabase client singleton
│   ├── auth.service.ts         # Auth state (signals)
│   └── auth.guard.ts           # Route guard
├── features/
│   ├── auth/                   # Magic-link login page
│   ├── recipes/
│   │   ├── models/             # TypeScript interfaces
│   │   ├── recipe.service.ts   # All Supabase recipe queries
│   │   ├── recipes-page/       # List + search + filter
│   │   ├── recipe-card/        # Card component
│   │   ├── recipe-filter/      # Filter chips
│   │   ├── ingredient-search/  # Autocomplete multi-select
│   │   ├── recipe-detail/      # Detail view
│   │   └── cooking-mode/       # Step-by-step cooking
│   │       ├── step-timer/     # Countdown timer component
│   │       └── wake-lock.service.ts
│   ├── import/                 # File upload + job history
│   └── settings/               # Language toggle + sign out
supabase/
├── migrations/                 # PostgreSQL schema + RLS
└── functions/
    └── parse-recipe-import/    # Deno Edge Function
```

## Getting started

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Local development

```bash
# Install dependencies
npm install

# Start local Supabase stack
npx supabase start

# Start the dev server
npm start
```

Open `http://localhost:4200`. The local Supabase stack runs at `http://127.0.0.1:54321` with Studio at `http://127.0.0.1:54323`.

### Run tests

```bash
npm test
```

## Recipe file format

### JSON

A single recipe object or an array of recipes:

```json
{
  "name": "Pasta Carbonara",
  "language": "es",
  "cuisine_type": "italiana",
  "difficulty": "medium",
  "prep_time": 10,
  "cook_time": 20,
  "servings": 2,
  "tags": ["pasta", "rápida"],
  "allergens": ["gluten", "huevo", "lactosa"],
  "equipment": ["sartén", "olla"],
  "ingredients": [
    { "name": "pasta", "qty": 200, "unit": "g" },
    { "name": "guanciale", "qty": 100, "unit": "g", "prep": "en dados" },
    { "name": "huevo", "qty": 2, "unit": "ud" },
    { "name": "parmesano", "qty": 50, "unit": "g", "prep": "rallado" }
  ],
  "steps": [
    { "order": 1, "text": "Cocer la pasta en agua con sal.", "time": 10 },
    { "order": 2, "text": "Dorar el guanciale a fuego medio.", "time": 5, "concurrent_group": 1 },
    { "order": 3, "text": "Mezclar huevos y parmesano.", "concurrent_group": 1 },
    { "order": 4, "text": "Mezclar todo fuera del fuego y servir." }
  ]
}
```

Steps with the same `concurrent_group` are shown side-by-side in cooking mode.

### Markdown

```markdown
---
name: Pasta Carbonara
language: es
cuisine_type: italiana
difficulty: medium
prep_time: 10
cook_time: 20
servings: 2
tags: [pasta, rápida]
allergens: [gluten, huevo, lactosa]
equipment: [sartén, olla]
---

Clásica carbonara romana, sin nata.

## Ingredientes

- 200g pasta
- 100g guanciale, en dados
- 2 ud huevo
- 50g parmesano, rallado

## Pasos

1. Cocer la pasta en agua con sal. (10 min)
2. Dorar el guanciale a fuego medio. (5 min) [group:1]
3. Mezclar huevos y parmesano. [group:1]
4. Mezclar todo fuera del fuego y servir.
```

Headings support both Spanish (`Ingredientes` / `Pasos`) and English (`Ingredients` / `Steps`).
Step annotations: `(N min)` sets a timer, `[group:N]` marks concurrent steps.

## Deployment

### 1. Supabase cloud

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the project URL and anon key into `src/environments/environment.prod.ts`
3. Push the database schema:
   ```bash
   npx supabase db push --db-url YOUR_POSTGRES_CONNECTION_STRING
   ```
4. In Supabase Studio → Database → Webhooks, create a webhook:
   - Table: `import_jobs`, Event: `INSERT`
   - URL: `https://<project>.supabase.co/functions/v1/parse-recipe-import`
5. Deploy the edge function:
   ```bash
   npx supabase functions deploy parse-recipe-import
   ```

### 2. Cloudflare Pages

```bash
npm run build:prod
npx wrangler pages deploy dist/ephemeral-cuisine/browser --project-name=ephemeral-cuisine
```

Or connect the repository in the Cloudflare dashboard with build command `npm run build:prod` and output directory `dist/ephemeral-cuisine/browser`.

## License

MIT
