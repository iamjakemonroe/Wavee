-- Wavee relaunch (October 2026): database contract from docs/RELAUNCH.md.
--
-- Builds on the hand-applied apps/backend/db/migrations/0001-0013. Idempotent: every statement is
-- guarded (if not exists / create or replace / drop ... if exists / guarded do-blocks), so the file
-- can run on the live database, on a fresh one, and a second time without changing anything.
--
-- Nothing that may hold data is dropped (subscriptions, song_boosts, ai_song_insights and the old
-- leaderboard views stay). Old RPCs (get_home_feed*, search_*_ranked) stay but are no longer
-- executable by clients.
--
-- Conventions:
--   * Contract functions: security definer, set search_path = public, extensions, execute revoked
--     from public first, then granted as the contract says.
--   * Internal helpers are prefixed wavee_ and are not executable by clients, except
--     wavee_is_admin() / wavee_is_banned(), which row-level security policies call.
--   * "Client" means the anon / authenticated roles (PostgREST requests). Security definer
--     functions run as the owner (postgres) and the service role bypasses the client checks.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'extensions') then
    create schema extensions;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    create extension pg_trgm with schema extensions;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- users: new columns, data fixes, constraints
-- ─────────────────────────────────────────────────────────────────────────────

-- The old app used `username` as a free-form display name (0011 dropped its uniqueness). Keep that
-- text as the display name the first time the column appears, before usernames are normalised.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'display_name'
  ) then
    alter table public.users add column display_name text;
    update public.users set display_name = left(nullif(btrim(username), ''), 50);
  end if;
end $$;

alter table public.users add column if not exists is_admin boolean not null default false;
alter table public.users add column if not exists banned_at timestamptz;
alter table public.users add column if not exists followers_count integer not null default 0;
alter table public.users add column if not exists following_count integer not null default 0;
alter table public.users add column if not exists music_roles text[] not null default '{}';
-- Auth users without an email (phone / anonymous sign-ins) must still get a profile.
alter table public.users alter column email drop not null;

-- Username helpers (internal).
create or replace function public.wavee_username_base(p_text text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when char_length(x) >= 3 then x
    when x = '' then 'user'
    else rpad(x, 3, '0')
  end
  from (
    select left(
      btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9_.]+', '_', 'g'), '_.'),
      30
    ) as x
  ) s
$$;

create or replace function public.wavee_unique_username(p_text text, p_exclude uuid default null)
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_base text := public.wavee_username_base(p_text);
  v_try text := v_base;
  n integer := 1;
begin
  while exists (
    select 1 from public.users u
    where lower(u.username) = v_try and u.id is distinct from p_exclude
  ) loop
    n := n + 1;
    v_try := left(v_base, 30 - char_length(n::text)) || n::text;
  end loop;
  return v_try;
end $$;

-- Normalise every username to the contract format and make them unique case-insensitively.
-- Pass 1 keeps names that are already valid (oldest account wins a duplicate); pass 2 renames the
-- rest (invalid names are sanitised, duplicates get a numeric suffix: jake, jake2, jake3...).
-- On a second run every name is valid and unique, so nothing changes.
do $$
declare
  r record;
  v_base text;
  v_try text;
  n integer;
begin
  create temp table if not exists wavee_taken_usernames (name text primary key) on commit drop;
  create temp table if not exists wavee_rename_users (id uuid primary key, ord bigint) on commit drop;
  truncate wavee_taken_usernames, wavee_rename_users;

  for r in
    select u.id, u.username,
           row_number() over (order by u.created_at, u.id) as ord
    from public.users u
    order by u.created_at, u.id
  loop
    if r.username ~ '^[a-z0-9_.]{3,30}$'
       and not exists (select 1 from wavee_taken_usernames t where t.name = r.username) then
      insert into wavee_taken_usernames values (r.username);
    else
      insert into wavee_rename_users values (r.id, r.ord);
    end if;
  end loop;

  for r in
    select u.id, u.username
    from wavee_rename_users x
    join public.users u on u.id = x.id
    order by x.ord
  loop
    v_base := public.wavee_username_base(r.username);
    v_try := v_base;
    n := 1;
    while exists (select 1 from wavee_taken_usernames t where t.name = v_try) loop
      n := n + 1;
      v_try := left(v_base, 30 - char_length(n::text)) || n::text;
    end loop;
    insert into wavee_taken_usernames values (v_try);
    update public.users set username = v_try where id = r.id and username is distinct from v_try;
  end loop;
end $$;

update public.users set bio = left(bio, 300) where char_length(bio) > 300;
update public.users set display_name = left(display_name, 50) where char_length(display_name) > 50;

create unique index if not exists users_username_lower_key on public.users (lower(username));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.users'::regclass and conname = 'users_username_format') then
    alter table public.users add constraint users_username_format
      check (username ~ '^[a-z0-9_.]{3,30}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.users'::regclass and conname = 'users_display_name_length') then
    alter table public.users add constraint users_display_name_length
      check (char_length(display_name) <= 50) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.users'::regclass and conname = 'users_bio_length') then
    alter table public.users add constraint users_bio_length
      check (char_length(bio) <= 300) not valid;
  end if;
end $$;

alter table public.users validate constraint users_username_format;
alter table public.users validate constraint users_display_name_length;
alter table public.users validate constraint users_bio_length;

-- Lower-case / trim usernames and blank display names on every write.
create or replace function public.wavee_users_normalize()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.username := lower(btrim(new.username));
  new.display_name := nullif(btrim(new.display_name), '');
  return new;
end $$;

drop trigger if exists wavee_users_normalize on public.users;
create trigger wavee_users_normalize
  before insert or update of username, display_name on public.users
  for each row execute function public.wavee_users_normalize();

-- ─────────────────────────────────────────────────────────────────────────────
-- Role helpers used by policies and functions
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.wavee_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select u.is_admin and u.banned_at is null from public.users u where u.id = auth.uid()),
    false
  )
$$;

