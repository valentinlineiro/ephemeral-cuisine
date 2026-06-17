-- dietary_profiles: one row per user, stores health targets + equipment + family
CREATE TABLE dietary_profiles (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_sodium_mg    integer NOT NULL DEFAULT 1500,
  calorie_target   integer NOT NULL DEFAULT 2200,
  protein_target_g integer NOT NULL DEFAULT 120,
  equipment        text[]  NOT NULL DEFAULT '{}',
  family_members   jsonb   NOT NULL DEFAULT '[]',
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dietary_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dietary_profile" ON dietary_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- inventory_items: what the user currently has at home
CREATE TABLE inventory_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit        text NOT NULL DEFAULT 'ud',
  expiry_date date,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_inventory" ON inventory_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- techniques: reusable cooking procedures the user knows
CREATE TABLE techniques (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  base_steps  jsonb NOT NULL DEFAULT '[]',
  equipment   text[] NOT NULL DEFAULT '{}',
  skill_level text NOT NULL DEFAULT 'beginner',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE techniques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_techniques" ON techniques
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cooked_versions: one row per cook session (technique + ingredient combo used + ratings)
CREATE TABLE cooked_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id      uuid REFERENCES recipes(id) ON DELETE SET NULL,
  technique_id   uuid REFERENCES techniques(id) ON DELETE SET NULL,
  cooked_at      timestamptz NOT NULL DEFAULT now(),
  combo          jsonb NOT NULL DEFAULT '{}',
  ratings        jsonb NOT NULL DEFAULT '{}',
  notes          text,
  modifications  text[] NOT NULL DEFAULT '{}',
  nutrition      jsonb,
  family_present text[] NOT NULL DEFAULT '{}',
  leftovers      jsonb
);
ALTER TABLE cooked_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cook_log" ON cooked_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- indexes for common query patterns
CREATE INDEX idx_inventory_items_user_id ON inventory_items(user_id, created_at);
CREATE INDEX idx_techniques_user_id ON techniques(user_id, created_at);
CREATE INDEX idx_cooked_versions_user_id ON cooked_versions(user_id, cooked_at);
CREATE INDEX idx_cooked_versions_recipe_id ON cooked_versions(recipe_id);
CREATE INDEX idx_cooked_versions_technique_id ON cooked_versions(technique_id);
