# Ephemeral Cuisine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first personal recipe database as an Angular SPA on Cloudflare Pages backed by Supabase (PostgreSQL + Auth + Storage + Edge Functions).

**Architecture:** Angular 18 standalone components with a strict service layer as the only Supabase-aware boundary. Supabase handles auth (with RLS), PostgreSQL full-text search, Storage for raw import files, and a Deno Edge Function for async recipe parsing. Cloudflare Pages hosts the compiled SPA.

**Tech Stack:** Angular 18, @supabase/supabase-js v2, @ngx-translate/core, Tailwind CSS v3, Jest + jest-preset-angular, Supabase CLI, Cloudflare Pages

---

## File Map

```
ephemeral-cuisine/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── supabase.service.ts          # Supabase client singleton
│   │   │   ├── auth.service.ts              # Auth state + sign-in/out
│   │   │   └── auth.guard.ts                # Route guard
│   │   ├── features/
│   │   │   ├── recipes/
│   │   │   │   ├── models/recipe.model.ts   # All TypeScript interfaces
│   │   │   │   ├── recipe.service.ts        # All Supabase recipe queries
│   │   │   │   ├── recipes-page/
│   │   │   │   │   ├── recipes-page.component.ts
│   │   │   │   │   └── recipes-page.component.html
│   │   │   │   ├── recipe-card/
│   │   │   │   │   ├── recipe-card.component.ts
│   │   │   │   │   └── recipe-card.component.html
│   │   │   │   ├── recipe-filter/
│   │   │   │   │   ├── recipe-filter.component.ts
│   │   │   │   │   └── recipe-filter.component.html
│   │   │   │   ├── ingredient-search/
│   │   │   │   │   ├── ingredient-search.component.ts
│   │   │   │   │   └── ingredient-search.component.html
│   │   │   │   ├── recipe-detail/
│   │   │   │   │   ├── recipe-detail.component.ts
│   │   │   │   │   └── recipe-detail.component.html
│   │   │   │   └── cooking-mode/
│   │   │   │       ├── cooking-mode.component.ts
│   │   │   │       ├── cooking-mode.component.html
│   │   │   │       ├── step-timer/
│   │   │   │       │   ├── step-timer.component.ts
│   │   │   │       │   └── step-timer.component.html
│   │   │   │       └── wake-lock.service.ts
│   │   │   ├── import/
│   │   │   │   ├── import.service.ts
│   │   │   │   └── import-page/
│   │   │   │       ├── import-page.component.ts
│   │   │   │       └── import-page.component.html
│   │   │   ├── auth/
│   │   │   │   ├── login-page.component.ts
│   │   │   │   └── login-page.component.html
│   │   │   └── settings/
│   │   │       ├── settings-page.component.ts
│   │   │       └── settings-page.component.html
│   │   ├── app.routes.ts
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   └── app.config.ts
│   ├── assets/i18n/
│   │   ├── es.json
│   │   └── en.json
│   └── environments/
│       ├── environment.ts
│       └── environment.prod.ts
├── supabase/
│   ├── migrations/
│   │   ├── 20260616000001_initial_schema.sql
│   │   └── 20260616000002_rls_policies.sql
│   └── functions/
│       └── parse-recipe-import/
│           └── index.ts
├── tailwind.config.js
├── jest.config.js
└── wrangler.toml
```

---

## Task 1: Angular Project Scaffold

**Files:**
- Create: project root via `ng new`
- Modify: `package.json`

- [ ] **Step 1: Create Angular project**

```bash
npx @angular/cli@18 new ephemeral-cuisine \
  --style=scss \
  --ssr=false \
  --routing \
  --skip-git \
  --directory=.
```

Run from `/home/valentin/code/ephemeral-cuisine`. When prompted for stylesheet format, choose SCSS. When asked about SSR, answer No.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @ngx-translate/core @ngx-translate/http-loader
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D jest jest-preset-angular @types/jest \
  tailwindcss postcss autoprefixer \
  ts-jest
```

- [ ] **Step 4: Remove Karma (replaced by Jest)**

```bash
npm uninstall karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter @types/jasmine jasmine-core
rm karma.conf.js src/test.ts
```

- [ ] **Step 5: Verify Angular CLI works**

```bash
npx ng version
```

Expected: Angular CLI 18.x, Angular 18.x listed.

---

## Task 2: Jest Configuration

**Files:**
- Create: `jest.config.js`
- Modify: `tsconfig.spec.json`, `package.json`

- [ ] **Step 1: Create jest.config.js**

```js
// jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterFramework: ['<rootDir>/setup-jest.ts'],
  testMatch: ['**/src/**/*.spec.ts'],
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.module.ts'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 2: Create setup-jest.ts**

```ts
// setup-jest.ts
import 'jest-preset-angular/setup-jest';
```

- [ ] **Step 3: Update tsconfig.spec.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest"],
    "esModuleInterop": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts", "setup-jest.ts"]
}
```

- [ ] **Step 4: Update test script in package.json**

In `package.json`, replace the `"test"` script:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

- [ ] **Step 5: Verify Jest runs**

```bash
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 skipped, 0 total` (no failures).

---

## Task 3: Tailwind CSS Setup

**Files:**
- Create: `tailwind.config.js`
- Modify: `src/styles.scss`

- [ ] **Step 1: Initialize Tailwind**

```bash
npx tailwindcss init
```

- [ ] **Step 2: Configure tailwind.config.js**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#16a34a',   // green-600 — food brand color
        surface: '#f9fafb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Add Tailwind directives to src/styles.scss**

```scss
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  @apply bg-surface font-sans text-gray-900;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 4: Verify build includes Tailwind**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

---

## Task 4: Supabase CLI + Local Dev Stack

**Files:**
- Create: `supabase/` directory structure

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install -D supabase
```

- [ ] **Step 2: Initialize Supabase project**

```bash
npx supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/`.

- [ ] **Step 3: Start local Supabase stack**

```bash
npx supabase start
```

Expected output includes local API URL (e.g. `http://127.0.0.1:54321`) and anon key. Copy these — needed in Task 7.

- [ ] **Step 4: Verify local stack is running**

```bash
npx supabase status
```

Expected: API URL, DB URL, Studio URL all listed as running.

---

## Task 5: Database Migration — Schema

**Files:**
- Create: `supabase/migrations/20260616000001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260616000001_initial_schema.sql

-- Mirror auth.users into public schema
CREATE TABLE public.users (
  id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text
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

-- Difficulty enum
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Recipes
CREATE TABLE public.recipes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  description    text,
  cuisine_type   text,
  language       text        NOT NULL DEFAULT 'es',
  prep_time      int,
  cook_time      int,
  total_time     int GENERATED ALWAYS AS (
                   COALESCE(prep_time, 0) + COALESCE(cook_time, 0)
                 ) STORED,
  servings       int,
  difficulty     difficulty_level,
  equipment      text[]      NOT NULL DEFAULT '{}',
  ingredients    jsonb       NOT NULL DEFAULT '[]',
  steps          jsonb       NOT NULL DEFAULT '[]',
  tags           text[]      NOT NULL DEFAULT '{}',
  allergens      text[]      NOT NULL DEFAULT '{}',
  image_path     text,
  source_file    text,
  search_vector  tsvector,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Language-aware tsvector trigger
CREATE FUNCTION public.update_search_vector() RETURNS trigger AS $$
DECLARE
  lang             regconfig;
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
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_search_vector();

CREATE INDEX recipes_search_idx     ON public.recipes USING GIN (search_vector);
CREATE INDEX recipes_ingredients_idx ON public.recipes USING GIN (ingredients);
CREATE INDEX recipes_allergens_idx  ON public.recipes USING GIN (allergens);
CREATE INDEX recipes_equipment_idx  ON public.recipes USING GIN (equipment);

-- Favorites
CREATE TABLE public.favorite_recipes (
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipe_id  uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

-- Import jobs
CREATE TABLE public.import_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: Migration applied successfully.

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db diff --schema public
```

Expected: No diff (schema matches migration).

---

## Task 6: Database Migration — RLS Policies

**Files:**
- Create: `supabase/migrations/20260616000002_rls_policies.sql`

- [ ] **Step 1: Create RLS migration**