create or replace function public.wavee_is_banned()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select u.banned_at is not null from public.users u where u.id = auth.uid()),
    false
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles for auth users: signup trigger + backfill
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.wavee_create_profile(p_id uuid, p_email text, p_meta jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb := case when jsonb_typeof(p_meta) = 'object' then p_meta else '{}'::jsonb end;
  v_requested text := lower(btrim(coalesce(v_meta ->> 'username', '')));
  v_email text := nullif(btrim(p_email), '');
  v_seed text;
  v_username text;
  v_display text;
  v_avatar text;
  i integer;
begin
  if p_id is null or exists (select 1 from public.users where id = p_id) then
    return;
  end if;

  v_seed := coalesce(nullif(split_part(v_email, '@', 1), ''), nullif(v_requested, ''), 'user');
  v_display := left(nullif(btrim(coalesce(
    v_meta ->> 'display_name', v_meta ->> 'full_name', v_meta ->> 'name', ''
  )), ''), 50);
  v_avatar := left(nullif(btrim(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', '')), ''), 2000);

  if v_email is not null and exists (select 1 from public.users where email = v_email) then
    v_email := null;  -- users.email is unique; never block a signup over a stale row
  end if;

  for i in 1..5 loop
    if i = 1
       and v_requested ~ '^[a-z0-9_.]{3,30}$'
       and not exists (select 1 from public.users where lower(username) = v_requested) then
      v_username := v_requested;
    else
      v_username := public.wavee_unique_username(v_seed);
    end if;

    begin
      insert into public.users (id, username, display_name, email, avatar_url)
      values (p_id, v_username, coalesce(v_display, v_username), v_email, v_avatar)
      on conflict (id) do nothing;
      return;
    exception when unique_violation then
      -- A concurrent signup took the name (or the email); try again with a fresh suffix.
      if v_email is not null and exists (select 1 from public.users where email = v_email) then
        v_email := null;
      end if;
    end;
  end loop;

  raise exception 'Could not create a profile for user %', p_id;
end $$;

create or replace function public.wavee_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform public.wavee_create_profile(new.id, new.email, new.raw_user_meta_data);
  exception when others then
    -- Never block a signup; my_account() creates the profile on first use if this failed.
    raise warning 'wavee: profile for auth user % not created: %', new.id, sqlerrm;
  end;
  return new;
end $$;

-- Created once and never dropped: dropping a trigger on auth.users needs ownership of that table,
-- which the postgres role does not have on Supabase. The function above is replaced in place.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass and tgname = 'wavee_on_auth_user_created'
  ) then
    create trigger wavee_on_auth_user_created
      after insert on auth.users
      for each row execute function public.wavee_handle_new_auth_user();
  end if;
end $$;

-- Backfill profiles for auth users that have none.
do $$
declare
  r record;
begin
  for r in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.users u where u.id = au.id)
    order by au.created_at, au.id
  loop
    perform public.wavee_create_profile(r.id, r.email, r.raw_user_meta_data);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- songs
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.songs add column if not exists description text;
alter table public.songs add column if not exists video_url text;
alter table public.songs add column if not exists audio_key text;
alter table public.songs add column if not exists video_key text;
alter table public.songs add column if not exists cover_key text;
alter table public.songs add column if not exists duration_seconds integer;
alter table public.songs add column if not exists explicit boolean not null default false;
alter table public.songs add column if not exists status text not null default 'active';
alter table public.songs add column if not exists rights_confirmed_at timestamptz;
alter table public.songs add column if not exists updated_at timestamptz;
alter table public.songs alter column updated_at set default now();
update public.songs set updated_at = created_at where updated_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.songs'::regclass and conname = 'songs_status_check') then
    alter table public.songs add constraint songs_status_check
      check (status in ('active', 'hidden', 'removed'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.songs'::regclass and conname = 'songs_description_length') then
    alter table public.songs add constraint songs_description_length
      check (char_length(description) <= 1000);
  end if;
end $$;

-- Client writes: inserts start clean (active, zero counts, server timestamps, rights confirmed);
-- owners may only change title/genre/description/cover/video/explicit (and duration).
-- Admins (and the service role / security definer functions) are not restricted.
create or replace function public.wavee_songs_guard()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if v_client then
      if new.rights_confirmed_at is null then
        raise exception 'Please confirm you own the rights to this song before uploading it'
          using errcode = '23514';
      end if;
      new.rights_confirmed_at := now();
      new.status := 'active';
      new.plays_count := 0;
      new.likes_count := 0;
      new.created_at := now();
    end if;
    new.updated_at := now();
    return new;
  end if;

  if v_client and not public.wavee_is_admin() then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.status is distinct from old.status
       or new.plays_count is distinct from old.plays_count
       or new.likes_count is distinct from old.likes_count
       or new.created_at is distinct from old.created_at
       or new.rights_confirmed_at is distinct from old.rights_confirmed_at
       or new.audio_url is distinct from old.audio_url
       or new.audio_key is distinct from old.audio_key then
      raise exception 'Only the title, genre, description, cover, video and explicit flag of a song can be changed'
        using errcode = '42501';
    end if;
  end if;

  if (new.title, new.genre, new.description, new.cover_image_url, new.cover_key, new.video_url,
      new.video_key, new.explicit, new.duration_seconds, new.status, new.audio_url, new.audio_key)
     is distinct from
     (old.title, old.genre, old.description, old.cover_image_url, old.cover_key, old.video_url,
      old.video_key, old.explicit, old.duration_seconds, old.status, old.audio_url, old.audio_key) then
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists wavee_songs_guard on public.songs;
create trigger wavee_songs_guard
  before insert or update on public.songs
  for each row execute function public.wavee_songs_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- likes, follows: constraints and count triggers
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.likes'::regclass and i.indisunique
      and i.indnkeyatts = 2
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = 'public.likes'::regclass and attname = 'user_id')
      and i.indkey[1] = (select attnum from pg_attribute where attrelid = 'public.likes'::regclass and attname = 'song_id')
  ) then
    alter table public.likes add constraint likes_user_id_song_id_key unique (user_id, song_id);
  end if;

  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.follows'::regclass and i.indisunique
      and i.indnkeyatts = 2
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = 'public.follows'::regclass and attname = 'follower_id')
      and i.indkey[1] = (select attnum from pg_attribute where attrelid = 'public.follows'::regclass and attname = 'following_id')
  ) then
    alter table public.follows add constraint follows_follower_id_following_id_key unique (follower_id, following_id);
  end if;

  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.playlist_songs'::regclass and i.indisunique
      and i.indnkeyatts = 2
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = 'public.playlist_songs'::regclass and attname = 'playlist_id')
      and i.indkey[1] = (select attnum from pg_attribute where attrelid = 'public.playlist_songs'::regclass and attname = 'song_id')
  ) then
    alter table public.playlist_songs add constraint playlist_songs_playlist_id_song_id_key unique (playlist_id, song_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.follows'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%follower_id <> following_id%'
  ) then
    delete from public.follows where follower_id = following_id;
    alter table public.follows add constraint follows_no_self_follow check (follower_id <> following_id);
  end if;
end $$;

create or replace function public.update_song_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    update public.songs set likes_count = likes_count + 1 where id = new.song_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.songs set likes_count = greatest(likes_count - 1, 0) where id = old.song_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trigger_update_song_likes_count on public.likes;
create trigger trigger_update_song_likes_count
  after insert or delete on public.likes
  for each row execute function public.update_song_likes_count();

create or replace function public.wavee_update_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    update public.users set followers_count = followers_count + 1 where id = new.following_id;
    update public.users set following_count = following_count + 1 where id = new.follower_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.users set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.users set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists wavee_update_follow_counts on public.follows;
create trigger wavee_update_follow_counts
  after insert or delete on public.follows
  for each row execute function public.wavee_update_follow_counts();

-- Recompute counts from the rows (no-op when already right).
update public.songs s
set likes_count = c.n
from (
  select s2.id, (select count(*) from public.likes l where l.song_id = s2.id)::integer as n
  from public.songs s2
) c
where c.id = s.id and s.likes_count is distinct from c.n;

update public.users u
set followers_count = c.followers, following_count = c.following
from (
  select u2.id,
         (select count(*) from public.follows f where f.following_id = u2.id)::integer as followers,
         (select count(*) from public.follows f where f.follower_id = u2.id)::integer as following
  from public.users u2
) c
where c.id = u.id
  and (u.followers_count is distinct from c.followers or u.following_count is distinct from c.following);

-- ─────────────────────────────────────────────────────────────────────────────
-- playlists, playlist_songs
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.playlists add column if not exists description text;
alter table public.playlists add column if not exists cover_image_url text;
alter table public.playlists add column if not exists is_private boolean not null default false;

alter table public.playlist_songs add column if not exists position integer;

update public.playlist_songs ps
set position = x.rn - 1
from (
  select id, row_number() over (partition by playlist_id order by created_at, id) as rn
  from public.playlist_songs
) x
where x.id = ps.id and ps.position is null;

alter table public.playlist_songs alter column position set not null;

-- New rows go to the end unless a position is given.
create or replace function public.wavee_playlist_songs_position()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.position is null then
    select coalesce(max(ps.position) + 1, 0) into new.position
    from public.playlist_songs ps
    where ps.playlist_id = new.playlist_id;
  end if;
  return new;
end $$;

drop trigger if exists wavee_playlist_songs_position on public.playlist_songs;
create trigger wavee_playlist_songs_position
  before insert on public.playlist_songs
  for each row execute function public.wavee_playlist_songs_position();

-- ─────────────────────────────────────────────────────────────────────────────
-- plays
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.plays add column if not exists session_hash text;

