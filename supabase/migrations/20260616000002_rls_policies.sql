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
