-- Create storage buckets for the app
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('recipe-imports', 'recipe-imports', false),
  ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recipe-imports (authenticated users own their folder)
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own imports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for recipe-images (public read, authenticated write own)
CREATE POLICY "Public read recipe images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'recipe-images');

CREATE POLICY "Users upload own images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);