-- A play counts towards plays_count only after 30 seconds or half the song (whichever is first).
create or replace function public.update_song_plays_count()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.duration_listened >= 30
     or (new.song_duration > 0 and new.duration_listened >= new.song_duration / 2.0) then
    update public.songs set plays_count = plays_count + 1 where id = new.song_id;
  end if;
  return new;
end $$;

drop trigger if exists trigger_update_song_plays_count on public.plays;
create trigger trigger_update_song_plays_count
  after insert on public.plays
  for each row execute function public.update_song_plays_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- reports, bug_reports, moderation log, rate limiting
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  contact_email text,
  claimant_name text,
  sworn boolean not null default false,
  status text not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  constraint reports_target_type_check check (target_type in ('song', 'user', 'playlist')),
  constraint reports_reason_check check (reason in (
    'copyright', 'hate', 'harassment', 'sexual', 'violence', 'spam', 'impersonation', 'other'
  )),
  constraint reports_status_check check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  constraint reports_details_length check (char_length(details) <= 2000),
  constraint reports_contact_email_length check (char_length(contact_email) <= 320),
  constraint reports_claimant_name_length check (char_length(claimant_name) <= 200),
  constraint reports_resolution_note_length check (char_length(resolution_note) <= 2000)
);

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  message text not null,
  page text,
  user_agent text,
  screenshot_url text,
  contact_email text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint bug_reports_message_length check (char_length(message) between 1 and 4000),
  constraint bug_reports_page_length check (char_length(page) <= 2000),
  constraint bug_reports_user_agent_length check (char_length(user_agent) <= 1000),
  constraint bug_reports_screenshot_url_length check (char_length(screenshot_url) <= 2000),
  constraint bug_reports_contact_email_length check (char_length(contact_email) <= 320),
  constraint bug_reports_status_length check (char_length(status) between 1 and 30)
);

-- Audit trail for moderate_song (the contract's p_note lands here).
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Rate-limit ledger (internal; no client access).
create table if not exists public.rate_events (
  id bigint generated always as identity primary key,
  action text not null,
  rate_key text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists songs_created_at_idx on public.songs (created_at desc);
create index if not exists songs_user_id_created_at_idx on public.songs (user_id, created_at desc);
create index if not exists likes_song_id_idx on public.likes (song_id);
create index if not exists likes_user_id_created_at_idx on public.likes (user_id, created_at desc);
create index if not exists follows_following_id_idx on public.follows (following_id);
create index if not exists playlists_user_id_idx on public.playlists (user_id);
create index if not exists playlist_songs_playlist_id_position_idx on public.playlist_songs (playlist_id, position);
create index if not exists playlist_songs_song_id_idx on public.playlist_songs (song_id);
create index if not exists plays_song_id_created_at_idx on public.plays (song_id, created_at);
create index if not exists plays_user_id_created_at_idx on public.plays (user_id, created_at);
-- covers the 7-day trending aggregation as an index-only scan
create index if not exists plays_created_at_song_id_idx on public.plays (created_at, song_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists song_boosts_song_id_idx on public.song_boosts (song_id);
create index if not exists song_boosts_user_id_idx on public.song_boosts (user_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);
create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists bug_reports_user_id_idx on public.bug_reports (user_id);
create index if not exists bug_reports_status_created_at_idx on public.bug_reports (status, created_at desc);
create index if not exists moderation_log_admin_id_idx on public.moderation_log (admin_id);
create index if not exists moderation_log_target_idx on public.moderation_log (target_type, target_id);
create index if not exists rate_events_lookup_idx on public.rate_events (action, rate_key, created_at);
create index if not exists rate_events_created_at_idx on public.rate_events (created_at);

-- Trigram indexes, using pg_trgm's operator class from whichever schema holds the extension.
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  execute format('create index if not exists songs_title_trgm_idx on public.songs using gin (title %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists users_username_trgm_idx on public.users using gin (username %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists users_display_name_trgm_idx on public.users using gin (display_name %I.gin_trgm_ops)', v_schema);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security and privileges
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.songs enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.plays enable row level security;
alter table public.reports enable row level security;
alter table public.bug_reports enable row level security;
alter table public.moderation_log enable row level security;
alter table public.rate_events enable row level security;

-- Drop every existing policy on these tables (the old permissive ones from 0001 by name, plus any
-- added by hand), then create exactly the contract's.
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'songs', 'likes', 'follows', 'playlists', 'playlist_songs',
                        'plays', 'reports', 'bug_reports', 'moderation_log', 'rate_events')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- users: profiles are public except email; banned users are hidden from everyone but themselves
-- and admins. Rows are created by the auth trigger; owners update a fixed set of columns.
create policy "users: read profiles" on public.users
  for select to anon, authenticated
  using (banned_at is null or id = (select auth.uid()) or (select public.wavee_is_admin()));
create policy "users: update own profile" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- songs
create policy "songs: read active, own or as admin" on public.songs
  for select to anon, authenticated
  using (
    (status = 'active' and exists (
      select 1 from public.users u where u.id = songs.user_id and u.banned_at is null
    ))
    or user_id = (select auth.uid())
    or (select public.wavee_is_admin())
  );
create policy "songs: owners insert" on public.songs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and rights_confirmed_at is not null
    and not (select public.wavee_is_banned())
  );
create policy "songs: owners and admins update" on public.songs
  for update to authenticated
  using (
    (user_id = (select auth.uid()) and not (select public.wavee_is_banned()))
    or (select public.wavee_is_admin())
  )
  with check (
    (user_id = (select auth.uid()) and not (select public.wavee_is_banned()))
    or (select public.wavee_is_admin())
  );
create policy "songs: owners delete" on public.songs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- likes: private to the user (song cards carry `liked` for the caller).
create policy "likes: read own" on public.likes
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "likes: insert own" on public.likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.songs s where s.id = song_id)
  );
create policy "likes: delete own" on public.likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- follows: the social graph is public.
create policy "follows: read" on public.follows
  for select to anon, authenticated
  using (true);
create policy "follows: insert own" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "follows: delete own" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

-- playlists: private playlists are visible only to their owner.
create policy "playlists: read public or own" on public.playlists
  for select to anon, authenticated
  using (not is_private or user_id = (select auth.uid()));
create policy "playlists: insert own" on public.playlists
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "playlists: update own" on public.playlists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "playlists: delete own" on public.playlists
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- playlist_songs follow their playlist's visibility; only the owner adds or removes.
create policy "playlist_songs: read with playlist" on public.playlist_songs
  for select to anon, authenticated
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_id and (not p.is_private or p.user_id = (select auth.uid()))
  ));
create policy "playlist_songs: owner inserts" on public.playlist_songs
  for insert to authenticated
  with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.songs s where s.id = song_id)
  );
create policy "playlist_songs: owner deletes" on public.playlist_songs
  for delete to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

-- plays, rate_events: no client policies at all (record_play writes plays).

-- reports / bug_reports: admins read and update; inserts go through submit_report / submit_bug_report.
create policy "reports: admins read" on public.reports
  for select to authenticated
  using ((select public.wavee_is_admin()));
create policy "reports: admins update" on public.reports
  for update to authenticated
  using ((select public.wavee_is_admin()))
  with check ((select public.wavee_is_admin()));
create policy "bug_reports: admins read" on public.bug_reports
  for select to authenticated
  using ((select public.wavee_is_admin()));
create policy "bug_reports: admins update" on public.bug_reports
  for update to authenticated
  using ((select public.wavee_is_admin()))
  with check ((select public.wavee_is_admin()));
create policy "moderation_log: admins read" on public.moderation_log
  for select to authenticated
  using ((select public.wavee_is_admin()));

-- Table and column privileges. Supabase grants ALL on new public tables to anon/authenticated by
-- default; reset to exactly what the policies above are for. (Revoking a table privilege also
-- revokes the matching column privileges, so this converges on every run.)
revoke all on public.users, public.songs, public.likes, public.follows, public.playlists,
  public.playlist_songs, public.plays, public.reports, public.bug_reports, public.moderation_log,
  public.rate_events
  from anon, authenticated;