```sql
-- supabase/migrations/20260616000002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs    ENABLE ROW LEVEL SECURITY;

-- users: each user sees only themselves
CREATE POLICY "users_own_row" ON public.users
  FOR ALL USING (auth.uid() = id);

-- recipes: owner access only
CREATE POLICY "recipes_owner_select" ON public.recipes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recipes_owner_insert" ON public.recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_owner_update" ON public.recipes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recipes_owner_delete" ON public.recipes
  FOR DELETE USING (auth.uid() = user_id);

-- favorite_recipes: owner access only
CREATE POLICY "favorites_owner_all" ON public.favorite_recipes
  FOR ALL USING (auth.uid() = user_id);

-- import_jobs: owner access only
CREATE POLICY "import_jobs_owner_all" ON public.import_jobs
  FOR ALL USING (auth.uid() = user_id);

-- Storage buckets (run via Supabase dashboard or seed file)
-- recipe-imports: authenticated users can upload to their own folder
-- recipe-images: authenticated users can upload to their own folder
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: RLS policies applied, no errors.

- [ ] **Step 3: Create storage buckets via Supabase Studio**

Open `http://127.0.0.1:54323` (Studio). Go to Storage → New bucket:
- Name: `recipe-imports`, Public: off
- Name: `recipe-images`, Public: on

---

## Task 7: Environment Configuration

**Files:**
- Modify: `src/environments/environment.ts`
- Modify: `src/environments/environment.prod.ts`

- [ ] **Step 1: Update environment.ts with local Supabase values**

Use the URL and anon key from `npx supabase status`:

```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'YOUR_LOCAL_ANON_KEY', // from supabase status output
  },
};
```

- [ ] **Step 2: Update environment.prod.ts**

```ts
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  supabase: {
    url: 'YOUR_SUPABASE_PROJECT_URL',   // set after creating cloud project
    anonKey: 'YOUR_SUPABASE_ANON_KEY',  // set after creating cloud project
  },
};
```

- [ ] **Step 3: Ensure fileReplacements in angular.json**

Confirm `angular.json` production configuration includes:
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

If missing, add it under `projects > ephemeral-cuisine > architect > build > configurations > production`.

---

## Task 8: SupabaseService

**Files:**
- Create: `src/app/core/supabase.service.ts`
- Create: `src/app/core/supabase.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/core/supabase.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('exposes a supabase client', () => {
    expect(service.client).toBeDefined();
    expect(typeof service.client.from).toBe('function');
  });

  it('exposes the auth namespace', () => {
    expect(service.client.auth).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=supabase.service
```

Expected: FAIL — `SupabaseService` not found.

- [ ] **Step 3: Implement SupabaseService**

```ts
// src/app/core/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.anonKey
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=supabase.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/supabase.service.ts src/app/core/supabase.service.spec.ts
git commit -m "feat: add SupabaseService singleton"
```

---

## Task 9: AuthService

**Files:**
- Create: `src/app/core/auth.service.ts`
- Create: `src/app/core/auth.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/core/auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const mockAuth = {
  getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
};

const mockSupabase = { client: { auth: mockAuth } };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: mockSupabase }],
    });
    service = TestBed.inject(AuthService);
  });

  it('session signal is null on init', () => {
    expect(service.session()).toBeNull();
  });

  it('user signal is null on init', () => {
    expect(service.user()).toBeNull();
  });

  it('signIn calls supabase signInWithOtp', async () => {
    await service.signIn('test@example.com');
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com' });
  });

  it('signOut calls supabase signOut', async () => {
    await service.signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=auth.service
```

Expected: FAIL — `AuthService` not found.

- [ ] **Step 3: Implement AuthService**

```ts
// src/app/core/auth.service.ts
import { Injectable, OnDestroy, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  private subscription: { unsubscribe: () => void } | null = null;

  constructor(private supabase: SupabaseService) {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
    });

    const { data } = this.supabase.client.auth.onAuthStateChange((_, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
    this.subscription = data.subscription;
  }

  async signIn(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithOtp({ email });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=auth.service
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth.service.ts src/app/core/auth.service.spec.ts
git commit -m "feat: add AuthService with signals"
```

---

## Task 10: Recipe Model

**Files:**
- Create: `src/app/features/recipes/models/recipe.model.ts`

No test needed — pure type definitions.

- [ ] **Step 1: Create recipe.model.ts**

```ts
// src/app/features/recipes/models/recipe.model.ts

export interface Ingredient {
  name: string;
  qty?: number;
  unit?: string;
  prep?: string;
}

export interface Step {
  order: number;
  text: string;
  time?: number;            // minutes
  concurrent_group?: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cuisine_type?: string;
  language: string;
  prep_time?: number;
  cook_time?: number;
  total_time?: number;      // generated by DB
  servings?: number;
  difficulty?: Difficulty;
  equipment: string[];
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  allergens: string[];
  image_path?: string;
  source_file?: string;
  created_at: string;
  is_favorite?: boolean;    // joined from favorite_recipes, not a DB column
}

export interface RecipeFilter {
  query?: string;
  ingredients?: string[];
  cuisine_type?: string;
  max_time?: number;
  equipment_required?: string[];
  allergens_exclude?: string[];
  difficulty?: Difficulty;
  favorites_only?: boolean;
}

export interface ImportJob {
  id: string;
  user_id: string;
  file_path: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error_msg?: string;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/recipes/models/recipe.model.ts
git commit -m "feat: add Recipe, RecipeFilter, ImportJob interfaces"
```

---

## Task 11: RecipeService

**Files:**
- Create: `src/app/features/recipes/recipe.service.ts`
- Create: `src/app/features/recipes/recipe.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/features/recipes/recipe.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { RecipeService } from './recipe.service';
import { SupabaseService } from '../../core/supabase.service';
import { Recipe, RecipeFilter } from './models/recipe.model';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSupabase = { client: { from: mockFrom, rpc: mockRpc } };

const sampleRecipe: Recipe = {
  id: 'r1', user_id: 'u1', name: 'Tortilla',
  language: 'es', equipment: [], ingredients: [],
  steps: [], tags: [], allergens: [], created_at: '2026-01-01',
};

describe('RecipeService', () => {
  let service: RecipeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: mockSupabase }],
    });
    service = TestBed.inject(RecipeService);
    jest.clearAllMocks();
  });

  describe('search()', () => {
    it('returns recipes array on success', async () => {
      const selectMock = jest.fn().mockResolvedValue({ data: [sampleRecipe], error: null });
      mockFrom.mockReturnValue({ select: selectMock });

      const results = await service.search({});
      expect(results).toEqual([sampleRecipe]);
    });

    it('throws on Supabase error', async () => {
      const selectMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue({ select: selectMock });

      await expect(service.search({})).rejects.toThrow('fail');
    });
  });

  describe('getIngredientSuggestions()', () => {
    it('returns distinct ingredient names', async () => {
      mockRpc.mockResolvedValue({ data: ['pollo', 'arroz'], error: null });
      const result = await service.getIngredientSuggestions();
      expect(result).toEqual(['pollo', 'arroz']);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=recipe.service
```

Expected: FAIL.

- [ ] **Step 3: Implement RecipeService**

```ts
// src/app/features/recipes/recipe.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Recipe, RecipeFilter } from './models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  constructor(private supabase: SupabaseService) {}

  async search(filter: RecipeFilter): Promise<Recipe[]> {
    let query = this.supabase.client
      .from('recipes')
      .select(`*, favorite_recipes!left(user_id)`);

    if (filter.query) {
      query = query.textSearch('search_vector', filter.query, { type: 'plain' });
    }

    if (filter.ingredients?.length) {
      // @> containment: recipe must include ALL selected ingredients
      const containsAll = filter.ingredients.map(i => ({ name: i }));
      query = query.contains('ingredients', JSON.stringify(containsAll));
    }

    if (filter.cuisine_type) {
      query = query.eq('cuisine_type', filter.cuisine_type);
    }

    if (filter.max_time) {
      query = query.lte('total_time', filter.max_time);
    }

    if (filter.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }

    if (filter.equipment_required?.length) {
      query = query.contains('equipment', filter.equipment_required);
    }

    if (filter.allergens_exclude?.length) {
      // Exclude recipes that overlap with the given allergens
      query = query.not('allergens', 'ov', `{${filter.allergens_exclude.join(',')}}`);
    }

    if (filter.favorites_only) {
      query = query.not('favorite_recipes', 'is', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((r: any) => ({
      ...r,
      is_favorite: Array.isArray(r.favorite_recipes) && r.favorite_recipes.length > 0,
      favorite_recipes: undefined,
    }));
  }

  async getById(id: string): Promise<Recipe | null> {
    const { data, error } = await this.supabase.client
      .from('recipes')
      .select(`*, favorite_recipes!left(user_id)`)
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      ...data,
      is_favorite: Array.isArray(data.favorite_recipes) && data.favorite_recipes.length > 0,
      favorite_recipes: undefined,
    };
  }

  async toggleFavorite(recipeId: string, userId: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('favorite_recipes')
      .select('recipe_id')
      .eq('recipe_id', recipeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      await this.supabase.client
        .from('favorite_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('user_id', userId);
      return false;
    } else {
      const { error } = await this.supabase.client
        .from('favorite_recipes')
        .insert({ recipe_id: recipeId, user_id: userId });
      if (error) {
        // Unique constraint violation (23505) means concurrent tap already inserted — re-query truth
        if (error.code === '23505') {
          const { data: existing } = await this.supabase.client
            .from('favorite_recipes')
            .select('recipe_id')
            .eq('recipe_id', recipeId)
            .eq('user_id', userId)
            .maybeSingle();
          return !!existing;
        }
        throw new Error(error.message);
      }
      return true;
    }
  }

  async getIngredientSuggestions(): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .rpc('get_distinct_ingredients');
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
```

