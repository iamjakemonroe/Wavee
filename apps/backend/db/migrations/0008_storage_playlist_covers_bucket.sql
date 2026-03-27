-- Dedicated bucket for playlist cover images (API uses service role; policies mirror covers/avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'playlist-covers',
  'playlist-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for playlist-covers" ON storage.objects;
CREATE POLICY "Public read access for playlist-covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'playlist-covers');

DROP POLICY IF EXISTS "Authenticated upload playlist-covers" ON storage.objects;
CREATE POLICY "Authenticated upload playlist-covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'playlist-covers' AND auth.role() = 'authenticated');