grant select (id, username, display_name, avatar_url, bio, is_artist, music_roles, is_admin,
              banned_at, followers_count, following_count, created_at)
  on public.users to anon, authenticated;
grant update (username, display_name, avatar_url, bio, is_artist, music_roles)
  on public.users to authenticated;

grant select on public.songs to anon, authenticated;
grant insert, update, delete on public.songs to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant select on public.playlists to anon, authenticated;
grant insert, update, delete on public.playlists to authenticated;
grant select on public.playlist_songs to anon, authenticated;
grant insert, delete on public.playlist_songs to authenticated;
grant select, update on public.reports to authenticated;
grant select, update on public.bug_reports to authenticated;
grant select on public.moderation_log to authenticated;

grant all on public.users, public.songs, public.likes, public.follows, public.playlists,
  public.playlist_songs, public.plays, public.reports, public.bug_reports, public.moderation_log,
  public.rate_events
  to service_role;

do $$
begin
  if to_regclass('public.rate_events_id_seq') is not null then
    revoke all on sequence public.rate_events_id_seq from anon, authenticated;
  end if;
end $$;

-- Old views run with their owner's rights (they bypass RLS and would expose hidden songs and
-- banned users); old RPCs read them. Neither is used by the new app: keep, but close to clients.
do $$
declare
  v text;
begin
  foreach v in array array['song_metrics', 'song_scores', 'artist_leaderboard_global',
                           'artist_leaderboard_rising', 'artist_leaderboard_weekly_trending'] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on public.%I from anon, authenticated', v);
    end if;
  end loop;
  foreach v in array array['public.get_home_feed(uuid, integer, integer)',
                           'public.get_home_feed_public(integer, integer)',
                           'public.search_songs_ranked(text, integer)',
                           'public.search_users_ranked(text, integer)',
                           'public.update_song_likes_count()',
                           'public.update_song_plays_count()'] loop
    if to_regprocedure(v) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', v);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Result types
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regtype('public.song_card') is null then
    create type public.song_card as (
      id uuid,
      title text,
      genre text,
      description text,
      audio_url text,
      video_url text,
      cover_image_url text,
      duration_seconds integer,
      explicit boolean,
      plays_count integer,
      likes_count integer,
      created_at timestamptz,
      artist_id uuid,
      artist_username text,
      artist_display_name text,
      artist_avatar_url text,
      liked boolean
    );
  end if;
  if to_regtype('public.user_card') is null then
    create type public.user_card as (
      id uuid,
      username text,
      display_name text,
      avatar_url text,
      bio text,
      is_artist boolean,
      music_roles text[],
      followers_count integer
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Cards for the given song ids, in the given order. Callers decide visibility.
create or replace function public.wavee_song_cards(p_ids uuid[])
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select s.id, s.title, s.genre, s.description, s.audio_url, s.video_url, s.cover_image_url,
         s.duration_seconds, s.explicit, s.plays_count, s.likes_count, s.created_at,
         u.id, u.username, u.display_name, u.avatar_url,
         exists (select 1 from public.likes l where l.user_id = auth.uid() and l.song_id = s.id)
  from unnest(p_ids) with ordinality as t(song_id, ord)
  join public.songs s on s.id = t.song_id
  join public.users u on u.id = s.user_id
  order by t.ord
$$;

-- Escape LIKE wildcards in user input.
create or replace function public.wavee_like_escape(p_text text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Rate-limit key: the user, else a hash of the client IP from the request headers PostgREST
-- passes in, else a hash of the given fallback (e.g. contact email), else one shared bucket.
create or replace function public.wavee_rate_key(p_uid uuid, p_fallback text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_headers json;
  v_ip text;
begin
  if p_uid is not null then
    return 'u:' || p_uid::text;
  end if;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  if json_typeof(v_headers) = 'object' then
    v_ip := nullif(btrim(coalesce(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-real-ip',
      split_part(v_headers ->> 'x-forwarded-for', ',', 1)
    )), '');
  end if;
  if v_ip is not null then
    return 'ip:' || encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
  end if;
  if nullif(btrim(p_fallback), '') is not null then
    return 'k:' || encode(sha256(convert_to(lower(btrim(p_fallback)), 'UTF8')), 'hex');
  end if;
  return 'anon';
end $$;

create or replace function public.wavee_rate_limit(p_action text, p_key text, p_max integer,
                                                   p_window interval default interval '1 hour')
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_key, 0));
  if (
    select count(*) from public.rate_events e
    where e.action = p_action and e.rate_key = p_key and e.created_at > now() - p_window
  ) >= p_max then
    raise exception 'Too many requests. Please wait a while and try again.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.rate_events (action, rate_key) values (p_action, p_key);
  if random() < 0.01 then
    delete from public.rate_events where created_at < now() - interval '1 day';
  end if;
end $$;

create or replace function public.wavee_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.wavee_is_admin() then
    raise exception 'Only admins can do that (permission denied)' using errcode = '42501';
  end if;
end $$;

-- Locks the playlist and checks the caller owns it.
create or replace function public.wavee_require_playlist_owner(p_playlist uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select p.user_id into v_owner from public.playlists p where p.id = p_playlist for update;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Playlist not found' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.wavee_playlist_renumber(p_playlist uuid)
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
  update public.playlist_songs ps
  set position = x.rn - 1
  from (
    select id, row_number() over (order by position, created_at, id) as rn
    from public.playlist_songs
    where playlist_id = p_playlist
  ) x
  where x.id = ps.id and ps.position is distinct from x.rn - 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contract functions: account
-- ─────────────────────────────────────────────────────────────────────────────

-- The caller's own account, including email (null when signed out).
create or replace function public.my_account()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  if not exists (select 1 from public.users where id = v_uid) then
    perform public.wavee_create_profile(au.id, au.email, au.raw_user_meta_data)
    from auth.users au where au.id = v_uid;
  end if;
  select jsonb_build_object(
           'id', u.id,
           'username', u.username,
           'display_name', u.display_name,
           'email', coalesce(au.email, u.email),
           'avatar_url', u.avatar_url,
           'bio', u.bio,
           'is_artist', u.is_artist,
           'music_roles', u.music_roles,
           'is_admin', u.is_admin
         )
    into v_result
  from public.users u
  left join auth.users au on au.id = u.id
  where u.id = v_uid;
  return v_result;
end $$;

-- True when the name is valid (3-30 of a-z 0-9 _ .; compared lower-cased and trimmed) and not
-- used by anyone else (the caller's own current name counts as available).
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when x.v is null or x.v !~ '^[a-z0-9_.]{3,30}$' then false
    else not exists (
      select 1 from public.users u
      where lower(u.username) = x.v and u.id is distinct from auth.uid()
    )
  end
  from (select lower(btrim(p_username)) as v) x
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contract functions: listening
-- ─────────────────────────────────────────────────────────────────────────────

-- Personal feed. Every active song is scored once:
--   + genre affinity (share of the caller's plays in the song's genre, last 90 days)
--   + followed artist
--   + trending: ln(1 + plays in the last 7 days)
--   + freshness: exp(-age / 14 days)
--   + exploration: a hash of (caller, day, song) in [0, 1)
--   - songs the caller skipped at least twice in the last 30 days
-- Plays and time are read as of the start of the current hour, so the order does not move while
-- someone pages through it (a song uploaded since then can still shift it by one). The scored list
-- is walked greedily so no artist has more than 2 songs in a row while others remain, and
-- offset/limit cut that single order.
create or replace function public.get_feed(p_limit integer default 20, p_offset integer default 0)
returns setof public.song_card
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_need integer;
  v_anchor timestamptz := date_trunc('hour', now());
  v_seed text := coalesce(auth.uid()::text, 'anon') || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_ids uuid[] := '{}';
  v_n integer := 0;
  v_pending uuid[] := '{}';
  v_pending_artist uuid[] := '{}';
  v_pi integer := 1;
  v_last1 uuid;
  v_last2 uuid;
  r record;
begin
  v_need := v_offset + v_limit;

  for r in
    with genre_pref as (
      select s.genre, count(*)::float8 as n
      from public.plays p
      join public.songs s on s.id = p.song_id
      where v_uid is not null and p.user_id = v_uid
        and p.created_at >= v_anchor - interval '90 days' and p.created_at < v_anchor
      group by s.genre
    ),
    genre_weight as (
      select g.genre, g.n / nullif(max(g.n) over (), 0) as w from genre_pref g
    ),
    followed as (
      select f.following_id from public.follows f where v_uid is not null and f.follower_id = v_uid
    ),
    trend as (
      select p.song_id, count(*)::float8 as n
      from public.plays p
      where p.created_at >= v_anchor - interval '7 days' and p.created_at < v_anchor
      group by p.song_id
    ),
    skips as (
      select p.song_id, count(*) as n
      from public.plays p
      where v_uid is not null and p.user_id = v_uid and p.skipped
        and p.created_at >= v_anchor - interval '30 days' and p.created_at < v_anchor
      group by p.song_id
    )
    select s.id, s.user_id,
           ( 1.5 * coalesce(gw.w, 0)
           + case when fo.following_id is not null then 2.0 else 0 end
           + 0.8 * ln(1 + coalesce(t.n, 0))
           + 2.0 * exp(-greatest(extract(epoch from (v_anchor - s.created_at)), 0)::float8 / (14 * 86400))
           + 1.0 * (('x' || lpad(substr(md5(v_seed || ':' || s.id::text), 1, 12), 16, '0'))::bit(64)::bigint
                    / 281474976710656.0)
           - case when coalesce(sk.n, 0) >= 2 then 3.0 else 0 end
           )::float8 as score
    from public.songs s
    join public.users u on u.id = s.user_id
    left join genre_weight gw on gw.genre = s.genre
    left join followed fo on fo.following_id = s.user_id
    left join trend t on t.song_id = s.id
    left join skips sk on sk.song_id = s.id
    where s.status = 'active' and u.banned_at is null
    order by score desc, s.id
  loop
    if r.user_id = v_last1 and r.user_id = v_last2 then
      -- would be the third in a row: hold it until another artist has played
      v_pending := v_pending || r.id;
      v_pending_artist := v_pending_artist || r.user_id;
      continue;
    end if;

    v_ids := v_ids || r.id;
    v_n := v_n + 1;
    v_last2 := v_last1;
    v_last1 := r.user_id;
    exit when v_n >= v_need;

    -- held songs outrank everything still to come; place them as soon as they fit
    while v_pi <= coalesce(array_length(v_pending, 1), 0)
          and not coalesce(v_pending_artist[v_pi] = v_last1 and v_pending_artist[v_pi] = v_last2, false) loop
      v_ids := v_ids || v_pending[v_pi];
      v_n := v_n + 1;
      v_last2 := v_last1;
      v_last1 := v_pending_artist[v_pi];
      v_pi := v_pi + 1;
      exit when v_n >= v_need;
    end loop;
    exit when v_n >= v_need;
  end loop;

  -- only one artist left: the rest of their songs go last, in score order
  while v_n < v_need and v_pi <= coalesce(array_length(v_pending, 1), 0) loop
    v_ids := v_ids || v_pending[v_pi];
    v_n := v_n + 1;
    v_pi := v_pi + 1;
  end loop;

  return query
    select * from public.wavee_song_cards(v_ids[v_offset + 1 : v_need]);
end $$;

-- Most played in the last 7 days, then most liked.
create or replace function public.get_trending(p_limit integer default 20)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select s.id
    from public.songs s
    join public.users u on u.id = s.user_id
    left join (
      select p.song_id, count(*) as n
      from public.plays p
      where p.created_at >= now() - interval '7 days'
      group by p.song_id
    ) t on t.song_id = s.id
    where s.status = 'active' and u.banned_at is null
    order by coalesce(t.n, 0) desc, s.likes_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ))
$$;

create or replace function public.get_new_releases(p_limit integer default 20)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select s.id
    from public.songs s
    join public.users u on u.id = s.user_id
    where s.status = 'active' and u.banned_at is null
    order by s.created_at desc, s.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ))