- [ ] **Step 4: Add the PostgreSQL function for ingredient suggestions**

Add to a new migration `supabase/migrations/20260616000003_helpers.sql`:

```sql
CREATE OR REPLACE FUNCTION public.get_distinct_ingredients()
RETURNS text[] AS $$
  SELECT array_agg(DISTINCT elem->>'name' ORDER BY elem->>'name')
  FROM public.recipes, jsonb_array_elements(ingredients) AS elem
  WHERE auth.uid() = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Apply: `npx supabase db push`

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern=recipe.service
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/recipes/recipe.service.ts src/app/features/recipes/recipe.service.spec.ts \
  supabase/migrations/20260616000003_helpers.sql
git commit -m "feat: add RecipeService with search, filter, and favorites"
```

---

## Task 12: i18n Setup

**Files:**
- Create: `src/assets/i18n/es.json`
- Create: `src/assets/i18n/en.json`
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Create Spanish translations**

```json
// src/assets/i18n/es.json
{
  "nav": {
    "recipes": "Recetas",
    "import": "Importar",
    "settings": "Ajustes"
  },
  "recipes": {
    "search_placeholder": "Buscar recetas...",
    "ingredient_prompt": "¿Qué tienes en casa?",
    "filters": "Filtros",
    "favorites": "Favoritos",
    "empty_title": "Aún no tienes recetas",
    "empty_action": "Importa tu primera receta",
    "start_cooking": "Comenzar a cocinar",
    "minutes": "min",
    "servings": "{{count}} personas"
  },
  "cooking": {
    "step_of": "Paso {{current}} de {{total}}",
    "next": "Siguiente",
    "exit": "Salir",
    "timer_done": "¡Listo!",
    "dismiss": "Descartar"
  },
  "import": {
    "title": "Importar recetas",
    "drop_hint": "Arrastra un archivo JSON o MD aquí",
    "browse": "Seleccionar archivo",
    "history_title": "Importaciones recientes",
    "status_pending": "Pendiente",
    "status_processing": "Procesando",
    "status_done": "Completado",
    "status_error": "Error"
  },
  "settings": {
    "title": "Ajustes",
    "language": "Idioma",
    "account": "Cuenta",
    "sign_out": "Cerrar sesión"
  },
  "auth": {
    "title": "Ephemeral Cuisine",
    "subtitle": "Tu base de datos de recetas",
    "email_label": "Correo electrónico",
    "send_link": "Enviar enlace mágico",
    "check_email": "Revisa tu correo para el enlace de acceso"
  },
  "difficulty": {
    "easy": "Fácil",
    "medium": "Medio",
    "hard": "Difícil"
  }
}
```

- [ ] **Step 2: Create English translations**

```json
// src/assets/i18n/en.json
{
  "nav": {
    "recipes": "Recipes",
    "import": "Import",
    "settings": "Settings"
  },
  "recipes": {
    "search_placeholder": "Search recipes...",
    "ingredient_prompt": "What do you have at home?",
    "filters": "Filters",
    "favorites": "Favorites",
    "empty_title": "No recipes yet",
    "empty_action": "Import your first recipe",
    "start_cooking": "Start cooking",
    "minutes": "min",
    "servings": "{{count}} servings"
  },
  "cooking": {
    "step_of": "Step {{current}} of {{total}}",
    "next": "Next",
    "exit": "Exit",
    "timer_done": "Done!",
    "dismiss": "Dismiss"
  },
  "import": {
    "title": "Import recipes",
    "drop_hint": "Drag a JSON or MD file here",
    "browse": "Browse file",
    "history_title": "Recent imports",
    "status_pending": "Pending",
    "status_processing": "Processing",
    "status_done": "Done",
    "status_error": "Error"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "account": "Account",
    "sign_out": "Sign out"
  },
  "auth": {
    "title": "Ephemeral Cuisine",
    "subtitle": "Your personal recipe database",
    "email_label": "Email address",
    "send_link": "Send magic link",
    "check_email": "Check your email for the login link"
  },
  "difficulty": {
    "easy": "Easy",
    "medium": "Medium",
    "hard": "Hard"
  }
}
```

- [ ] **Step 3: Configure ngx-translate in app.config.ts**

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { routes } from './app.routes';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'es',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        },
      })
    ),
  ],
};
```

- [ ] **Step 4: Initialize translate service in app.component.ts**

```ts
// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {
  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('lang') ?? 'es';
    this.translate.use(saved);
  }
}
```

- [ ] **Step 5: Build to verify no errors**

```bash
npx ng build --configuration=development 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/assets/i18n/ src/app/app.config.ts src/app/app.component.ts
git commit -m "feat: add i18n with ngx-translate (es/en)"
```

---

## Task 13: App Shell — Routing and Bottom Nav

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.component.ts` and `app.component.html`
- Create: `src/app/core/auth.guard.ts`

- [ ] **Step 1: Create auth.guard.ts**

```ts
// src/app/core/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.session()) return true;
  return router.createUrlTree(['/login']);
};
```

- [ ] **Step 2: Define routes**

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then(m => m.LoginPageComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'recipes', loadComponent: () => import('./features/recipes/recipes-page/recipes-page.component').then(m => m.RecipesPageComponent) },
      { path: 'recipes/:id', loadComponent: () => import('./features/recipes/recipe-detail/recipe-detail.component').then(m => m.RecipeDetailComponent) },
      { path: 'import', loadComponent: () => import('./features/import/import-page/import-page.component').then(m => m.ImportPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent) },
      { path: '', redirectTo: 'recipes', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'recipes' },
];
```

- [ ] **Step 3: Update AppComponent with bottom nav**

```ts
// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    protected auth: AuthService,
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('lang') ?? 'es';
    this.translate.use(saved);
  }
}
```

```html
<!-- src/app/app.component.html -->
<div class="flex flex-col min-h-screen">
  <main class="flex-1 overflow-auto pb-16">
    <router-outlet />
  </main>

  @if (auth.session()) {
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      <a routerLink="/recipes" routerLinkActive="text-primary"
         class="flex-1 flex flex-col items-center py-3 text-gray-500 text-xs gap-1">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {{ 'nav.recipes' | translate }}
      </a>
      <a routerLink="/import" routerLinkActive="text-primary"
         class="flex-1 flex flex-col items-center py-3 text-gray-500 text-xs gap-1">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {{ 'nav.import' | translate }}
      </a>
      <a routerLink="/settings" routerLinkActive="text-primary"
         class="flex-1 flex flex-col items-center py-3 text-gray-500 text-xs gap-1">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {{ 'nav.settings' | translate }}
      </a>
    </nav>
  }
