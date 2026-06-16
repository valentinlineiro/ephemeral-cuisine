CREATE OR REPLACE FUNCTION public.get_distinct_ingredients()
RETURNS text[] AS $$
  SELECT array_agg(DISTINCT elem->>'name' ORDER BY elem->>'name')
  FROM public.recipes, jsonb_array_elements(ingredients) AS elem
  WHERE auth.uid() = user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
