-- Playlist metadata for UI (cover, description, visibility)
alter table public.playlists
  add column if not exists description text;

alter table public.playlists
  add column if not exists cover_image_url text;

alter table public.playlists
  add column if not exists is_private boolean not null default false;

comment on column public.playlists.description is 'Optional user-facing description';
comment on column public.playlists.cover_image_url is 'Public URL for custom playlist art';
comment on column public.playlists.is_private is 'When true, hide from public discovery (reserved for future use)';