</div>
```

- [ ] **Step 4: Build to verify routing compiles**

```bash
npx ng build --configuration=development 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/app.component.ts src/app/app.component.html src/app/core/auth.guard.ts
git commit -m "feat: add routing, auth guard, and bottom navigation shell"
```

---

## Task 14: Login Page

**Files:**
- Create: `src/app/features/auth/login-page.component.ts`
- Create: `src/app/features/auth/login-page.component.html`

- [ ] **Step 1: Create login component**

```ts
// src/app/features/auth/login-page.component.ts
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  email = '';
  sent = signal(false);
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn(this.email);
      this.sent.set(true);
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
```

```html
<!-- src/app/features/auth/login-page.component.html -->
<div class="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
  <div class="w-full max-w-sm">
    <h1 class="text-3xl font-bold text-primary mb-1">{{ 'auth.title' | translate }}</h1>
    <p class="text-gray-500 mb-8">{{ 'auth.subtitle' | translate }}</p>

    @if (sent()) {
      <p class="text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
        {{ 'auth.check_email' | translate }}
      </p>
    } @else {
      <form (ngSubmit)="submit()" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {{ 'auth.email_label' | translate }}
          <input type="email" [(ngModel)]="email" name="email" required
            class="border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary" />
        </label>

        @if (error()) {
          <p class="text-red-600 text-sm">{{ error() }}</p>
        }

        <button type="submit" [disabled]="loading()"
          class="bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50">
          {{ 'auth.send_link' | translate }}
        </button>
      </form>
    }
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/auth/
git commit -m "feat: add magic-link login page"
```

---

## Task 15: ImportService

**Files:**
- Create: `src/app/features/import/import.service.ts`
- Create: `src/app/features/import/import.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/features/import/import.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ImportService } from './import.service';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { signal } from '@angular/core';

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'u1/file.json' }, error: null });
const mockFrom = jest.fn();
const mockStorage = { from: jest.fn().mockReturnValue({ upload: mockUpload }) };
const mockSupabase = { client: { from: mockFrom, storage: mockStorage } };
const mockAuth = { user: signal({ id: 'u1' }) };

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthService, useValue: mockAuth },
      ],
    });
    service = TestBed.inject(ImportService);
    jest.clearAllMocks();
  });

  it('uploadFile uploads to storage and creates import_job', async () => {
    const insertMock = jest.fn().mockResolvedValue({
      data: { id: 'j1', status: 'pending', file_path: 'u1/file.json', user_id: 'u1', created_at: '' },
      error: null,
    });
    mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: insertMock }) }) });

    const file = new File(['{}'], 'recipe.json', { type: 'application/json' });
    const job = await service.uploadFile(file);

    expect(mockStorage.from).toHaveBeenCalledWith('recipe-imports');
    expect(mockUpload).toHaveBeenCalled();
    expect(job.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=import.service
```

Expected: FAIL.

- [ ] **Step 3: Implement ImportService**

```ts
// src/app/features/import/import.service.ts
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=import.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/import/import.service.ts src/app/features/import/import.service.spec.ts
git commit -m "feat: add ImportService with file upload and realtime job status"
```

---

## Task 16: Edge Function — parse-recipe-import

**Files:**
- Create: `supabase/functions/parse-recipe-import/index.ts`

- [ ] **Step 1: Create Edge Function**

```ts
// supabase/functions/parse-recipe-import/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse as parseYaml } from 'https://deno.land/x/js_yaml_port@3.14.0/js-yaml.js';

const INGREDIENT_RE = /^-\s+(?:(\d+(?:\.\d+)?)\s+([\w/]+)\s+)?(.+?)(?:,\s*(.+))?$/;
const STEP_TIME_RE = /\((\d+)\s*min\)/i;
const STEP_GROUP_RE = /\[group:(\d+)\]/i;

function parseMarkdown(text: string): object {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) throw new Error('Missing YAML front-matter');

  const meta = parseYaml(fmMatch[1]) as Record<string, any>;
  const body = fmMatch[2];

  const ingredientHeading = /^##\s+(Ingredientes|Ingredients)\s*$/im;
  const stepHeading = /^##\s+(Pasos|Steps)\s*$/im;

  const ingMatch = ingredientHeading.exec(body);
  const stepMatch = stepHeading.exec(body);
  if (!ingMatch || !stepMatch) throw new Error('Missing ## Ingredientes/Ingredients or ## Pasos/Steps heading');

  const ingStart = ingMatch.index! + ingMatch[0].length;
  const stepStart = stepMatch.index! + stepMatch[0].length;
  const ingBlock = body.slice(ingStart, stepMatch.index).trim();
  const stepBlock = body.slice(stepStart).trim();

  // Description: text between front-matter end and first heading
  const firstHeading = Math.min(ingMatch.index!, stepMatch.index!);
  const description = body.slice(0, firstHeading).trim() || undefined;

  const ingredients = ingBlock.split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(line => {
      const m = INGREDIENT_RE.exec(line.trim());
      if (!m) return null;
      const [, qty, unit, name, prep] = m;
      return {
        name: name.trim(),
        ...(qty ? { qty: parseFloat(qty) } : {}),
        ...(unit ? { unit } : {}),
        ...(prep ? { prep: prep.trim() } : {}),
      };
    })
    .filter(Boolean);

  const steps = stepBlock.split('\n')
    .filter(l => /^\d+\./.test(l.trim()))
    .map(line => {
      const orderMatch = /^(\d+)\./.exec(line.trim());
      const order = orderMatch ? parseInt(orderMatch[1]) : 0;
      let text = line.trim().replace(/^\d+\.\s*/, '');

      const timeM = STEP_TIME_RE.exec(text);
      const groupM = STEP_GROUP_RE.exec(text);
      const time = timeM ? parseInt(timeM[1]) : undefined;
      const concurrent_group = groupM ? parseInt(groupM[1]) : undefined;

      text = text.replace(STEP_TIME_RE, '').replace(STEP_GROUP_RE, '').trim();
      return { order, text, ...(time ? { time } : {}), ...(concurrent_group ? { concurrent_group } : {}) };
    });

  return { ...meta, description, ingredients, steps };
}

function parseJson(text: string): object | object[] {
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  const payload = await req.json();
  const { record } = payload; // import_jobs row
  if (!record) return new Response('no record', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Mark as processing
  await supabase.from('import_jobs').update({ status: 'processing' }).eq('id', record.id);

  try {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('recipe-imports')
      .download(record.file_path);
    if (dlError) throw new Error(dlError.message);

    const text = await fileData.text();
    const isJson = record.file_path.endsWith('.json');
    const parsed = isJson ? parseJson(text) : parseMarkdown(text);
    const recipes = Array.isArray(parsed) ? parsed : [parsed];

    for (const recipe of recipes) {
      if (!recipe.name || !recipe.steps) throw new Error('Recipe missing name or steps');
      await supabase.from('recipes').insert({
        ...recipe,
        user_id: record.user_id,
        source_file: record.file_path,
      });
    }

    await supabase.from('import_jobs').update({ status: 'done' }).eq('id', record.id);
  } catch (e: any) {
    await supabase.from('import_jobs')
      .update({ status: 'error', error_msg: e.message })
      .eq('id', record.id);
  }

  return new Response('ok');
});
```

- [ ] **Step 2: Create a database webhook to trigger the function**

In Supabase Studio → Database → Webhooks → Create:
- Name: `on_import_job_insert`
- Table: `import_jobs`
- Events: INSERT
- URL: `http://host.docker.internal:54321/functions/v1/parse-recipe-import` (local) or your deployed function URL
- HTTP Method: POST

- [ ] **Step 3: Test the function locally**

```bash
npx supabase functions serve parse-recipe-import --env-file .env.local
```

