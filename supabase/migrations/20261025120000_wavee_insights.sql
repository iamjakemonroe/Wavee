-- Stats pages: how an artist's music is growing (artist_insights), and a
-- listener's own listening (listener_insights).
--
-- Plays now remember where they started (source: the feed, a profile, a shared
-- link…) and the listener's country (Cloudflare's, as a two-letter code; never
-- a city or an address). Both are optional: older plays have neither.
--
-- What counts, everywhere:
--   * a stream is a play of 30 seconds, or half of a shorter song (wavee_heard);
--   * listeners are distinct people (account, or browser session) with a stream;
--   * the artist's own plays never count.
-- Countries are only shown with 5 or more listeners each; smaller ones are
-- added up as "other", so nobody can be picked out.
--
-- Free: the last 7 or 28 days. Artist Pro (and founding artists while
-- wavee_growth.founding_pro_insights is on): 90 days and 12 months, countries,
-- new and returning listeners, superfans, and how much of a song people hear.
--
-- The numbers come straight from plays, using the (song_id, created_at) and
-- (user_id, created_at) indexes. That's quick for years at Wavee's size; when
-- plays reach the tens of millions, add daily rollups (with a HyperLogLog
-- sketch per day for listeners) filled by pg_cron and read those instead.

alter table public.wavee_growth add column if not exists founding_pro_insights boolean not null default true;

alter table public.plays add column if not exists source text check (
  source in ('feed', 'new', 'boost', 'home', 'search', 'profile', 'playlist', 'charts', 'picks', 'library', 'song', 'link', 'other'));
alter table public.plays add column if not exists country text check (country ~ '^[A-Z]{2}$');

-- Recording a play, now with where it started and the country. Cloudflare's
-- country header wins over the one the app sends.
drop function if exists public.record_play(uuid, numeric, numeric, boolean, text);
create or replace function public.record_play(p_song uuid, p_listened numeric, p_duration numeric,
                                              p_skipped boolean default false,
                                              p_session text default null,
                                              p_source text default null,
                                              p_country text default null)
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
  v_source text := lower(btrim(p_source));
  v_country text;
  v_headers json;
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

  if v_source is null or v_source not in ('feed', 'new', 'boost', 'home', 'search', 'profile', 'playlist',
                                           'charts', 'picks', 'library', 'song', 'link', 'other') then
    v_source := null;
  end if;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_country := upper(btrim(coalesce(
    case when json_typeof(v_headers) = 'object' then nullif(v_headers ->> 'cf-ipcountry', '') end,
    p_country)));
  if v_country is null or v_country !~ '^[A-Z]{2}$' or v_country in ('XX', 'T1') then
    v_country := null;
  end if;

  insert into public.plays (user_id, song_id, duration_listened, song_duration, skipped, session_hash, source, country)
  values (v_uid, p_song, v_listened, coalesce(v_duration, 0), coalesce(p_skipped, false), v_session,
          v_source, v_country);
end $$;

