-- Optional track length in seconds (for UI). Populated when metadata is available.
alter table public.songs
  add column if not exists duration_seconds integer;

comment on column public.songs.duration_seconds is 'Length of audio in seconds; null if unknown';