$$;

-- Title, genre, artist username or display name: substring match or trigram similarity.
-- Candidates are collected per column (each can use its own trigram index), then ranked.
create or replace function public.search_songs(p_query text, p_limit integer default 30)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as q,
           lower(btrim(coalesce(p_query, ''))) as ql,
           '%' || public.wavee_like_escape(btrim(coalesce(p_query, ''))) || '%' as pat,
           public.wavee_like_escape(btrim(coalesce(p_query, ''))) || '%' as prefix
  ),
  artists as (
    select u.id
    from q, public.users u
    where q.q <> '' and u.banned_at is null
      and (u.username ilike q.pat or u.display_name ilike q.pat
           or u.username % q.q or u.display_name % q.q)
  ),
  candidates as (
    select s.id from q, public.songs s where q.q <> '' and (s.title ilike q.pat or s.title % q.q)
    union
    select s.id from q, public.songs s where q.q <> '' and s.genre ilike q.pat
    union
    select s.id from artists a join public.songs s on s.user_id = a.id
  )
  select * from public.wavee_song_cards(array(
    select s.id
    from q
    cross join candidates c
    join public.songs s on s.id = c.id
    join public.users u on u.id = s.user_id
    where s.status = 'active' and u.banned_at is null
    order by
      case
        when lower(s.title) = q.ql then 0
        when lower(u.username) = q.ql or lower(u.display_name) = q.ql then 1
        when s.title ilike q.prefix then 2
        when u.username ilike q.prefix or u.display_name ilike q.prefix then 3
        when lower(s.genre) = q.ql then 4
        else 5
      end,
      greatest(similarity(s.title, q.q), similarity(u.username, q.q),
               similarity(coalesce(u.display_name, ''), q.q)) desc,
      s.plays_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ))
$$;

create or replace function public.search_users(p_query text, p_limit integer default 20)
returns setof public.user_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as q,
           lower(btrim(coalesce(p_query, ''))) as ql,
           '%' || public.wavee_like_escape(btrim(coalesce(p_query, ''))) || '%' as pat,
           public.wavee_like_escape(btrim(coalesce(p_query, ''))) || '%' as prefix
  )
  select u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_artist, u.music_roles,
         u.followers_count
  from q
  cross join public.users u
  where q.q <> ''
    and u.banned_at is null
    and (u.username ilike q.pat or u.display_name ilike q.pat
         or u.username % q.q or u.display_name % q.q)
  order by
    case
      when lower(u.username) = q.ql or lower(u.display_name) = q.ql then 0
      when u.username ilike q.prefix or u.display_name ilike q.prefix then 1
      else 2
    end,
    greatest(similarity(u.username, q.q), similarity(coalesce(u.display_name, ''), q.q)) desc,
    u.followers_count desc, u.username
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

-- One song card as a JSON object, or null when it does not exist or is not visible to the caller.
create or replace function public.get_song(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select to_jsonb(c)
  from public.wavee_song_cards(array[p_id]) c
  where exists (
    select 1
    from public.songs s
    join public.users u on u.id = s.user_id
    where s.id = p_id
      and ((s.status = 'active' and u.banned_at is null)
           or s.user_id = auth.uid()
           or public.wavee_is_admin())
  )
$$;

-- A user's songs, newest first. Owners and admins also see hidden/removed songs.
create or replace function public.get_user_songs(p_user uuid, p_limit integer default 50,
                                                 p_offset integer default 0)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select s.id
    from public.songs s
    join public.users u on u.id = s.user_id
    where s.user_id = p_user
      and ((s.status = 'active' and u.banned_at is null)
           or p_user = auth.uid()
           or public.wavee_is_admin())
    order by s.created_at desc, s.id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ))
