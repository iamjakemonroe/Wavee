-- Professional roles in music (user can have several). is_artist is kept in sync when "artist" is included.
alter table public.users
  add column if not exists music_roles text[] not null default '{}';

alter table public.users
  drop constraint if exists users_music_roles_check;

alter table public.users
  add constraint users_music_roles_check
  check (
    music_roles <@ array[
      'artist',
      'songwriter',
      'producer',
      'audio_engineer',
      'manager'
    ]::text[]
  );

comment on column public.users.music_roles is
  'Subset of: artist, songwriter, producer, audio_engineer, manager';

-- Profile avatars: create the `avatars` Storage bucket by running
-- db/migrations/0002_storage_buckets.sql (INSERT into storage.buckets + policies), or the equivalent
-- in Supabase Dashboard. Bucket id/name must match STORAGE_BUCKET_AVATARS (default: avatars).
