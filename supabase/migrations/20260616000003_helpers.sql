-- SECURITY INVOKER: runs as caller so auth.uid() resolves correctly via JWT claims
-- RLS on public.recipes already restricts rows to the authenticated user
CREATE OR REPLACE FUNCTION public.get_distinct_ingredients()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT array_agg(DISTINCT elem->>'name' ORDER BY elem->>'name')
  FROM public.recipes, jsonb_array_elements(ingredients) AS elem;
$$;
