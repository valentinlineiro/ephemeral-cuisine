# Ephemeral Cuisine — Recipe Database Design

**Date:** 2026-06-16  
**Status:** Approved  
**Scope:** MVP — personal recipe database, single user, importable from JSON/MD

---

## 1. Overview

A mobile-first personal recipe database. The user generates recipes externally (currently via Gemini web chat) and imports them as JSON or Markdown files. The app stores, searches, filters, and guides the user through cooking — including concurrent step timers.

**Not in scope for MVP:** multi-user, social features, meal planning, shopping list generation, pantry persistence.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Frontend | Angular (latest stable), hosted on Cloudflare Pages |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Edge logic | Supabase Edge Functions (Deno) |
| Barcode lookup | Open Food Facts API (free, no key) — scanning only |
| i18n | `@ngx-translate/core`, default locale `es` |

**Key principle:** The Angular service layer is the only code that knows about Supabase. Components call `RecipeService`, `ImportService`, etc. Swapping Supabase later touches only services, not components.

Auth flows through `supabase.auth` so PostgreSQL RLS applies naturally. The `users` table maps to recipe ownership from day one — even though MVP is single-user, the data model is multi-tenant ready.

---

## 3. Architecture

```
Cloudflare Pages
└── Angular SPA (mobile-first, PWA)
    ├── Feature modules: recipes, import, settings
    ├── Service layer (Supabase-aware boundary)
    └── i18n via ngx-translate (es default, en available)

Supabase
├── PostgreSQL
│   ├── recipes (tsvector search, RLS by user_id)
│   ├── users (mirrors supabase.auth)
│   ├── favorite_recipes (join table)
│   └── import_jobs (async import status)
├── Storage
│   └── recipe-imports bucket (raw JSON/MD files)
│   └── recipe-images bucket
└── Edge Functions (Deno)
    └── parse-recipe-import (triggered on bucket insert)
```

**Import pipeline (async):**
1. Angular uploads raw file → `recipe-imports` Storage bucket
2. Angular creates `import_jobs` row with `status: pending`
3. Storage trigger fires `parse-recipe-import` Edge Function
4. Edge Function parses file → writes to `recipes` table → updates `import_jobs` status
5. Angular polls `import_jobs` for status updates (Supabase Realtime subscription)

---

## 4. Data Model

```sql
-- Mirror auth.users into public schema so foreign keys work
-- Auto-populated via trigger on auth.users insert
CREATE TABLE public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text
);

CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Difficulty enforced as enum, not free text
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE recipes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id),  -- RLS enforced
  name           text NOT NULL,
  description    text,                                 -- nullable; filled from import or omitted
  cuisine_type   text,
  language       text NOT NULL DEFAULT 'es',
  prep_time      int,                                  -- minutes
  cook_time      int,                                  -- minutes
  total_time     int GENERATED ALWAYS AS (
                   COALESCE(prep_time, 0) + COALESCE(cook_time, 0)
                 ) STORED,
  servings       int,
  difficulty     difficulty_level,
  equipment      text[],                               -- ['oven', 'microwave', 'air_fryer', 'stovetop']
  ingredients    jsonb NOT NULL,                       -- [{name, qty?, unit?, prep?}]
  steps          jsonb NOT NULL,                       -- [{order, text, time?, concurrent_group?}]
  tags           text[],
  allergens      text[],
  image_path     text,                                 -- Supabase Storage path
  source_file    text,                                 -- original import filename
  search_vector  tsvector,                             -- populated by trigger (language-aware)
  created_at     timestamptz DEFAULT now()
);

-- Language-aware search vector trigger (can't use GENERATED for dynamic config)
CREATE FUNCTION update_search_vector() RETURNS trigger AS $$
DECLARE
  lang regconfig;
  ingredient_names text;
BEGIN
  lang := CASE WHEN NEW.language = 'es' THEN 'spanish'::regconfig
               ELSE 'english'::regconfig END;
  SELECT string_agg(elem->>'name', ' ')
    INTO ingredient_names
    FROM jsonb_array_elements(NEW.ingredients) AS elem;
  NEW.search_vector := to_tsvector(lang,
    coalesce(NEW.name, '') || ' ' ||
    coalesce(ingredient_names, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_search_vector_update
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX recipes_search_idx ON recipes USING GIN (search_vector);
CREATE INDEX recipes_ingredients_idx ON recipes USING GIN (ingredients);
CREATE INDEX recipes_allergens_idx ON recipes USING GIN (allergens);
CREATE INDEX recipes_equipment_idx ON recipes USING GIN (equipment);

CREATE TABLE favorite_recipes (
  user_id    uuid NOT NULL REFERENCES users(id),
  recipe_id  uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE TABLE import_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  file_path   text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',   -- pending | processing | done | error
  error_msg   text,
  created_at  timestamptz DEFAULT now()
);
```

