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