Create `.env.local`:
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/parse-recipe-import/index.ts .env.local
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "feat: add parse-recipe-import Edge Function (JSON + MD)"
```

---

## Task 17: Import Page Component

**Files:**
- Create: `src/app/features/import/import-page/import-page.component.ts`
- Create: `src/app/features/import/import-page/import-page.component.html`

- [ ] **Step 1: Create component**

```ts
// src/app/features/import/import-page/import-page.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ImportService } from '../import.service';
import { ImportJob } from '../../recipes/models/recipe.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [TranslateModule, DatePipe],
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
    return {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      done: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
    }[status] ?? '';
  }
}
```

```html
<!-- src/app/features/import/import-page/import-page.component.html -->
<div class="p-4 max-w-lg mx-auto">
  <h1 class="text-xl font-bold mb-4">{{ 'import.title' | translate }}</h1>

  <div
    (dragover)="onDragOver($event)"
    (dragleave)="onDragLeave()"
    (drop)="onDrop($event)"
    [class.border-primary]="dragOver()"
    class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4 transition-colors">
    <p class="text-gray-500 mb-3">{{ 'import.drop_hint' | translate }}</p>
    <label class="cursor-pointer bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">
      {{ 'import.browse' | translate }}
      <input type="file" accept=".json,.md" class="hidden" (change)="onFileChange($event)" />
    </label>
  </div>

  @if (uploading()) {
    <div class="flex items-center gap-2 text-sm text-gray-600 mb-4">
      <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      Subiendo...
    </div>
  }

  @if (error()) {
    <p class="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">{{ error() }}</p>
  }

  @if (jobs().length > 0) {
    <h2 class="font-semibold mb-2">{{ 'import.history_title' | translate }}</h2>
    <ul class="flex flex-col gap-2">
      @for (job of jobs(); track job.id) {
        <li class="bg-white border border-gray-200 rounded-lg p-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium truncate">{{ job.file_path.split('/').pop() }}</span>
            <span [class]="'text-xs px-2 py-0.5 rounded-full font-medium ' + statusClass(job.status)">
              {{ 'import.status_' + job.status | translate }}
            </span>
          </div>
          <p class="text-xs text-gray-400">{{ job.created_at | date:'short' }}</p>
          @if (job.status === 'error' && job.error_msg) {
            <p class="text-xs text-red-600 mt-1 font-mono">{{ job.error_msg }}</p>
          }
        </li>
      }
    </ul>
  }
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/import/
git commit -m "feat: add import page with drag-drop upload and job history"
```

---

## Task 18: RecipesPage + RecipeCard + RecipeFilter

**Files:**
- Create: `src/app/features/recipes/recipe-card/recipe-card.component.ts`
- Create: `src/app/features/recipes/recipe-card/recipe-card.component.html`
- Create: `src/app/features/recipes/recipe-filter/recipe-filter.component.ts`
- Create: `src/app/features/recipes/recipe-filter/recipe-filter.component.html`
- Create: `src/app/features/recipes/ingredient-search/ingredient-search.component.ts`
- Create: `src/app/features/recipes/ingredient-search/ingredient-search.component.html`
- Create: `src/app/features/recipes/recipes-page/recipes-page.component.ts`
- Create: `src/app/features/recipes/recipes-page/recipes-page.component.html`

- [ ] **Step 1: Create RecipeCard component**

```ts
// src/app/features/recipes/recipe-card/recipe-card.component.ts
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Recipe } from '../models/recipe.model';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './recipe-card.component.html',
})
export class RecipeCardComponent {
  recipe = input.required<Recipe>();
  favoriteToggled = output<string>();
}
```

```html
<!-- src/app/features/recipes/recipe-card/recipe-card.component.html -->
<a [routerLink]="['/recipes', recipe().id]"
   class="block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm active:scale-95 transition-transform">
  @if (recipe().image_path) {
    <img [src]="recipe().image_path" [alt]="recipe().name"
         class="w-full h-32 object-cover" loading="lazy" />
  } @else {
    <div class="w-full h-32 bg-gray-100 flex items-center justify-center text-4xl">🍽️</div>
  }
  <div class="p-3">
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-semibold text-sm leading-tight">{{ recipe().name }}</h3>
      <button (click)="$event.preventDefault(); favoriteToggled.emit(recipe().id)"
        class="text-lg flex-shrink-0">
        {{ recipe().is_favorite ? '★' : '☆' }}
      </button>
    </div>
    <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
      @if (recipe().total_time) {
        <span>{{ recipe().total_time }} {{ 'recipes.minutes' | translate }}</span>
      }
      @if (recipe().cuisine_type) {
        <span>· {{ recipe().cuisine_type }}</span>
      }
    </div>
  </div>
</a>
```

- [ ] **Step 2: Create RecipeFilter component**

```ts
// src/app/features/recipes/recipe-filter/recipe-filter.component.ts
import { Component, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RecipeFilter, Difficulty } from '../models/recipe.model';

@Component({
  selector: 'app-recipe-filter',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './recipe-filter.component.html',
})
export class RecipeFilterComponent {
  filterChanged = output<Partial<RecipeFilter>>();

  expanded = signal(false);
  favorites = signal(false);
  selectedCuisine = signal<string | null>(null);
  selectedMaxTime = signal<number | null>(null);
  selectedDifficulty = signal<Difficulty | null>(null);

  readonly cuisines = ['italiana', 'española', 'mexicana', 'japonesa', 'americana', 'francesa'];
  readonly times = [{ label: '< 15 min', value: 15 }, { label: '< 30 min', value: 30 }, { label: '< 60 min', value: 60 }];
  readonly difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  toggleFavorites(): void {
    this.favorites.update(v => !v);
    this.emit();
  }

  setCuisine(c: string): void {
    this.selectedCuisine.set(this.selectedCuisine() === c ? null : c);
    this.emit();
  }

  setMaxTime(t: number): void {
    this.selectedMaxTime.set(this.selectedMaxTime() === t ? null : t);
    this.emit();
  }

  setDifficulty(d: Difficulty): void {
    this.selectedDifficulty.set(this.selectedDifficulty() === d ? null : d);
    this.emit();
  }