**Steps JSONB structure:**
```json
[
  { "order": 1, "text": "Boil salted water", "time": 10, "concurrent_group": 1 },
  { "order": 2, "text": "Dice onion and sauté in oil", "time": 8, "concurrent_group": 1 },
  { "order": 3, "text": "Combine and plate", "time": 2 }
]
```
Steps sharing a `concurrent_group` integer are executed in parallel (timers fire simultaneously). Sequential steps have no `concurrent_group`. Nested parallelism is not modelled in MVP — if needed later, migrate to a tree structure.

**Ingredients JSONB structure:**
```json
[
  { "name": "pasta", "qty": 200, "unit": "g" },
  { "name": "onion", "qty": 1, "unit": "whole", "prep": "diced" }
]
```

---

## 5. Import Format Contract

### JSON
```json
{
  "name": "Pasta al Limone",
  "description": "A bright, quick pasta.",
  "cuisine_type": "italian",
  "language": "es",
  "prep_time": 10,
  "cook_time": 20,
  "servings": 2,
  "difficulty": "easy",
  "equipment": ["stovetop"],
  "allergens": ["gluten", "dairy"],
  "tags": ["quick", "vegetarian"],
  "ingredients": [
    { "name": "pasta", "qty": 200, "unit": "g" },
    { "name": "limón", "qty": 1, "unit": "whole", "prep": "exprimido" }
  ],
  "steps": [
    { "order": 1, "text": "Hervir agua con sal", "time": 10 },
    { "order": 2, "text": "Cocer la pasta al dente", "time": 8 }
  ]
}
```

### Markdown (YAML front-matter)
```markdown
---
name: Pasta al Limone
description: A bright, quick pasta.
cuisine_type: italian
language: es
prep_time: 10
cook_time: 20
servings: 2
difficulty: easy
equipment: [stovetop]
allergens: [gluten, dairy]
tags: [quick, vegetarian]
---

## Ingredientes
- 200 g pasta
- 1 whole limón, exprimido

## Pasos
1. Hervir agua con sal (10 min)
2. Cocer la pasta al dente (8 min) [group:1]
3. Preparar la salsa de limón (5 min) [group:1]
```

**Parsing rules:**
- Front-matter (YAML between `---`) maps directly to recipe fields. Parsed with `js-yaml`.
- Text between end of front-matter and first `##` heading → `description` (trimmed).
- Ingredients heading: `## Ingredientes` (es) or `## Ingredients` (en) — parser accepts both regardless of `language` field.
- `## Ingredientes` / `## Ingredients`: one `- <qty> <unit> <name>` per line. Regex: `^-\s+(?:(\d+(?:\.\d+)?)\s+([\w/]+)\s+)?(.+?)(?:,\s*(.+))?$` → qty, unit, name, prep. qty and unit must appear together or not at all; name is required. Example: `- garlic` → `{name:"garlic"}`, `- 2 cloves garlic, minced` → `{qty:2, unit:"cloves", name:"garlic", prep:"minced"}`.
- Steps heading: `## Pasos` (es) or `## Steps` (en) — parser accepts both.
- `## Pasos` / `## Steps`: numbered list `1. <text> (N min) [group:G]`. Regex extracts time from `(N min)` and group from `[group:G]`. Both optional.
- **Validation:** reject files missing `name` or `steps`. Return structured error to `import_jobs.error_msg`.

---

## 6. Edge Function: `parse-recipe-import`

- Trigger: Supabase Storage `recipe-imports` bucket on object insert
- Runtime: Deno
- Steps:
  1. Download file from Storage
  2. Detect format (`.json` vs `.md`)
  3. Parse with format-specific parser
  4. Validate required fields (`name`, `steps`)
  5. Insert into `recipes` table via Supabase client (inherits `user_id` from `import_jobs`)
  6. Update `import_jobs` → `done` or `error`
