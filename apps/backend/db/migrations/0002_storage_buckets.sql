-- ============================================
-- Wavee Storage Buckets
-- Run this in the Supabase SQL Editor
-- ============================================

-- Create the "songs" bucket for audio files (public, 20MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'songs',
  'songs',
  true,
  20971520,
  ARRAY['audio/mpeg', 'audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- Create the "covers" bucket for cover images (public, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers',
  'covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Profile photos (dedicated bucket; API uses service role — policies mirror covers for any client-side use)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies --

-- Public read for songs
DROP POLICY IF EXISTS "Public read access for songs" ON storage.objects;
CREATE POLICY "Public read access for songs" ON storage.objects
  FOR SELECT USING (bucket_id = 'songs');

-- Public read for covers
DROP POLICY IF EXISTS "Public read access for covers" ON storage.objects;
CREATE POLICY "Public read access for covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');

-- Public read for avatars
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
CREATE POLICY "Public read access for avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated upload for songs
DROP POLICY IF EXISTS "Authenticated upload songs" ON storage.objects;
CREATE POLICY "Authenticated upload songs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'songs' AND auth.role() = 'authenticated');

-- Authenticated upload for covers
DROP POLICY IF EXISTS "Authenticated upload covers" ON storage.objects;
CREATE POLICY "Authenticated upload covers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- Authenticated upload for avatars
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
CREATE POLICY "Authenticated upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