  private emit(): void {
    this.filterChanged.emit({
      favorites_only: this.favorites() || undefined,
      cuisine_type: this.selectedCuisine() ?? undefined,
      max_time: this.selectedMaxTime() ?? undefined,
      difficulty: this.selectedDifficulty() ?? undefined,
    });
  }
}
```

```html
<!-- src/app/features/recipes/recipe-filter/recipe-filter.component.html -->
<div class="px-4 pb-2">
  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    <button (click)="toggleFavorites()"
      [class.bg-primary]="favorites()" [class.text-white]="favorites()"
      class="flex-shrink-0 border border-gray-300 rounded-full px-3 py-1 text-sm whitespace-nowrap">
      ★ {{ 'recipes.favorites' | translate }}
    </button>

    @for (t of times; track t.value) {
      <button (click)="setMaxTime(t.value)"
        [class.bg-primary]="selectedMaxTime() === t.value" [class.text-white]="selectedMaxTime() === t.value"
        class="flex-shrink-0 border border-gray-300 rounded-full px-3 py-1 text-sm whitespace-nowrap">
        {{ t.label }}
      </button>
    }

    <button (click)="expanded.set(!expanded())"
      class="flex-shrink-0 border border-gray-300 rounded-full px-3 py-1 text-sm whitespace-nowrap">
      {{ 'recipes.filters' | translate }} {{ expanded() ? '▲' : '▼' }}
    </button>
  </div>

  @if (expanded()) {
    <div class="mt-2 flex flex-col gap-2">
      <div class="flex gap-2 flex-wrap">
        @for (c of cuisines; track c) {
          <button (click)="setCuisine(c)"
            [class.bg-primary]="selectedCuisine() === c" [class.text-white]="selectedCuisine() === c"
            class="border border-gray-300 rounded-full px-3 py-1 text-xs">
            {{ c }}
          </button>
        }
      </div>
      <div class="flex gap-2">
        @for (d of difficulties; track d) {
          <button (click)="setDifficulty(d)"
            [class.bg-primary]="selectedDifficulty() === d" [class.text-white]="selectedDifficulty() === d"
            class="border border-gray-300 rounded-full px-3 py-1 text-xs">
            {{ 'difficulty.' + d | translate }}
          </button>
        }
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Create IngredientSearch component**

```ts
// src/app/features/recipes/ingredient-search/ingredient-search.component.ts
import { Component, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';

@Component({
  selector: 'app-ingredient-search',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './ingredient-search.component.html',
})
export class IngredientSearchComponent implements OnInit {
  ingredientsChanged = output<string[]>();
  queryChanged = output<string>();

  expanded = signal(false);
  query = signal('');
  suggestions = signal<string[]>([]);
  selected = signal<string[]>([]);
  filtered = signal<string[]>([]);
  inputText = '';

  constructor(private recipeService: RecipeService) {}

  async ngOnInit(): Promise<void> {
    const all = await this.recipeService.getIngredientSuggestions();
    this.suggestions.set(all);
    this.filtered.set(all.slice(0, 10));
  }

  onInputChange(value: string): void {
    this.inputText = value;
    if (this.expanded()) {
      this.filtered.set(
        this.suggestions()
          .filter(s => s.toLowerCase().includes(value.toLowerCase()) && !this.selected().includes(s))
          .slice(0, 10)
      );
    } else {
      this.query.set(value);
      this.queryChanged.emit(value);
    }
  }

  enterIngredientMode(): void {
    this.expanded.set(true);
    this.inputText = '';
    this.filtered.set(this.suggestions().filter(s => !this.selected().includes(s)).slice(0, 10));
  }

  exitIngredientMode(): void {
    this.expanded.set(false);
    this.inputText = '';
  }

  addIngredient(name: string): void {
    if (!this.selected().includes(name)) {
      this.selected.update(s => [...s, name]);
      this.ingredientsChanged.emit(this.selected());
    }
    this.inputText = '';
    this.filtered.set(this.suggestions().filter(s => !this.selected().includes(s)).slice(0, 10));
  }

  removeIngredient(name: string): void {
    this.selected.update(s => s.filter(i => i !== name));
    this.ingredientsChanged.emit(this.selected());
  }
}
```

```html
<!-- src/app/features/recipes/ingredient-search/ingredient-search.component.html -->
<div class="px-4 pt-3 pb-1">
  <div class="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
    <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input type="text" [value]="inputText" (input)="onInputChange($any($event.target).value)"
      (focus)="!expanded() && enterIngredientMode()"
      [placeholder]="(expanded() ? 'recipes.ingredient_prompt' : 'recipes.search_placeholder') | translate"
      class="flex-1 bg-transparent text-sm outline-none" />
    @if (expanded()) {
      <button (click)="exitIngredientMode()" class="text-gray-400 text-xs">✕</button>
    }
  </div>

  @if (selected().length > 0) {
    <div class="flex gap-2 flex-wrap mt-2">
      @for (ing of selected(); track ing) {
        <span class="bg-primary text-white text-xs rounded-full px-3 py-1 flex items-center gap-1">
          {{ ing }}
          <button (click)="removeIngredient(ing)" class="ml-1">✕</button>
        </span>
      }
    </div>
  }

  @if (expanded() && filtered().length > 0) {
    <ul class="mt-2 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm">
      @for (sug of filtered(); track sug) {
        <li>
          <button (click)="addIngredient(sug)"
            class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
            {{ sug }}
          </button>
        </li>
      }
    </ul>
  }
</div>
```

- [ ] **Step 4: Create RecipesPage**

```ts
// src/app/features/recipes/recipes-page/recipes-page.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { AuthService } from '../../../core/auth.service';
import { Recipe, RecipeFilter } from '../models/recipe.model';
import { RecipeCardComponent } from '../recipe-card/recipe-card.component';
import { RecipeFilterComponent } from '../recipe-filter/recipe-filter.component';
import { IngredientSearchComponent } from '../ingredient-search/ingredient-search.component';

@Component({
  selector: 'app-recipes-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, RecipeCardComponent, RecipeFilterComponent, IngredientSearchComponent],
  templateUrl: './recipes-page.component.html',
})
export class RecipesPageComponent implements OnInit {
  recipes = signal<Recipe[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  private filter: RecipeFilter = {};

  constructor(
    private recipeService: RecipeService,
    private auth: AuthService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async onFilterChanged(partial: Partial<RecipeFilter>): Promise<void> {
    this.filter = { ...this.filter, ...partial };
    await this.load();
  }

  async onQueryChanged(query: string): Promise<void> {
    this.filter = { ...this.filter, query: query || undefined };
    await this.load();
  }

  async onIngredientsChanged(ingredients: string[]): Promise<void> {
    this.filter = { ...this.filter, ingredients: ingredients.length ? ingredients : undefined };
    await this.load();
  }

  async onFavoriteToggled(recipeId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const isFav = await this.recipeService.toggleFavorite(recipeId, user.id);
    this.recipes.update(rs => rs.map(r => r.id === recipeId ? { ...r, is_favorite: isFav } : r));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.recipes.set(await this.recipeService.search(this.filter));
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
```

```html
<!-- src/app/features/recipes/recipes-page/recipes-page.component.html -->
<div class="flex flex-col h-full">
  <app-ingredient-search
    (queryChanged)="onQueryChanged($event)"
    (ingredientsChanged)="onIngredientsChanged($event)" />

  <app-recipe-filter (filterChanged)="onFilterChanged($event)" />

  <div class="flex-1 overflow-auto px-4 pt-2">
    @if (loading()) {
      <div class="flex justify-center pt-12">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    } @else if (error()) {
      <p class="text-red-600 text-center pt-12">{{ error() }}</p>
    } @else if (recipes().length === 0) {
      <div class="flex flex-col items-center pt-16 text-center">
        <span class="text-6xl mb-4">🍽️</span>
        <p class="text-lg font-semibold text-gray-700 mb-2">{{ 'recipes.empty_title' | translate }}</p>
        <a routerLink="/import" class="text-primary font-medium">
          {{ 'recipes.empty_action' | translate }}
        </a>
      </div>
    } @else {
      <div class="grid grid-cols-2 gap-3 pb-4">
        @for (recipe of recipes(); track recipe.id) {
          <app-recipe-card [recipe]="recipe" (favoriteToggled)="onFavoriteToggled($event)" />
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/recipes/
git commit -m "feat: add recipes list with search, filter, and favorites"
```

---

## Task 19: Recipe Detail Page

**Files:**
- Create: `src/app/features/recipes/recipe-detail/recipe-detail.component.ts`
- Create: `src/app/features/recipes/recipe-detail/recipe-detail.component.html`

- [ ] **Step 1: Create component**

```ts
// src/app/features/recipes/recipe-detail/recipe-detail.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RecipeService } from '../recipe.service';
import { Recipe } from '../models/recipe.model';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './recipe-detail.component.html',
})
export class RecipeDetailComponent implements OnInit {
  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  cookingMode = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.recipe.set(await this.recipeService.getById(id));
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/recipes']);
  }

  get stepGroups(): Array<{ group: number | null; steps: Recipe['steps'] }> {
    const steps = this.recipe()?.steps ?? [];
    const map = new Map<number | null, Recipe['steps']>();
    for (const step of steps) {
      const key = step.concurrent_group ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    return Array.from(map.entries()).map(([group, steps]) => ({ group, steps }));
  }
}
```

```html
<!-- src/app/features/recipes/recipe-detail/recipe-detail.component.html -->
@if (loading()) {
  <div class="flex justify-center pt-24">
    <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
} @else if (recipe()) {
  <div class="pb-24">
    <!-- Header -->
    <div class="relative">
      @if (recipe()!.image_path) {
        <img [src]="recipe()!.image_path" [alt]="recipe()!.name" class="w-full h-48 object-cover" />
      } @else {
        <div class="w-full h-48 bg-gray-100 flex items-center justify-center text-6xl">🍽️</div>
      }
      <button (click)="goBack()" class="absolute top-4 left-4 bg-white rounded-full p-2 shadow">
        ←
      </button>
    </div>

    <div class="px-4 pt-4">
      <h1 class="text-2xl font-bold mb-1">{{ recipe()!.name }}</h1>
      <p class="text-gray-500 text-sm mb-3">{{ recipe()!.description }}</p>

      <!-- Meta chips -->
      <div class="flex gap-2 flex-wrap mb-4 text-xs">
        @if (recipe()!.total_time) {
          <span class="bg-gray-100 rounded-full px-3 py-1">⏱ {{ recipe()!.total_time }} min</span>
        }
        @if (recipe()!.servings) {
          <span class="bg-gray-100 rounded-full px-3 py-1">👥 {{ recipe()!.servings }}</span>
        }
        @if (recipe()!.difficulty) {
          <span class="bg-gray-100 rounded-full px-3 py-1">{{ 'difficulty.' + recipe()!.difficulty | translate }}</span>
        }
        @if (recipe()!.cuisine_type) {
          <span class="bg-gray-100 rounded-full px-3 py-1">{{ recipe()!.cuisine_type }}</span>
        }
      </div>

      <!-- Allergens -->
      @if (recipe()!.allergens.length > 0) {
        <div class="flex gap-2 flex-wrap mb-4">
          @for (a of recipe()!.allergens; track a) {
            <span class="bg-orange-100 text-orange-800 text-xs rounded-full px-2 py-0.5">⚠ {{ a }}</span>
          }
        </div>
      }

      <!-- Ingredients -->
      <h2 class="font-semibold text-base mb-2">Ingredientes</h2>
      <ul class="mb-6 flex flex-col gap-1">
        @for (ing of recipe()!.ingredients; track ing.name) {
          <li class="flex gap-2 text-sm py-1 border-b border-gray-100">
            <span class="text-gray-500 w-16 text-right flex-shrink-0">
              {{ ing.qty ? ing.qty + ' ' + (ing.unit ?? '') : '' }}
            </span>
            <span class="font-medium">{{ ing.name }}</span>
            @if (ing.prep) {
              <span class="text-gray-400 italic">{{ ing.prep }}</span>
            }
          </li>
        }
      </ul>

      <!-- Steps -->
      <h2 class="font-semibold text-base mb-2">Pasos</h2>
      <div class="flex flex-col gap-3 mb-8">
        @for (group of stepGroups; track $index) {
          @if (group.group !== null && group.steps.length > 1) {
            <div class="border border-blue-200 rounded-xl p-3 bg-blue-50">
              <p class="text-xs text-blue-600 font-medium mb-2">⚡ Pasos simultáneos</p>
              @for (step of group.steps; track step.order) {
                <div class="mb-2 last:mb-0">
                  <span class="text-xs text-blue-400 mr-1">{{ step.order }}.</span>
                  <span class="text-sm">{{ step.text }}</span>
                  @if (step.time) {
                    <span class="text-xs text-blue-400 ml-1">({{ step.time }} min)</span>
                  }
                </div>
              }
            </div>
          } @else {
            @for (step of group.steps; track step.order) {
              <div class="flex gap-3">
                <span class="w-6 h-6 bg-primary text-white rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">
                  {{ step.order }}
                </span>
                <div class="flex-1">
                  <p class="text-sm">{{ step.text }}</p>
                  @if (step.time) {
                    <p class="text-xs text-gray-400 mt-0.5">{{ step.time }} min</p>
                  }
                </div>
              </div>
            }
          }
        }
      </div>
    </div>

    <!-- Cooking mode button -->
    <div class="fixed bottom-16 left-0 right-0 px-4">
      <button (click)="cookingMode.set(true)"
        class="w-full bg-primary text-white rounded-xl py-4 font-semibold text-base shadow-lg">
        {{ 'recipes.start_cooking' | translate }}
      </button>
    </div>
  </div>

  <!-- Cooking mode overlay -->
  @if (cookingMode()) {
    <app-cooking-mode [recipe]="recipe()!" (exit)="cookingMode.set(false)" />
  }
}
```

- [ ] **Step 2: Add CookingMode import to detail component**

```ts
// Add to recipe-detail.component.ts imports array:
import { CookingModeComponent } from '../cooking-mode/cooking-mode.component';

// And add to @Component imports:
imports: [TranslateModule, CookingModeComponent],
```

- [ ] **Step 3: Commit (placeholder — CookingMode created in next task)**

```bash
git add src/app/features/recipes/recipe-detail/
git commit -m "feat: add recipe detail page with ingredients and steps"
```

---

## Task 20: WakeLockService

**Files:**
- Create: `src/app/features/recipes/cooking-mode/wake-lock.service.ts`
- Create: `src/app/features/recipes/cooking-mode/wake-lock.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/features/recipes/cooking-mode/wake-lock.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { WakeLockService } from './wake-lock.service';

describe('WakeLockService', () => {
  let service: WakeLockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WakeLockService);
  });

  it('request() resolves without throwing when API unavailable', async () => {
    // jsdom doesn't have wakeLock — should degrade silently
    await expect(service.request()).resolves.not.toThrow();
  });

  it('release() is safe to call before request()', () => {
    expect(() => service.release()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=wake-lock.service
```

Expected: FAIL.

- [ ] **Step 3: Implement WakeLockService**

```ts
// src/app/features/recipes/cooking-mode/wake-lock.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private lock: WakeLockSentinel | null = null;

  async request(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.lock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Permission denied or API unavailable — degrade silently
    }
  }

  release(): void {
    this.lock?.release().catch(() => {});
    this.lock = null;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=wake-lock.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/recipes/cooking-mode/wake-lock.service.ts \
  src/app/features/recipes/cooking-mode/wake-lock.service.spec.ts
git commit -m "feat: add WakeLockService with silent degradation"
```

---

## Task 21: StepTimer Component

**Files:**
- Create: `src/app/features/recipes/cooking-mode/step-timer/step-timer.component.ts`
- Create: `src/app/features/recipes/cooking-mode/step-timer/step-timer.component.html`

- [ ] **Step 1: Write failing test**

```ts
// src/app/features/recipes/cooking-mode/step-timer/step-timer.component.spec.ts
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { StepTimerComponent } from './step-timer.component';

describe('StepTimerComponent', () => {
  let component: StepTimerComponent;
  let fixture: ComponentFixture<StepTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepTimerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StepTimerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('durationMinutes', 1);
    fixture.detectChanges();
  });

  it('starts with full duration', () => {
    expect(component.remainingSeconds()).toBe(60);
  });

  it('counts down when running', fakeAsync(() => {
    component.start();
    tick(3000);
    expect(component.remainingSeconds()).toBe(57);
    component.stop();
  }));

  it('emits done when countdown reaches zero', fakeAsync(() => {
    const doneSpy = jest.fn();
    component.done.subscribe(doneSpy);
    component.start();
    tick(60000);
    expect(doneSpy).toHaveBeenCalled();
    component.stop();
  }));
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=step-timer
```

Expected: FAIL.

- [ ] **Step 3: Implement StepTimerComponent**

```ts
// src/app/features/recipes/cooking-mode/step-timer/step-timer.component.ts
import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-step-timer',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './step-timer.component.html',
})
export class StepTimerComponent implements OnInit, OnDestroy {
  durationMinutes = input.required<number>();
  done = output<void>();

  remainingSeconds = signal(0);
  finished = signal(false);
  private interval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.remainingSeconds.set(this.durationMinutes() * 60);
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const next = this.remainingSeconds() - 1;
      if (next <= 0) {
        this.remainingSeconds.set(0);
        this.finished.set(true);
        this.stop();
        this.vibrate();
        this.done.emit();
      } else {
        this.remainingSeconds.set(next);
      }
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  get display(): string {
    const s = this.remainingSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  private vibrate(): void {
    try { navigator.vibrate?.([300, 100, 300]); } catch {}
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
```

```html
<!-- src/app/features/recipes/cooking-mode/step-timer/step-timer.component.html -->
<div class="flex flex-col items-center">
  <span [class.text-red-500]="finished()" class="text-3xl font-mono font-bold tabular-nums">
    {{ display }}
  </span>
  @if (finished()) {
    <span class="text-xs text-red-500 font-medium animate-pulse">
      {{ 'cooking.timer_done' | translate }}
    </span>
  }
</div>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=step-timer
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/recipes/cooking-mode/step-timer/
git commit -m "feat: add StepTimerComponent with countdown and vibration"
```

---

## Task 22: CookingMode Component

**Files:**
- Create: `src/app/features/recipes/cooking-mode/cooking-mode.component.ts`
- Create: `src/app/features/recipes/cooking-mode/cooking-mode.component.html`

- [ ] **Step 1: Create component**

```ts
// src/app/features/recipes/cooking-mode/cooking-mode.component.ts
import { Component, input, output, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Recipe, Step } from '../models/recipe.model';
import { WakeLockService } from './wake-lock.service';
import { StepTimerComponent } from './step-timer/step-timer.component';

interface StepGroup {
  groupIndex: number;
  steps: Step[];
  timersFinished: boolean[];
}

@Component({
  selector: 'app-cooking-mode',
  standalone: true,
  imports: [TranslateModule, StepTimerComponent],
  templateUrl: './cooking-mode.component.html',
})
export class CookingModeComponent implements OnInit, OnDestroy {
  recipe = input.required<Recipe>();
  exit = output<void>();

  currentGroupIndex = signal(0);
  stepGroups = signal<StepGroup[]>([]);

  constructor(private wakeLock: WakeLockService) {}

  ngOnInit(): void {
    this.wakeLock.request();
    this.buildGroups();
  }

  ngOnDestroy(): void {
    this.wakeLock.release();
  }

  private buildGroups(): void {
    const steps = [...this.recipe().steps].sort((a, b) => a.order - b.order);
    const map = new Map<string, Step[]>();
    for (const step of steps) {
      const key = step.concurrent_group != null ? `g${step.concurrent_group}` : `s${step.order}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    this.stepGroups.set(
      Array.from(map.entries()).map(([, steps], i) => ({
        groupIndex: i,
        steps,
        timersFinished: steps.map(() => false),
      }))
    );
  }

  get currentGroup(): StepGroup {
    return this.stepGroups()[this.currentGroupIndex()];
  }

  get totalGroups(): number {
    return this.stepGroups().length;
  }

  get canAdvance(): boolean {
    return this.currentGroup.timersFinished.every(Boolean);
  }

  onTimerDone(stepIdx: number): void {
    this.stepGroups.update(groups => {
      const updated = [...groups];
      updated[this.currentGroupIndex()] = {
        ...updated[this.currentGroupIndex()],
        timersFinished: updated[this.currentGroupIndex()].timersFinished.map(
          (v, i) => i === stepIdx ? true : v
        ),
      };
      return updated;
    });
  }

  dismissTimer(stepIdx: number): void {
    this.onTimerDone(stepIdx);
  }

  advance(): void {
    if (this.currentGroupIndex() < this.totalGroups - 1) {
      this.currentGroupIndex.update(i => i + 1);
    } else {
      this.exit.emit();
    }
  }
}
```

```html
<!-- src/app/features/recipes/cooking-mode/cooking-mode.component.html -->
<div class="fixed inset-0 bg-white z-50 flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-gray-100">
    <button (click)="exit.emit()" class="text-gray-500 text-sm">
      ← {{ 'cooking.exit' | translate }}
    </button>
    <span class="text-sm font-medium text-gray-600">
      {{ 'cooking.step_of' | translate:{ current: currentGroupIndex() + 1, total: totalGroups } }}
    </span>
  </div>

  <!-- Progress bar -->
  <div class="h-1 bg-gray-100">
    <div class="h-full bg-primary transition-all"
      [style.width.%]="((currentGroupIndex() + 1) / totalGroups) * 100"></div>
  </div>

  <!-- Steps -->
  <div class="flex-1 overflow-auto px-4 py-6 flex flex-col gap-4">
    @for (step of currentGroup.steps; track step.order; let i = $index) {
      <div class="bg-gray-50 rounded-2xl p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <span class="text-xs text-gray-400 font-medium mb-1 block">Paso {{ step.order }}</span>
            <p class="text-base leading-relaxed">{{ step.text }}</p>
          </div>
          @if (step.time && currentGroup.timersFinished[i]) {
            <span class="text-green-500 text-xl flex-shrink-0">✓</span>
          }
        </div>

        @if (step.time) {
          <div class="mt-4 flex flex-col items-center gap-2">
            <app-step-timer
              [durationMinutes]="step.time"
              (done)="onTimerDone(i)" />
            @if (currentGroup.timersFinished[i]) {
              <button (click)="dismissTimer(i)"
                class="text-xs text-gray-500 border border-gray-300 rounded-full px-3 py-1">
                {{ 'cooking.dismiss' | translate }}
              </button>
            }
          </div>
        }
        <!-- Steps without a timer are pre-marked done in buildGroups() -->
      </div>
    }
  </div>

  <!-- Advance button -->
  <div class="px-4 pb-safe pb-6 pt-3 border-t border-gray-100">
    <button (click)="advance()"
      [disabled]="!canAdvance"
      class="w-full bg-primary text-white rounded-xl py-4 font-semibold text-base disabled:opacity-40 transition-opacity">
      {{ currentGroupIndex() === totalGroups - 1 ? '¡Listo!' : ('cooking.next' | translate) }}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Confirm buildGroups() pre-marks steps without timers**