$$;

-- user_card plus following_count, songs_count and is_following, as a JSON object (null when the
-- user does not exist or is banned, unless it's the caller or an admin).
create or replace function public.get_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
           'id', u.id,
           'username', u.username,
           'display_name', u.display_name,
           'avatar_url', u.avatar_url,
           'bio', u.bio,
           'is_artist', u.is_artist,
           'music_roles', u.music_roles,
           'followers_count', u.followers_count,
           'following_count', u.following_count,
           'songs_count', (
             select count(*) from public.songs s
             where s.user_id = u.id
               and ((s.status = 'active' and u.banned_at is null)
                    or u.id = auth.uid() or public.wavee_is_admin())
           ),
           'is_following', exists (
             select 1 from public.follows f
             where f.follower_id = auth.uid() and f.following_id = u.id
           )
         )
  from public.users u
  where lower(u.username) = lower(btrim(p_username))
    and (u.banned_at is null or u.id = auth.uid() or public.wavee_is_admin())
$$;

create or replace function public.get_liked_songs(p_limit integer default 50, p_offset integer default 0)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select l.song_id
    from public.likes l
    join public.songs s on s.id = l.song_id
    join public.users u on u.id = s.user_id
    where l.user_id = auth.uid()
      and ((s.status = 'active' and u.banned_at is null) or s.user_id = auth.uid())
    order by l.created_at desc, l.song_id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 50), 1), 500)
  ))
$$;