- Supports batch import: a single JSON file may contain an array of recipe objects

---

## 7. Angular Service Layer

All Supabase interaction is isolated to these services. Components never import `@supabase/supabase-js` directly.

| Service | Responsibilities |
|---|---|
| `AuthService` | sign in, sign out, session state, `supabase.auth` |
| `RecipeService` | search, filter, CRUD, favorites toggle |
| `ImportService` | file upload to Storage, create `import_jobs`, poll status |
| `ScanService` | camera access, barcode decode, Open Food Facts lookup |

**Search query patterns:**
- Full-text: `search_vector @@ plainto_tsquery(lang, query)`
- Ingredient containment: `ingredients @> '[{"name":"pollo"}]'`  
- Filter: `allergens && excluded` (exclude recipes containing allergen), `equipment @> required`
- Favorites: join with `favorite_recipes`

---

## 8. Screens & Navigation

**Bottom navigation (3 tabs):** labels are i18n'd via `| translate` pipe — never hardcoded. Default keys: `nav.recipes` (Recetas), `nav.import` (Importar), `nav.settings` (Ajustes). Recipe content labels (e.g., "¿Qué tienes en casa?") are also translated; only recipe *data* (names, steps) stays in its authored language.

### Recetas
- Sticky search bar. Tap → expands to ingredient multi-select mode ("¿Qué tienes en casa?")
  - Autocomplete pulls distinct ingredient names from `recipes` table
  - 📷 scan icon → `ScanService` → barcode → Open Food Facts → adds ingredient to selection
  - Ingredient selection drives `ingredients @>` query
- Collapsible "Filtros" bar:
  - Always visible row: cuisine chips, time chips, ★ Favoritos toggle
  - Expanded: equipment, allergens, difficulty
- Recipe cards grid (2-col mobile)
- **Empty state:** hero message + "Importa tu primera receta" link → Importar tab

### Recipe Detail (push route from card tap)
- Header: image, name, meta (total_time, difficulty, servings, cuisine)
- Ingredients list (name, qty, unit, prep)
- Steps overview with concurrent groups visually grouped
- **[Comenzar a cocinar]** button → Cooking Mode

### Cooking Mode (full-screen overlay)
- Progressive enhancement — if `navigator.wakeLock` is denied or unavailable, silently degrades to static step viewer. No error shown to user.
- Progress bar (step group X of N)
- Current step group displayed as cards
- Per-step independent countdown timer (fires from `step.time`)
- Timer end: haptic (`navigator.vibrate`, Android only — iOS Safari ignores silently) + visual alert banner
- Each timer dismissed individually by user tap
- **[Siguiente]** advances only on explicit user tap after all timers in group are dismissed or skipped
- **[Salir]** returns to Recipe Detail
- State (current step, timer progress) held in component memory only — no persistence across app close

**Degradation contract:** Cooking Mode must never block access to Recipe Detail. If the overlay fails to initialize, the user sees the static step list. Audio assets (timer chime) load lazily and fail silently.

### Importar
- File picker (JSON or MD, single or batch)
- Upload progress indicator
- Import history list (from `import_jobs`): filename, status badge, timestamp
- Tap failed job → inline error detail

### Ajustes
- Language toggle (ES / EN) — updates `LOCALE_ID`, persisted in localStorage
- Account: email display, sign out

---

## 9. i18n

- `@ngx-translate/core` with `es` as default locale
- All template strings use `| translate` pipe — no hardcoded Spanish or English in templates
- Recipe `language` field drives PostgreSQL `tsvector` config per recipe
- Language toggle in Ajustes switches UI locale at runtime

---

## 10. Ingredient Scanning (Nice to Have — MVP-safe)

- Entry point: 📷 icon in expanded search bar ingredient multi-select
- `ScanService` opens camera via `getUserMedia`, decodes barcode with `@zxing/browser`
- Barcode → Open Food Facts `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- Extracts `product_name` → adds to ingredient selection list
- Fallback: if barcode not found or camera denied, user types manually
- No pantry persistence — scanning populates current search session only
- Future: OCR of receipt / shelf photo (out of scope)

---

## 11. Future Considerations (out of scope)

- Nested parallel steps (tree model for `steps` JSONB)
- Pantry / ingredient inventory persistence
- Shopping list generation
- Meal planning
- Multi-user / household sharing
- Recipe OCR from photo
- Direct Gemini API integration for recipe generation