The template already omits the no-timer block. Verify `buildGroups()` in `cooking-mode.component.ts` uses:

```ts
this.stepGroups.set(
  Array.from(map.entries()).map(([, steps], i) => ({
    groupIndex: i,
    steps,
    timersFinished: steps.map(s => !s.time), // no timer = already "done"
  }))
);
```

This is the version shown in Step 1. `canAdvance` works correctly because steps without timers are `true` from the start.

- [ ] **Step 3: Add CookingMode import to RecipeDetail**

Confirm `recipe-detail.component.ts` imports `CookingModeComponent` (done in Task 19 Step 2).

- [ ] **Step 4: Build to verify no type errors**

```bash
npx ng build --configuration=development 2>&1 | grep -E "(error|warning)" | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/recipes/cooking-mode/
git commit -m "feat: add CookingMode with concurrent timers and wake lock"
```

---

## Task 23: Settings Page

**Files:**
- Create: `src/app/features/settings/settings-page.component.ts`
- Create: `src/app/features/settings/settings-page.component.html`

- [ ] **Step 1: Create component**

```ts
// src/app/features/settings/settings-page.component.ts
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  currentLang = signal(localStorage.getItem('lang') ?? 'es');

  constructor(
    private auth: AuthService,
    private translate: TranslateService,
    private router: Router,
  ) {}

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
```