-- Song cards plus their 0-based position, in playlist order. Empty when the playlist is private
-- and not the caller's. Songs that are hidden/removed (or by banned artists) are left out.
create or replace function public.get_playlist_songs(p_playlist uuid)
returns table (
  id uuid,
  title text,
  genre text,
  description text,
  audio_url text,
  video_url text,
  cover_image_url text,
  duration_seconds integer,
  explicit boolean,
  plays_count integer,
  likes_count integer,
  created_at timestamptz,
  artist_id uuid,
  artist_username text,
  artist_display_name text,
  artist_avatar_url text,
  liked boolean,
  "position" integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with items as (
    select ps.song_id, ps.position,
           row_number() over (order by ps.position, ps.created_at, ps.id) as ord
    from public.playlists p
    join public.playlist_songs ps on ps.playlist_id = p.id
    join public.songs s on s.id = ps.song_id
    join public.users u on u.id = s.user_id
    where p.id = p_playlist
      and (not p.is_private or p.user_id = auth.uid())
      and ((s.status = 'active' and u.banned_at is null)
           or s.user_id = auth.uid()
           or public.wavee_is_admin())
  )
  select c.id, c.title, c.genre, c.description, c.audio_url, c.video_url, c.cover_image_url,
         c.duration_seconds, c.explicit, c.plays_count, c.likes_count, c.created_at,
         c.artist_id, c.artist_username, c.artist_display_name, c.artist_avatar_url, c.liked,
         i.position
  from items i
  join public.wavee_song_cards(array(select song_id from items order by ord)) c on c.id = i.song_id
  order by i.ord
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contract functions: actions
-- ─────────────────────────────────────────────────────────────────────────────

-- Sets (p_liked) or, when p_liked is null, toggles the caller's like. Returns { liked, likes_count }.
create or replace function public.toggle_like(p_song uuid, p_liked boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_want boolean := p_liked;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_want is null then
    v_want := not exists (select 1 from public.likes where user_id = v_uid and song_id = p_song);
  end if;

  if v_want then
    if not exists (
      select 1 from public.songs s join public.users u on u.id = s.user_id
      where s.id = p_song and ((s.status = 'active' and u.banned_at is null) or s.user_id = v_uid)
    ) then
      raise exception 'Song not found' using errcode = 'P0002';
    end if;
    insert into public.likes (user_id, song_id) values (v_uid, p_song)
    on conflict (user_id, song_id) do nothing;
  else
    delete from public.likes where user_id = v_uid and song_id = p_song;
  end if;

  select s.likes_count into v_count from public.songs s where s.id = p_song;
  return jsonb_build_object(
    'liked', exists (select 1 from public.likes where user_id = v_uid and song_id = p_song),
    'likes_count', coalesce(v_count, 0)
  );
end $$;

-- Follows / unfollows (p_follow null toggles). Returns { following, followers_count } of p_user.
create or replace function public.set_follow(p_user uuid, p_follow boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_want boolean := p_follow;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_want is null then
    v_want := not exists (select 1 from public.follows where follower_id = v_uid and following_id = p_user);
  end if;

  if v_want then
    if p_user = v_uid then
      raise exception 'You can''t follow yourself' using errcode = '22023';
    end if;
    if not exists (select 1 from public.users where id = p_user and banned_at is null) then
      raise exception 'User not found' using errcode = 'P0002';
    end if;
    insert into public.follows (follower_id, following_id) values (v_uid, p_user)
    on conflict (follower_id, following_id) do nothing;
  else
    delete from public.follows where follower_id = v_uid and following_id = p_user;
  end if;

  select u.followers_count into v_count from public.users u where u.id = p_user;
  return jsonb_build_object(
    'following', exists (select 1 from public.follows where follower_id = v_uid and following_id = p_user),
    'followers_count', coalesce(v_count, 0)
  );
end $$;

-- Appends the song at the end (no-op if it's already there).
create or replace function public.add_to_playlist(p_playlist uuid, p_song uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_playlist_owner(p_playlist);
  if not exists (
    select 1 from public.songs s join public.users u on u.id = s.user_id
    where s.id = p_song and ((s.status = 'active' and u.banned_at is null) or s.user_id = auth.uid())
  ) then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;
  insert into public.playlist_songs (playlist_id, song_id, position)
  select p_playlist, p_song, coalesce(max(ps.position) + 1, 0)
  from public.playlist_songs ps where ps.playlist_id = p_playlist
  on conflict (playlist_id, song_id) do nothing;
end $$;

create or replace function public.remove_from_playlist(p_playlist uuid, p_song uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_playlist_owner(p_playlist);
  delete from public.playlist_songs where playlist_id = p_playlist and song_id = p_song;
  perform public.wavee_playlist_renumber(p_playlist);
end $$;

-- Moves the song to 0-based p_position (clamped to the list), shifting the songs in between.
create or replace function public.move_in_playlist(p_playlist uuid, p_song uuid, p_position integer)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_old integer;
  v_new integer;
  v_count integer;
begin
  perform public.wavee_require_playlist_owner(p_playlist);
  perform public.wavee_playlist_renumber(p_playlist);

  select ps.position into v_old
  from public.playlist_songs ps where ps.playlist_id = p_playlist and ps.song_id = p_song;
  if v_old is null then
    raise exception 'That song is not in this playlist' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.playlist_songs ps where ps.playlist_id = p_playlist;
  v_new := least(greatest(coalesce(p_position, 0), 0), v_count - 1);
  if v_new = v_old then
    return;
  end if;

  if v_new < v_old then
    update public.playlist_songs ps set position = ps.position + 1
    where ps.playlist_id = p_playlist and ps.position >= v_new and ps.position < v_old;
  else
    update public.playlist_songs ps set position = ps.position - 1
    where ps.playlist_id = p_playlist and ps.position > v_old and ps.position <= v_new;
  end if;
  update public.playlist_songs ps set position = v_new
  where ps.playlist_id = p_playlist and ps.song_id = p_song;
end $$;

-- Records one listen. p_listened is clamped to the song's duration (the stored duration, else
-- p_duration); a repeat by the same user (or, signed out, the same p_session) for the same song
-- within 30 seconds is ignored; the plays trigger counts it towards plays_count only after
-- 30 seconds or half the song. Unknown or hidden songs are ignored silently.
create or replace function public.record_play(p_song uuid, p_listened numeric, p_duration numeric,
                                              p_skipped boolean default false,
                                              p_session text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid;
  v_session text;
  v_stored integer;
  v_duration numeric;
  v_listened numeric;
begin
  select u.id into v_uid from public.users u where u.id = auth.uid();
  v_session := case
    when nullif(btrim(p_session), '') is null then null
    else encode(sha256(convert_to(left(btrim(p_session), 200), 'UTF8')), 'hex')
  end;

  select s.duration_seconds into v_stored
  from public.songs s join public.users u on u.id = s.user_id
  where s.id = p_song and s.status = 'active' and u.banned_at is null;
  if not found then
    return;
  end if;

  -- Serialise plays of this song by this listener so the 30-second check can't be raced.
  perform pg_advisory_xact_lock(hashtextextended(
    'play:' || p_song::text || ':' || coalesce(v_uid::text, v_session, ''), 0));

  if exists (
    select 1 from public.plays p
    where p.song_id = p_song
      and p.created_at > now() - interval '30 seconds'
      and ((v_uid is not null and p.user_id = v_uid)
           or (v_uid is null and v_session is not null and p.user_id is null and p.session_hash = v_session))
  ) then
    return;
  end if;

  v_duration := case
    when v_stored > 0 then v_stored::numeric
    when p_duration > 0 and p_duration < 86400 then p_duration  -- also rules out NaN / Infinity
    else null
  end;
  v_listened := case
    when p_listened is null or p_listened = 'NaN'::numeric or p_listened < 0 then 0
    else p_listened
  end;
  v_listened := least(v_listened, coalesce(v_duration, 86400));

  insert into public.plays (user_id, song_id, duration_listened, song_duration, skipped, session_hash)
  values (v_uid, p_song, v_listened, coalesce(v_duration, 0), coalesce(p_skipped, false), v_session);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contract functions: safety
-- ─────────────────────────────────────────────────────────────────────────────

-- Anyone may report. Copyright claims need the claimant's name, a contact email (the signed-in
-- reporter's account email is used when none is given) and the sworn statement.
-- Rate limited to 10 per hour per user, or per client IP (hashed) when signed out.
create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null,
  p_contact_email text default null,
  p_claimant_name text default null,
  p_sworn boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid;
  v_type text := lower(btrim(p_target_type));
  v_reason text := lower(btrim(p_reason));
  v_details text := nullif(btrim(p_details), '');
  v_email text := nullif(btrim(p_contact_email), '');
  v_name text := nullif(btrim(p_claimant_name), '');
  v_id uuid;
begin
  select u.id into v_uid from public.users u where u.id = auth.uid();

  if v_type is null or v_type not in ('song', 'user', 'playlist') then
    raise exception 'Unknown report target type' using errcode = '22023';
  end if;
  if v_reason is null or v_reason not in ('copyright', 'hate', 'harassment', 'sexual', 'violence',
                                          'spam', 'impersonation', 'other') then
    raise exception 'Unknown report reason' using errcode = '22023';
  end if;
  if p_target_id is null
     or (v_type = 'song' and not exists (select 1 from public.songs where id = p_target_id))
     or (v_type = 'user' and not exists (select 1 from public.users where id = p_target_id))
     or (v_type = 'playlist' and not exists (select 1 from public.playlists where id = p_target_id)) then
    raise exception 'The reported item was not found' using errcode = 'P0002';
  end if;
  if char_length(v_details) > 2000 then
    raise exception 'Details must be 2000 characters or fewer' using errcode = '22001';
  end if;
  if v_name is not null and char_length(v_name) > 200 then
    raise exception 'Name must be 200 characters or fewer' using errcode = '22001';
  end if;
  if v_email is not null and (char_length(v_email) > 320 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  if v_reason = 'copyright' then
    if v_email is null and v_uid is not null then
      select coalesce(au.email, u.email) into v_email
      from public.users u left join auth.users au on au.id = u.id
      where u.id = v_uid;
    end if;
    if v_name is null then
      raise exception 'Copyright claims need the name of the rights holder or their agent' using errcode = '22023';
    end if;
    if v_email is null then
      raise exception 'Copyright claims need a contact email' using errcode = '22023';
    end if;
    if not coalesce(p_sworn, false) then
      raise exception 'Copyright claims need the sworn statement' using errcode = '22023';
    end if;
  end if;

  perform public.wavee_rate_limit('report', public.wavee_rate_key(v_uid, v_email), 10);

  insert into public.reports (reporter_id, target_type, target_id, reason, details, contact_email,
                              claimant_name, sworn)
  values (v_uid, v_type, p_target_id, v_reason, v_details, v_email, v_name, coalesce(p_sworn, false))
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

-- Rate limited to 10 per hour per user, or per client IP (hashed) when signed out (falling back
-- to contact email + page when no IP header is present).
create or replace function public.submit_bug_report(
  p_message text,
  p_page text default null,
  p_user_agent text default null,
  p_screenshot_url text default null,
  p_contact_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid;
  v_message text := nullif(btrim(p_message), '');
  v_page text := left(nullif(btrim(p_page), ''), 2000);
  v_agent text := left(nullif(btrim(p_user_agent), ''), 1000);
  v_shot text := nullif(btrim(p_screenshot_url), '');
  v_email text := nullif(btrim(p_contact_email), '');
  v_id uuid;
begin
  select u.id into v_uid from public.users u where u.id = auth.uid();

  if v_message is null then
    raise exception 'Please describe the problem' using errcode = '22023';
  end if;
  if char_length(v_message) > 4000 then
    raise exception 'Message must be 4000 characters or fewer' using errcode = '22001';
  end if;
  if v_shot is not null and (char_length(v_shot) > 2000 or v_shot !~* '^https?://') then
    raise exception 'Screenshot must be an uploaded image URL' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 320 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  perform public.wavee_rate_limit(
    'bug_report',
    public.wavee_rate_key(v_uid, case when v_email is null then null else v_email || '|' || coalesce(v_page, '') end),
    10
  );

  insert into public.bug_reports (user_id, message, page, user_agent, screenshot_url, contact_email)
  values (v_uid, v_message, v_page, v_agent, v_shot, v_email)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contract functions: admin
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.moderate_song(p_song uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  if p_status is null or p_status not in ('active', 'hidden', 'removed') then
    raise exception 'Status must be active, hidden or removed' using errcode = '22023';
  end if;
  update public.songs set status = p_status where id = p_song;
  if not found then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'song', p_song, p_status, nullif(btrim(p_note), ''));
end $$;

create or replace function public.resolve_report(p_report uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  if p_status is null or p_status not in ('open', 'reviewing', 'actioned', 'dismissed') then
    raise exception 'Status must be open, reviewing, actioned or dismissed' using errcode = '22023';
  end if;
  if char_length(p_note) > 2000 then
    raise exception 'Note must be 2000 characters or fewer' using errcode = '22001';
  end if;
  update public.reports
  set status = p_status,
      resolution_note = coalesce(nullif(btrim(p_note), ''), resolution_note),
      resolved_at = case when p_status in ('actioned', 'dismissed') then now() end,
      resolved_by = case when p_status in ('actioned', 'dismissed') then auth.uid() end
  where id = p_report;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
end $$;

-- Newest first, at most 500. p_status null, '' or 'all' returns every status.
create or replace function public.admin_reports(p_status text default null)
returns setof public.reports
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  return query
    select r.* from public.reports r
    where coalesce(nullif(btrim(p_status), ''), 'all') = 'all' or r.status = btrim(p_status)
    order by r.created_at desc, r.id
    limit 500;
end $$;

create or replace function public.admin_bug_reports(p_status text default null)
returns setof public.bug_reports
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  return query
    select b.* from public.bug_reports b
    where coalesce(nullif(btrim(p_status), ''), 'all') = 'all' or b.status = btrim(p_status)
    order by b.created_at desc, b.id
    limit 500;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Function privileges
-- ─────────────────────────────────────────────────────────────────────────────

-- Internal: nobody but the owner (and service role) may call these.
revoke all on function public.wavee_username_base(text) from public, anon, authenticated;
revoke all on function public.wavee_unique_username(text, uuid) from public, anon, authenticated;
revoke all on function public.wavee_users_normalize() from public, anon, authenticated;
revoke all on function public.wavee_create_profile(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.wavee_handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.wavee_songs_guard() from public, anon, authenticated;
revoke all on function public.wavee_update_follow_counts() from public, anon, authenticated;
revoke all on function public.wavee_playlist_songs_position() from public, anon, authenticated;
revoke all on function public.wavee_song_cards(uuid[]) from public, anon, authenticated;
revoke all on function public.wavee_like_escape(text) from public, anon, authenticated;
revoke all on function public.wavee_rate_key(uuid, text) from public, anon, authenticated;
revoke all on function public.wavee_rate_limit(text, text, integer, interval) from public, anon, authenticated;
revoke all on function public.wavee_require_admin() from public, anon, authenticated;
revoke all on function public.wavee_require_playlist_owner(uuid) from public, anon, authenticated;
revoke all on function public.wavee_playlist_renumber(uuid) from public, anon, authenticated;

-- Called from row-level security policies, so clients need execute.
revoke all on function public.wavee_is_admin() from public, anon, authenticated;
revoke all on function public.wavee_is_banned() from public, anon, authenticated;
grant execute on function public.wavee_is_admin() to anon, authenticated;
grant execute on function public.wavee_is_banned() to anon, authenticated;

-- The songs guard is a security invoker trigger that checks wavee_is_admin() as the client.
-- (Triggers don't need execute on their own function at fire time.)

-- Contract: anon and authenticated.
revoke all on function public.my_account() from public, anon, authenticated;
revoke all on function public.username_available(text) from public, anon, authenticated;
revoke all on function public.get_feed(integer, integer) from public, anon, authenticated;
revoke all on function public.get_trending(integer) from public, anon, authenticated;
revoke all on function public.get_new_releases(integer) from public, anon, authenticated;
revoke all on function public.search_songs(text, integer) from public, anon, authenticated;
revoke all on function public.search_users(text, integer) from public, anon, authenticated;
revoke all on function public.get_song(uuid) from public, anon, authenticated;
revoke all on function public.get_user_songs(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.get_playlist_songs(uuid) from public, anon, authenticated;
revoke all on function public.record_play(uuid, numeric, numeric, boolean, text) from public, anon, authenticated;
revoke all on function public.submit_report(text, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.submit_bug_report(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.my_account() to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.get_feed(integer, integer) to anon, authenticated;
grant execute on function public.get_trending(integer) to anon, authenticated;
grant execute on function public.get_new_releases(integer) to anon, authenticated;
grant execute on function public.search_songs(text, integer) to anon, authenticated;
grant execute on function public.search_users(text, integer) to anon, authenticated;
grant execute on function public.get_song(uuid) to anon, authenticated;
grant execute on function public.get_user_songs(uuid, integer, integer) to anon, authenticated;
grant execute on function public.get_profile(text) to anon, authenticated;
grant execute on function public.get_playlist_songs(uuid) to anon, authenticated;
grant execute on function public.record_play(uuid, numeric, numeric, boolean, text) to anon, authenticated;
grant execute on function public.submit_report(text, uuid, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.submit_bug_report(text, text, text, text, text) to anon, authenticated;

-- Contract: authenticated only (admin functions check is_admin themselves).
revoke all on function public.get_liked_songs(integer, integer) from public, anon, authenticated;
revoke all on function public.toggle_like(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_follow(uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_to_playlist(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_from_playlist(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_in_playlist(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.moderate_song(uuid, text, text) from public, anon, authenticated;
revoke all on function public.resolve_report(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_reports(text) from public, anon, authenticated;
revoke all on function public.admin_bug_reports(text) from public, anon, authenticated;

grant execute on function public.get_liked_songs(integer, integer) to authenticated;
grant execute on function public.toggle_like(uuid, boolean) to authenticated;
grant execute on function public.set_follow(uuid, boolean) to authenticated;
grant execute on function public.add_to_playlist(uuid, uuid) to authenticated;
grant execute on function public.remove_from_playlist(uuid, uuid) to authenticated;
grant execute on function public.move_in_playlist(uuid, uuid, integer) to authenticated;
grant execute on function public.moderate_song(uuid, text, text) to authenticated;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
grant execute on function public.admin_reports(text) to authenticated;
grant execute on function public.admin_bug_reports(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Media links: only files uploaded through Wavee
-- ─────────────────────────────────────────────────────────────────────────────
-- The Worker checks every upload (type, size, real contents) and files it under
-- <kind>/<user id>/<uuid>.<ext> on media.wavee.kaivon.app. A client that writes a
-- link itself must point at its own file there, so a song's audio, cover or video
-- (or an avatar or playlist cover) can't be swapped for an outside URL. Only links
-- that change are checked, so legacy links already in the database stay as they are.

create or replace function public.wavee_media_ok(p_url text, p_kind text, p_owner uuid, p_key text default null)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select p_url is null or (
    p_owner is not null
    and p_url ~ ('^https://media\.wavee\.kaivon\.app/' || p_kind || '/' || p_owner::text
                 || '/[0-9a-f-]{36}\.[a-z0-9]{2,4}$')
    and (p_key is null or p_url = 'https://media.wavee.kaivon.app/' || p_key)
  );
$$;

create or replace function public.wavee_media_guard()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_new boolean := tg_op = 'INSERT';
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_table_name = 'songs' then
    v_owner := new.user_id;
    if (v_new or new.audio_url is distinct from old.audio_url or new.audio_key is distinct from old.audio_key)
       and (new.audio_url is null or not public.wavee_media_ok(new.audio_url, 'audio', v_owner, new.audio_key)) then
      raise exception 'Upload the song through Wavee' using errcode = '23514';
    end if;
    if (v_new or new.cover_image_url is distinct from old.cover_image_url or new.cover_key is distinct from old.cover_key)
       and not public.wavee_media_ok(new.cover_image_url, 'cover', v_owner, new.cover_key) then
      raise exception 'Upload the cover through Wavee' using errcode = '23514';
    end if;
    if (v_new or new.video_url is distinct from old.video_url or new.video_key is distinct from old.video_key)
       and not public.wavee_media_ok(new.video_url, 'video', v_owner, new.video_key) then
      raise exception 'Upload the video through Wavee' using errcode = '23514';
    end if;
  elsif tg_table_name = 'users' then
    if (v_new or new.avatar_url is distinct from old.avatar_url)
       and not public.wavee_media_ok(new.avatar_url, 'avatar', new.id) then
      raise exception 'Upload the photo through Wavee' using errcode = '23514';
    end if;
  elsif tg_table_name = 'playlists' then
    if (v_new or new.cover_image_url is distinct from old.cover_image_url)
       and not public.wavee_media_ok(new.cover_image_url, 'playlist', new.user_id) then
      raise exception 'Upload the cover through Wavee' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wavee_songs_media on public.songs;
create trigger wavee_songs_media
  before insert or update on public.songs
  for each row execute function public.wavee_media_guard();

drop trigger if exists wavee_users_media on public.users;
create trigger wavee_users_media
  before insert or update on public.users
  for each row execute function public.wavee_media_guard();

drop trigger if exists wavee_playlists_media on public.playlists;
create trigger wavee_playlists_media
  before insert or update on public.playlists
  for each row execute function public.wavee_media_guard();

revoke all on function public.wavee_media_guard() from public, anon, authenticated;

-- Tell PostgREST to pick up the new schema.
notify pgrst, 'reload schema';