-- A time zone people's days are counted in (theirs, if it's a real one).
create or replace function public._wavee_tz(p_tz text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce((select name from pg_timezone_names where name = p_tz limit 1), 'UTC');
$$;

-- Whether [p_user] sees the full stats: Artist Pro, the team, or a founding
-- artist while that perk is on.
create or replace function public._wavee_full_stats(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._wavee_pro_until(p_user) is not null
      or public.wavee_is_admin()
      or (exists (select 1 from public.founding_members f where f.user_id = p_user and f.role = 'artist')
          and coalesce((select founding_pro_insights from public.wavee_growth where id), false));
$$;

-- An artist's stats over the last [p_days] days (today included), counted in
-- [p_tz] days, for all their songs or one (p_song). The team can look at any
-- artist's (p_user).
create or replace function public.artist_insights(p_days integer default 28, p_song uuid default null,
                                                  p_tz text default 'UTC', p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_user uuid := coalesce(p_user, auth.uid());
  v_tz text := public._wavee_tz(p_tz);
  v_full boolean;
  v_days int;
  v_unit text;
  v_from timestamptz;
  v_before timestamptz;
  v_all uuid[];
  v_songs uuid[];
  v_out jsonb;
  v_more jsonb;
begin
  if v_me is null then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  if v_user <> v_me and not public.wavee_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_full := public._wavee_full_stats(v_user);
  v_days := case when p_days in (7, 28) then p_days when p_days in (90, 365) and v_full then p_days else 28 end;
  v_unit := case when v_days > 90 then 'week' else 'day' end;
  v_from := (date_trunc('day', now() at time zone v_tz) - make_interval(days => v_days - 1)) at time zone v_tz;
  v_before := v_from - make_interval(days => v_days);

  select coalesce(array_agg(s.id), '{}') into v_all
    from public.songs s where s.user_id = v_user and s.status <> 'removed';
  if p_song is not null and not p_song = any(v_all) then
    raise exception 'not your song' using errcode = '42501';
  end if;
  v_songs := case when p_song is null then v_all else array[p_song] end;

  with p as (
    select p.song_id, p.created_at, p.source, p.duration_listened, p.song_duration,
           public.wavee_heard(p.duration_listened, p.song_duration) as heard,
           coalesce(p.user_id::text, p.session_hash) as who,
           p.created_at >= v_from as now_
      from public.plays p
     where p.song_id = any(v_songs) and p.created_at >= v_before
       and (p.user_id is null or p.user_id <> v_user)
  ),
  buckets as (
    select b as at,
           greatest(b at time zone v_tz, v_from) as a,
           (b + ('1 ' || v_unit)::interval) at time zone v_tz as z
      from generate_series(date_trunc(v_unit, v_from at time zone v_tz),
                           date_trunc(v_unit, now() at time zone v_tz),
                           ('1 ' || v_unit)::interval) as b
  )
  select jsonb_build_object(
    'days', v_days,
    'unit', v_unit,
    'full', v_full,
    'from', v_from,
    'totals', jsonb_build_object(
      'plays', (select count(*) from p where now_),
      'streams', (select count(*) from p where now_ and heard),
      'listeners', (select count(distinct who) from p where now_ and heard),
      'avg_heard', (select round(avg(least(duration_listened / nullif(song_duration, 0), 1)) * 100) from p where now_),
      'followers', case when p_song is null then
                     (select count(*) from public.follows f where f.following_id = v_user and f.created_at >= v_from) end,
      'likes', (select count(*) from public.likes l where l.song_id = any(v_songs) and l.user_id <> v_user
                                                     and l.created_at >= v_from),
      'playlist_adds', (select count(*) from public.playlist_songs ps join public.playlists pl on pl.id = ps.playlist_id
                         where ps.song_id = any(v_songs) and pl.user_id <> v_user and ps.created_at >= v_from),
      'feedback', (select count(*) from public.song_feedback fb where fb.song_id = any(v_songs) and fb.created_at >= v_from)),
    'prev', jsonb_build_object(
      'plays', (select count(*) from p where not now_),
      'streams', (select count(*) from p where not now_ and heard),
      'listeners', (select count(distinct who) from p where not now_ and heard),
      'avg_heard', (select round(avg(least(duration_listened / nullif(song_duration, 0), 1)) * 100) from p where not now_),
      'followers', case when p_song is null then
                     (select count(*) from public.follows f where f.following_id = v_user
                         and f.created_at >= v_before and f.created_at < v_from) end,
      'likes', (select count(*) from public.likes l where l.song_id = any(v_songs) and l.user_id <> v_user
                                                     and l.created_at >= v_before and l.created_at < v_from),
      'playlist_adds', (select count(*) from public.playlist_songs ps join public.playlists pl on pl.id = ps.playlist_id
                         where ps.song_id = any(v_songs) and pl.user_id <> v_user
                           and ps.created_at >= v_before and ps.created_at < v_from),
      'feedback', (select count(*) from public.song_feedback fb where fb.song_id = any(v_songs)
                     and fb.created_at >= v_before and fb.created_at < v_from)),
    'series', (select jsonb_agg(jsonb_build_object(
                 'date', b.at::date,
                 'streams', (select count(*) from p where heard and p.created_at >= b.a and p.created_at < b.z),
                 'listeners', (select count(distinct who) from p where heard and p.created_at >= b.a and p.created_at < b.z),
                 'followers', case when p_song is null then
                                (select count(*) from public.follows f where f.following_id = v_user
                                    and f.created_at >= b.a and f.created_at < b.z) end)
                 order by b.at) from buckets b),
    'top', (select coalesce(jsonb_agg(t.j order by t.streams desc, t.created_at desc), '[]'::jsonb) from (
              select s.created_at,
                     count(p.*) filter (where p.now_ and p.heard) as streams,
                     jsonb_build_object(
                       'id', s.id, 'title', s.title, 'cover_image_url', s.cover_image_url,
                       'streams', count(p.*) filter (where p.now_ and p.heard),
                       'streams_before', count(p.*) filter (where not p.now_ and p.heard),
                       'listeners', count(distinct p.who) filter (where p.now_ and p.heard),
                       'avg_heard', round(avg(least(p.duration_listened / nullif(p.song_duration, 0), 1))
                                            filter (where p.now_) * 100),
                       'likes', (select count(*) from public.likes l where l.song_id = s.id and l.user_id <> v_user
                                                                       and l.created_at >= v_from)) as j
                from public.songs s
                left join p on p.song_id = s.id
               where s.id = any(v_songs)
               group by s.id
               order by streams desc, s.created_at desc
               limit 10) t),
    'sources', (select coalesce(jsonb_object_agg(x.src, x.n), '{}'::jsonb) from (
                  select coalesce(p.source, 'other') as src, count(*) as n
                    from p where p.now_ and p.heard group by 1) x),
    'all_time', (select jsonb_build_object('streams', count(*), 'listeners', count(distinct coalesce(ap.user_id::text, ap.session_hash)))
                   from public.plays ap
                  where ap.song_id = any(v_all) and (ap.user_id is null or ap.user_id <> v_user)
                    and public.wavee_heard(ap.duration_listened, ap.song_duration))
                 || jsonb_build_object('followers', (select followers_count from public.users where id = v_user)),
    'songs', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title) order by s.created_at desc), '[]'::jsonb)
                from public.songs s where s.id = any(v_all))
  ) into v_out;

  if not v_full then
    return v_out || jsonb_build_object('more', null);
  end if;

  with heard as (
    select coalesce(p.user_id::text, p.session_hash) as who, p.created_at, p.country,
           p.duration_listened, p.song_duration
      from public.plays p
     where p.song_id = any(v_songs) and (p.user_id is null or p.user_id <> v_user)
       and public.wavee_heard(p.duration_listened, p.song_duration)
  ),
  now_ as (
    select who, count(*) as streams, min(country) filter (where country is not null) as country
      from heard where created_at >= v_from and who is not null group by who
  ),
  firsts as (
    select who, min(created_at) as first_at from heard where who is not null group by who
  ),
  countries as (
    select country, count(*) as n from now_ where country is not null group by country
  ),
  plays_now as (
    select least(floor(least(p.duration_listened / nullif(p.song_duration, 0), 1) * 10), 9)::int as bin
      from public.plays p
     where p.song_id = any(v_songs) and (p.user_id is null or p.user_id <> v_user)
       and p.created_at >= v_from and p.song_duration > 0
  )
  select jsonb_build_object(
    'countries', jsonb_build_object(
      'shown', coalesce((select jsonb_agg(jsonb_build_object('country', c.country, 'listeners', c.n)
                                          order by c.n desc, c.country)
                           from countries c where c.n >= 5), '[]'::jsonb),
      'other', coalesce((select sum(c.n) from countries c where c.n < 5), 0),
      'unknown', (select count(*) from now_ where country is null)),
    'audience', jsonb_build_object(
      'new', (select count(*) from now_ n join firsts f on f.who = n.who where f.first_at >= v_from),
      'returning', (select count(*) from now_ n join firsts f on f.who = n.who where f.first_at < v_from)),
    'segments', jsonb_build_object(
      'light', (select count(*) from now_ where streams = 1),
      'regular', (select count(*) from now_ where streams between 2 and 4),
      'super', (select count(*) from now_ where streams >= 5)),
    'completion', (select jsonb_agg(coalesce((select count(*) from plays_now pn where pn.bin = b), 0) order by b)
                     from generate_series(0, 9) b)
  ) into v_more;

  return v_out || jsonb_build_object('more', v_more);