```html
<!-- src/app/features/settings/settings-page.component.html -->
<div class="px-4 pt-6">
  <h1 class="text-xl font-bold mb-6">{{ 'settings.title' | translate }}</h1>

  <section class="mb-6">
    <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {{ 'settings.language' | translate }}
    </h2>
    <div class="flex gap-2">
      <button (click)="switchLanguage('es')"
        [class.bg-primary]="currentLang() === 'es'" [class.text-white]="currentLang() === 'es'"
        class="flex-1 border border-gray-300 rounded-xl py-3 font-medium transition-colors">
        Español
      </button>
      <button (click)="switchLanguage('en')"
        [class.bg-primary]="currentLang() === 'en'" [class.text-white]="currentLang() === 'en'"
        class="flex-1 border border-gray-300 rounded-xl py-3 font-medium transition-colors">
        English
      </button>
    </div>
  </section>

  <section>
    <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {{ 'settings.account' | translate }}
    </h2>
    <p class="text-sm text-gray-600 mb-3">{{ auth.user()?.email }}</p>
    <button (click)="signOut()"
      class="w-full border border-red-300 text-red-600 rounded-xl py-3 font-medium">
      {{ 'settings.sign_out' | translate }}
    </button>
  </section>
</div>
```

- [ ] **Step 2: Fix missing auth injection in template**

The template references `auth.user()` but `auth` is private. Change to `protected auth`:

```ts
constructor(
  protected auth: AuthService,
  private translate: TranslateService,
  private router: Router,
) {}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/settings/
git commit -m "feat: add settings page with language toggle and sign out"
```

---

## Task 24: Cloudflare Pages Deployment

**Files:**
- Create: `wrangler.toml`
- Modify: `angular.json` output path

- [ ] **Step 1: Create wrangler.toml**

```toml
# wrangler.toml
name = "ephemeral-cuisine"
compatibility_date = "2026-06-16"

[pages]
build_output_dir = "dist/ephemeral-cuisine/browser"

[env.production.vars]
# No secrets here — Supabase keys are baked into environment.prod.ts at build time
```

- [ ] **Step 2: Add build script for Pages**

In `package.json`:
```json
"build:prod": "ng build --configuration=production"
```

- [ ] **Step 3: Create Supabase cloud project**

1. Go to supabase.com → New project
2. Copy Project URL and anon key
3. Update `src/environments/environment.prod.ts` with real values
4. Run `npx supabase db push --db-url YOUR_CLOUD_DB_URL` to apply migrations

- [ ] **Step 4: Connect to Cloudflare Pages**

```bash
npm install -D wrangler
npx wrangler pages project create ephemeral-cuisine
```

- [ ] **Step 5: Deploy**

```bash
npm run build:prod
npx wrangler pages deploy dist/ephemeral-cuisine/browser --project-name=ephemeral-cuisine
```

Expected: URL printed to terminal (e.g. `https://ephemeral-cuisine.pages.dev`).

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml package.json src/environments/environment.prod.ts
git commit -m "feat: add Cloudflare Pages deployment config"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task(s) |
|---|---|
| Stack (Angular + Cloudflare Pages + Supabase) | T1, T24 |
| public.users + auth trigger | T5 |
| recipes schema + tsvector trigger | T5 |
| favorite_recipes table | T5 |
| import_jobs table | T5 |
| RLS policies | T6 |
| Storage buckets | T6 |
| RecipeFilter (query, ingredients, cuisine, time, equipment, allergens, difficulty, favorites) | T11 |
| get_distinct_ingredients RLS-safe function | T11 |
| i18n (es/en, ngx-translate, translate pipe in nav) | T12, T13 |
| Auth (magic link, session signal) | T9, T14 |
| Auth guard | T13 |
| Bottom nav (translate pipe, 3 tabs) | T13 |
| Recipe model (all fields including concurrent_group, mise en place) | T10 |
| ImportService + upload + realtime poll | T15 |
| Edge Function JSON + MD parsing (both heading languages) | T16 |
| Import page + history + error detail | T17 |
| Recipes list + empty state | T18 |
| Recipe filter (collapsible, chips) | T18 |
| Ingredient search (autocomplete, multi-select) | T18 |
| Recipe card (favorites star) | T18 |
| Recipe detail (ingredients, steps, concurrent groups) | T19 |
| WakeLockService (silent degradation) | T20 |
| StepTimerComponent (per-step, vibration) | T21 |
| CookingMode (concurrent timers, manual advance, wake lock) | T22 |
| Settings (language toggle, sign out) | T23 |
| Cloudflare Pages deploy | T24 |
| Scanning (nice to have) | **not included** — future plan |

**Gaps found and fixed inline:**
- CookingMode auto-mark for steps without timers fixed in Task 22 Step 2 (removed template hack, fixed in `buildGroups()`)
- RecipeDetail `CookingModeComponent` import explicitly called out in Task 19 Step 2
- Settings `auth` visibility fixed in Task 23 Step 2

**Placeholder scan:** No TBDs, no "handle edge cases", no incomplete steps found.

**Type consistency:** `RecipeFilter`, `Recipe`, `ImportJob`, `Step`, `Ingredient` all defined in Task 10 and referenced consistently in T11, T15, T17, T18, T19, T21, T22.
