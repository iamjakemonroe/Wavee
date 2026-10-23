-- Wavee growth (October 2026): artist and song links, a song's hook, weekly charts and tastemakers.
--
-- Builds on 20261023100000_wavee_relaunch.sql. Idempotent like it: every statement is guarded or
-- `create or replace`, so the file runs on a database with or without the relaunch already
-- applied (in that order), and a second time without changing anything.
--
-- - users.links / songs.links: where else to find an artist or a song (Spotify, Apple Music,
--   Audiomack, Boomplay...). Each platform only accepts https links on its own domains, so a link
--   labelled Spotify really goes to Spotify.
-- - songs.hook_start: the second the best part starts; the feed plays from there.
-- - likes.early: a like from someone who listened before the song had 50 counted plays. Early
--   likes on songs that go on to 250+ plays are a listener's "hits": the tastemaker leaderboard.
-- - get_chart: Top, Rising and Fresh, from the last seven days of counted plays. Plays by the
--   artist don't count, and nothing paid ever will.
-- - users.verified_at: a badge moderators give real artists (set_verified), so fans can tell a
--   famous artist's page from someone pretending to be them.

-- ─────────────────────────────────────────────────────────────────────────────
-- Links
-- ─────────────────────────────────────────────────────────────────────────────

-- The domains (as a regex alternation) a platform's links may use, or null if the platform isn't
-- allowed in that place ('artist' for profiles, 'song' for songs).
create or replace function public.wavee_link_domains(p_platform text, p_scope text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when p_platform = 'spotify'     then 'open\.spotify\.com|spotify\.link'
    when p_platform = 'apple_music' then 'music\.apple\.com'
    when p_platform = 'audiomack'   then 'audiomack\.com'
    when p_platform = 'boomplay'    then 'boomplay\.com|boomplaymusic\.com'
    when p_platform = 'youtube'     then 'youtube\.com|youtu\.be'
    when p_platform = 'soundcloud'  then 'soundcloud\.com|snd\.sc'
    when p_platform = 'deezer'      then 'deezer\.com|deezer\.page\.link'
    when p_platform = 'tidal'       then 'tidal\.com'
    when p_platform = 'bandcamp'    and p_scope = 'artist' then 'bandcamp\.com'
    when p_platform = 'tiktok'      and p_scope = 'artist' then 'tiktok\.com'
    when p_platform = 'instagram'   and p_scope = 'artist' then 'instagram\.com'
    when p_platform = 'x'           and p_scope = 'artist' then 'x\.com|twitter\.com'
    when p_platform = 'website'     and p_scope = 'artist' then '[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'
    -- Pre-save and smart links for a release: DistroKid's HyperFollow and the common services.
    when p_platform = 'presave'     and p_scope = 'song' then
      'distrokid\.com|lnk\.to|ffm\.to|smarturl\.it|hypeddit\.com|found\.ee|show\.co|orcd\.co|push\.fm|linkfire\.com'
    else null
  end
$$;

-- True if [p_links] is an object of platform -> https link, every platform allowed in [p_scope]
-- and every link on that platform's domains.
create or replace function public.wavee_links_ok(p_links jsonb, p_scope text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select p_links is null or (
    jsonb_typeof(p_links) = 'object'
    and (select count(*) from jsonb_object_keys(p_links)) <= 14
    and not exists (
      select 1
      from jsonb_each(p_links) e
      where public.wavee_link_domains(e.key, p_scope) is null
         or jsonb_typeof(e.value) <> 'string'
         or char_length(e.value #>> '{}') > 300
         or (e.value #>> '{}') !~* ('^https://([a-z0-9-]+\.)*(' || public.wavee_link_domains(e.key, p_scope)
                                    || ')(:443)?([/?#][^\s"''<>\\]*)?$')
    )
  )
$$;

alter table public.users add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.songs add column if not exists links jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.users'::regclass and conname = 'users_links_check') then
    alter table public.users add constraint users_links_check check (public.wavee_links_ok(links, 'artist'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.songs'::regclass and conname = 'songs_links_check') then
    alter table public.songs add constraint songs_links_check check (public.wavee_links_ok(links, 'song'));
  end if;
end $$;

-- Owners edit their own profile links (songs are already owner-updatable as a whole table, with
-- the relaunch's guard keeping status, counts and audio out of reach).
grant update (links) on public.users to authenticated;
grant select (links) on public.users to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- The hook
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.songs add column if not exists hook_start integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.songs'::regclass and conname = 'songs_hook_start_check') then
    alter table public.songs add constraint songs_hook_start_check
      check (hook_start is null or (hook_start >= 0 and hook_start <= 3600
             and (duration_seconds is null or hook_start < duration_seconds)));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verified artists
-- ─────────────────────────────────────────────────────────────────────────────

-- Set only by moderators (through set_verified) or the service role: clients can't write it.
alter table public.users add column if not exists verified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Song cards: the hook (the feed starts there) and the artist's badge
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_rel oid := (select typrelid from pg_type where oid = 'public.song_card'::regtype);
begin
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'hook_start' and not attisdropped) then
    alter type public.song_card add attribute hook_start integer;
  end if;
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'artist_verified' and not attisdropped) then
    alter type public.song_card add attribute artist_verified boolean;
  end if;
end $$;

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
         exists (select 1 from public.likes l where l.user_id = auth.uid() and l.song_id = s.id),
         s.hook_start,
         u.verified_at is not null
  from unnest(p_ids) with ordinality as t(song_id, ord)
  join public.songs s on s.id = t.song_id
  join public.users u on u.id = s.user_id
  order by t.ord
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Early likes (tastemakers)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.likes add column if not exists early boolean not null default false;

-- A like is early when the listener heard the song properly (a counted play: 30 seconds or half
-- of it) while it had fewer than 50 counted plays, and it isn't their own song. Listening first
-- is what keeps "like everything new" from being a strategy.
create or replace function public.wavee_likes_early()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  select s.plays_count < 50
         and s.user_id <> new.user_id
         and exists (
           select 1 from public.plays p
           where p.song_id = new.song_id and p.user_id = new.user_id
             and (p.duration_listened >= 30
                  or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
         )
    into new.early
  from public.songs s
  where s.id = new.song_id;
  new.early := coalesce(new.early, false);
  return new;
end $$;

drop trigger if exists wavee_likes_early on public.likes;
create trigger wavee_likes_early
  before insert on public.likes
  for each row execute function public.wavee_likes_early();

create index if not exists likes_early_user_idx on public.likes (user_id) where early;

-- ─────────────────────────────────────────────────────────────────────────────
-- Charts
-- ─────────────────────────────────────────────────────────────────────────────

-- Genres were free text before the relaunch ("hip hop", "Hip-Hop"): compare them loosely.
create or replace function public.wavee_genre_key(p_genre text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(lower(coalesce(p_genre, '')), '[^a-z0-9]', '', 'g')
$$;

-- Counted plays per song in two windows: this week (the 7 days before the start of the current
-- hour, so the chart holds still within the hour) and the week before it. The artist's own
-- plays don't count.
create or replace function public.wavee_chart_plays()
returns table (song_id uuid, this_week bigint, last_week bigint)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with bounds as (select date_trunc('hour', now()) as t)
  select p.song_id,
         count(*) filter (where p.created_at >= b.t - interval '7 days') as this_week,
         count(*) filter (where p.created_at < b.t - interval '7 days') as last_week
  from public.plays p
  cross join bounds b
  join public.songs s on s.id = p.song_id
  where p.created_at >= b.t - interval '14 days'
    and p.created_at < b.t
    and (p.user_id is null or p.user_id <> s.user_id)
    and (p.duration_listened >= 30 or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
  group by p.song_id
$$;

-- A chart: 'top' (most counted plays this week), 'rising' (biggest gain on last week, at least
-- 3 plays this week) or 'fresh' (released in the last 14 days, by plays this week); anything else
-- reads as 'top'. Optionally one genre. Each entry: rank, plays this week, last week's position on
-- the top chart (null if it had no plays then; top chart only) and the song card.
create or replace function public.get_chart(p_chart text default 'top', p_genre text default null,
                                            p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with params as (
    select case when lower(btrim(coalesce(p_chart, ''))) in ('rising', 'fresh')
                then lower(btrim(p_chart)) else 'top' end as chart,
           nullif(public.wavee_genre_key(p_genre), '') as genre,
           least(greatest(coalesce(p_limit, 50), 1), 100) as lim,
           date_trunc('hour', now()) as t
  ),
  counted as (
    select c.song_id, c.this_week, c.last_week, s.likes_count, s.created_at
    from public.wavee_chart_plays() c
    join public.songs s on s.id = c.song_id
    join public.users u on u.id = s.user_id
    cross join params pr
    where s.status = 'active' and u.banned_at is null
      and (pr.genre is null or public.wavee_genre_key(s.genre) = pr.genre)
  ),
  ranked as (
    select c.song_id, c.this_week,
           case when c.last_week > 0 then rank() over (order by c.last_week desc) end as last_rank,
           case pr.chart
             when 'rising' then row_number() over (order by c.this_week - c.last_week desc, c.this_week desc,
                                                            c.created_at desc, c.song_id)
             else row_number() over (order by c.this_week desc, c.likes_count desc, c.created_at desc, c.song_id)
           end as ord,
           case pr.chart
             when 'rising' then c.this_week >= 3 and c.this_week > c.last_week
             when 'fresh' then c.this_week > 0 and c.created_at >= pr.t - interval '14 days'
             else c.this_week > 0
           end as eligible,
           pr.chart
    from counted c
    cross join params pr
  ),
  picked as (
    select r.song_id, r.this_week,
           case when r.chart = 'top' then r.last_rank end as last_rank,
           row_number() over (order by r.ord) as pos
    from ranked r
    where r.eligible
    order by r.ord
    limit (select lim from params)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', p.pos,
           'plays', p.this_week,
           'last_rank', p.last_rank,
           'song', to_jsonb(c)
         ) order by p.pos), '[]'::jsonb)
  from picked p
  cross join lateral public.wavee_song_cards(array[p.song_id]) c
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tastemakers
-- ─────────────────────────────────────────────────────────────────────────────

-- A listener's early likes, and how many of those songs became hits (250+ counted plays).
create or replace function public.wavee_ear(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'early_likes', count(*),
    'hits', count(*) filter (where s.plays_count >= 250)
  )
  from public.likes l
  join public.songs s on s.id = l.song_id
  where l.user_id = p_user and l.early and s.status = 'active'
$$;

-- The leaderboard: listeners with the most hits, then the most early likes.
create or replace function public.get_tastemakers(p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rank,
           'hits', t.hits,
           'early_likes', t.early_likes,
           'user', jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                                      'avatar_url', u.avatar_url)
         ) order by t.rank), '[]'::jsonb)
  from (
    select l.user_id,
           count(*) as early_likes,
           count(*) filter (where s.plays_count >= 250) as hits,
           row_number() over (order by count(*) filter (where s.plays_count >= 250) desc, count(*) desc,
                                       min(l.created_at), l.user_id) as rank
    from public.likes l
    join public.songs s on s.id = l.song_id
    join public.users a on a.id = s.user_id
    where l.early and s.status = 'active' and a.banned_at is null
    group by l.user_id
  ) t
  join public.users u on u.id = t.user_id
  where u.banned_at is null
    and t.rank <= least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles and songs carry their links (and a listener's ear)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_song(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select to_jsonb(c) || jsonb_build_object('links', s.links)
  from public.wavee_song_cards(array[p_id]) c
  join public.songs s on s.id = c.id
  join public.users u on u.id = s.user_id
  where (s.status = 'active' and u.banned_at is null)
     or s.user_id = auth.uid()
     or public.wavee_is_admin()
$$;

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
           ),
           'links', u.links,
           'ear', public.wavee_ear(u.id),
           'verified', u.verified_at is not null
         )
  from public.users u
  where lower(u.username) = lower(btrim(p_username))
    and (u.banned_at is null or u.id = auth.uid() or public.wavee_is_admin())
$$;

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
           'is_admin', u.is_admin,
           'links', u.links
         )
    into v_result
  from public.users u
  left join auth.users au on au.id = u.id
  where u.id = v_uid;
  return v_result;
end $$;

-- Moderators verify (or unverify) an artist; each change is logged.
create or replace function public.set_verified(p_user uuid, p_verified boolean, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_verified boolean;
begin
  perform public.wavee_require_admin();
  update public.users
     set verified_at = case when p_verified then coalesce(verified_at, now()) end
   where id = p_user
  returning verified_at is not null into v_verified;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'user', p_user, case when v_verified then 'verified' else 'unverified' end,
          nullif(btrim(p_note), ''));
  return jsonb_build_object('verified', v_verified);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.wavee_likes_early() from public, anon, authenticated;
revoke all on function public.wavee_genre_key(text) from public, anon, authenticated;
revoke all on function public.wavee_chart_plays() from public, anon, authenticated;
revoke all on function public.wavee_ear(uuid) from public, anon, authenticated;
revoke all on function public.wavee_song_cards(uuid[]) from public, anon, authenticated;

-- wavee_link_domains and wavee_links_ok keep their default execute for everyone: check
-- constraints call them as whichever role writes the row.

revoke all on function public.set_verified(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.set_verified(uuid, boolean, text) to authenticated;

revoke all on function public.get_chart(text, text, integer) from public, anon, authenticated;
revoke all on function public.get_tastemakers(integer) from public, anon, authenticated;
revoke all on function public.get_song(uuid) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.my_account() from public, anon, authenticated;
grant execute on function public.get_chart(text, text, integer) to anon, authenticated;
grant execute on function public.get_tastemakers(integer) to anon, authenticated;
grant execute on function public.get_song(uuid) to anon, authenticated;
grant execute on function public.get_profile(text) to anon, authenticated;
grant execute on function public.my_account() to anon, authenticated;

notify pgrst, 'reload schema';