end;
$$;

-- A listener's own listening over the last [p_days] days: minutes, artists
-- heard and discovered, favourites, and their finds.
create or replace function public.listener_insights(p_days integer default 28, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_tz text := public._wavee_tz(p_tz);
  v_days int := case when p_days in (7, 28, 90, 365) then p_days else 28 end;
  v_unit text := case when p_days in (365) then 'week' else 'day' end;
  v_from timestamptz;
  v_before timestamptz;
begin
  if v_me is null then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  v_from := (date_trunc('day', now() at time zone v_tz) - make_interval(days => v_days - 1)) at time zone v_tz;
  v_before := v_from - make_interval(days => v_days);
  return (
    with p as (
      select p.created_at, p.duration_listened, s.user_id as artist,
             public.wavee_heard(p.duration_listened, p.song_duration) as heard,
             p.created_at >= v_from as now_
        from public.plays p
        join public.songs s on s.id = p.song_id
       where p.user_id = v_me and s.user_id <> v_me and p.created_at >= v_before
    ),
    firsts as (
      select s.user_id as artist, min(p.created_at) as first_at
        from public.plays p join public.songs s on s.id = p.song_id
        join public.users a on a.id = s.user_id
       where p.user_id = v_me and s.user_id <> v_me and not a.is_official
         and public.wavee_heard(p.duration_listened, p.song_duration)
       group by s.user_id
    ),
    buckets as (
      select b as at, greatest(b at time zone v_tz, v_from) as a, (b + ('1 ' || v_unit)::interval) at time zone v_tz as z
        from generate_series(date_trunc(v_unit, v_from at time zone v_tz),
                             date_trunc(v_unit, now() at time zone v_tz), ('1 ' || v_unit)::interval) as b
    )
    select jsonb_build_object(
      'days', v_days,
      'unit', v_unit,
      'totals', jsonb_build_object(
        'minutes', (select round(coalesce(sum(duration_listened), 0) / 60) from p where now_),
        'streams', (select count(*) from p where now_ and heard),
        'artists', (select count(distinct artist) from p where now_ and heard),
        'discovered', (select count(*) from firsts where first_at >= v_from),
        'likes', (select count(*) from public.likes l join public.songs s on s.id = l.song_id
                   where l.user_id = v_me and s.user_id <> v_me and l.created_at >= v_from)),
      'prev', jsonb_build_object(
        'minutes', (select round(coalesce(sum(duration_listened), 0) / 60) from p where not now_),
        'streams', (select count(*) from p where not now_ and heard),
        'artists', (select count(distinct artist) from p where not now_ and heard),
        'discovered', (select count(*) from firsts where first_at >= v_before and first_at < v_from),
        'likes', (select count(*) from public.likes l join public.songs s on s.id = l.song_id
                   where l.user_id = v_me and s.user_id <> v_me and l.created_at >= v_before and l.created_at < v_from)),
      'series', (select jsonb_agg(jsonb_build_object(
                   'date', b.at::date,
                   'minutes', (select round(coalesce(sum(duration_listened), 0) / 60) from p
                                where p.created_at >= b.a and p.created_at < b.z),
                   'discovered', (select count(*) from firsts f where f.first_at >= b.a and f.first_at < b.z))
                   order by b.at) from buckets b),
      'top_artists', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', u.id, 'username', u.username, 'display_name', u.display_name,
                         'avatar_url', u.avatar_url, 'verified', u.verified_at is not null, 'streams', t.n)
                         order by t.n desc, u.username), '[]'::jsonb)
                        from (select artist, count(*) as n from p where now_ and heard
                               group by artist order by count(*) desc limit 5) t
                        join public.users u on u.id = t.artist and u.banned_at is null),
      'all_time', jsonb_build_object(
        'minutes', (select round(coalesce(sum(p2.duration_listened), 0) / 60) from public.plays p2 where p2.user_id = v_me),
        'discovered', (select count(*) from firsts)),
      'ear', public.wavee_ear(v_me),
      'streak', (public._wavee_explorer(v_me) ->> 'streak')::int,
      'invited', (select count(*) from public.users u where u.referred_by = v_me and u.banned_at is null)
    )
  );
end;
$$;

revoke all on function public.record_play(uuid, numeric, numeric, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.record_play(uuid, numeric, numeric, boolean, text, text, text) to anon, authenticated;
revoke all on function public._wavee_tz(text) from public, anon, authenticated;
revoke all on function public._wavee_full_stats(uuid) from public, anon, authenticated;
revoke all on function public.artist_insights(integer, uuid, text, uuid) from public, anon;
revoke all on function public.listener_insights(integer, text) from public, anon;
grant execute on function public.artist_insights(integer, uuid, text, uuid) to authenticated;
grant execute on function public.listener_insights(integer, text) to authenticated;
