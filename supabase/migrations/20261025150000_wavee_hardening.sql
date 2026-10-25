-- Hardening before launch, from a security and load review:
--
--   * Plays can't be faked in bulk. record_play is rate limited (per account,
--     or per address for visitors), needs a session from visitors, and a play
--     can't claim more listening than the time since that listener's last one.
--   * The charts and Trending count Wavee accounts only, at most one stream per
--     listener, song and day, never the artist's own and never paid Boosts. The
--     Boost check is an anti-join (it was a function call per play: 8 s at 2M
--     plays, now well under a second).
--   * Test payments (Flutterwave sandbox) never count in production unless
--     wavee_money_settings.accept_test_payments is switched on for a test.
--   * Boost listeners are counted by the server from real plays of a Boost it
--     served (boost_heard no longer counts anything).
--   * Rate limits on direct writes (songs, likes, follows, playlists), banned
--     accounts can't follow, like or make playlists, one free Boost at a time.
--   * Founding spots need a confirmed email, and listeners some real listening.
--   * Reserved usernames (wavee…, kaivon, admin, support…) for the team only.
--   * Old tables from before the relaunch are closed to clients.

-- ── Money: test payments stay tests ────────────────────────────────────

create table if not exists public.wavee_money_settings (
  id                   boolean primary key default true check (id),
  -- On only while trying payments with Flutterwave's test cards.
  accept_test_payments boolean not null default false
);
insert into public.wavee_money_settings (id) values (true) on conflict (id) do nothing;

create or replace function public._wavee_money_ok(p_environment text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_environment = 'production'
      or coalesce((select accept_test_payments from public.wavee_money_settings where id), false);
$$;

create or replace function public._wavee_pro_until(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(period_end) from public.wavee_subscriptions
   where user_id = p_user and status in ('active', 'cancelled') and period_end > now()
     and public._wavee_money_ok(environment);
$$;

create or replace function public.wavee_credit(
  p_ref text,
  p_provider_id text,
  p_amount numeric,
  p_currency text,
  p_environment text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_boost public.boosts;
  v_sub public.wavee_subscriptions;
  v_env text := case when p_environment = 'sandbox' then 'sandbox' else 'production' end;
begin
  if not public._wavee_money_ok(v_env) then
    raise exception 'test payments are off';
  end if;
  if p_ref like 'wavee-boost-%' then
    select * into v_boost from public.boosts where ref = p_ref for update;
    if not found then raise exception 'unknown payment'; end if;
    if upper(p_currency) <> v_boost.currency or p_amount < v_boost.amount then
      raise exception 'paid % %, expected % %', p_amount, p_currency, v_boost.amount, v_boost.currency;
    end if;
    insert into public.wavee_charges (provider_id, ref, amount, currency)
      values (p_provider_id, p_ref, p_amount, upper(p_currency)) on conflict (provider_id) do nothing;
    if found and v_boost.status = 'pending' then
      update public.boosts set status = 'active', paid_at = now(), environment = v_env where id = v_boost.id;
    end if;
    return jsonb_build_object('kind', 'boost', 'user_id', v_boost.user_id, 'listeners', v_boost.listeners);
  end if;
  select * into v_sub from public.wavee_subscriptions where ref = p_ref for update;
  if not found then raise exception 'unknown payment'; end if;
  return public._wavee_sub_paid(v_sub, p_provider_id, p_amount, p_currency, v_env);
end;
$$;

create or replace function public.wavee_renew(
  p_flw_plan_id text,
  p_email text,
  p_provider_id text,
  p_amount numeric,
  p_currency text,
  p_environment text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.wavee_subscriptions;
  v_env text := case when p_environment = 'sandbox' then 'sandbox' else 'production' end;
begin
  if not public._wavee_money_ok(v_env) then
    raise exception 'test payments are off';
  end if;
  select * into v_sub from public.wavee_subscriptions
   where flw_plan_id = p_flw_plan_id and lower(email) = lower(p_email) and status <> 'pending'
   order by created_at desc limit 1 for update;
  if not found then raise exception 'unknown subscription'; end if;
  return public._wavee_sub_paid(v_sub, p_provider_id, p_amount, p_currency, v_env);
end;
$$;

-- One free Boost a month, even if asked for twice at once.
create or replace function public.boost_free(p_song uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_song public.songs;
  v_id uuid;
begin
  if v_me is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wavee:free-boost:' || v_me::text, 0));
  if not coalesce((public.wavee_my_plan() ->> 'free_boost')::boolean, false) then
    raise exception 'no free boost';
  end if;
  select * into v_song from public.songs where id = p_song;
  if not found or v_song.user_id <> v_me then raise exception 'not your song'; end if;
  if v_song.status <> 'active' then raise exception 'song not live'; end if;
  insert into public.boosts (ref, song_id, user_id, pack, listeners, source, currency, amount, status, paid_at)
  values ('wavee-free-' || replace(gen_random_uuid()::text, '-', ''), p_song, v_me, 'wavee.boost.100', 100,
          'pro', 'USD', 0, 'active', now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'listeners', 100);
end;
$$;

-- ── Boosts: the server counts who heard them ───────────────────────────

-- Which Boosts the feed showed to whom: only those count when played.
create table if not exists public.boost_served (
  boost_id uuid not null references public.boosts (id) on delete cascade,
  user_id  uuid not null references public.users (id) on delete cascade,
  at       timestamptz not null default now(),
  primary key (boost_id, user_id)
);
create index if not exists boost_served_by_user on public.boost_served (user_id);

create or replace function public.get_promoted(p_limit integer default 2)
returns jsonb
language sql
volatile
security definer
set search_path = public, extensions
as $$
  with live as (
    select b.id, b.song_id, b.source, b.reached::float / b.listeners as heard, random() as luck
      from public.boosts b
      join public.songs s on s.id = b.song_id
      join public.users u on u.id = s.user_id
     where b.status = 'active' and s.status = 'active' and u.banned_at is null
       and (b.source = 'welcome' or public._wavee_money_ok(b.environment))
       and (auth.uid() is null or (s.user_id <> auth.uid()
            and not exists (select 1 from public.boost_reach r where r.boost_id = b.id and r.user_id = auth.uid())))
  ),
  turns as (
    select l.*, 2 * row_number() over (order by l.heard, l.luck) - 1 as turn from live l where l.source <> 'welcome'
    union all
    select l.*, 2 * row_number() over (order by l.heard, l.luck) as turn from live l where l.source = 'welcome'
  ),
  picks as (
    select * from turns order by turn limit least(greatest(coalesce(p_limit, 2), 1), 5)
  ),
  served as (
    insert into public.boost_served (boost_id, user_id)
    select p.id, auth.uid() from picks p where auth.uid() is not null
    on conflict (boost_id, user_id) do update set at = now()
    returning 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'boost_id', p.id,
           'kind', case when p.source = 'welcome' then 'new' else 'promoted' end,
           'song', to_jsonb(c)) order by p.turn), '[]'::jsonb)
    from picks p
    cross join lateral public.wavee_song_cards(array[p.song_id]) c;
$$;

-- Kept for apps already out there; counting now happens in record_play.
create or replace function public.boost_heard(p_boost uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('counted', false);
$$;

-- ── Plays ───────────────────────────────────────────────────────────────

create index if not exists plays_session_created_idx on public.plays (session_hash, created_at) where user_id is null;

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
  v_last timestamptz;
  v_source text := lower(btrim(p_source));
  v_country text;
  v_headers json;
  v_boost record;
begin
  select u.id into v_uid from public.users u where u.id = auth.uid() and u.banned_at is null;
  v_session := case
    when nullif(btrim(p_session), '') is null then null
    else encode(sha256(convert_to(left(btrim(p_session), 200), 'UTF8')), 'hex')
  end;
  -- A visitor's play needs their browser's session; a signed-in one is the account.
  if v_uid is null and v_session is null then
    return;
  end if;

  select s.duration_seconds into v_stored
  from public.songs s join public.users u on u.id = s.user_id
  where s.id = p_song and s.status = 'active' and u.banned_at is null;
  if not found then
    return;
  end if;

  -- Generous for a person (a fast swiper skips a few songs a minute), tight for a script.
  -- Visitors are counted per address, whatever session they claim.
  perform public.wavee_rate_limit('play', public.wavee_rate_key(v_uid, coalesce(v_session, '')),
                                  case when v_uid is null then 300 else 600 end);

  -- Serialise this listener's plays so the checks below can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('play:' || coalesce(v_uid::text, v_session), 0));

  select max(p.created_at) into v_last
    from public.plays p
   where (v_uid is not null and p.user_id = v_uid)
      or (v_uid is null and p.user_id is null and p.session_hash = v_session);
  if v_last > now() - interval '30 seconds' and exists (
    select 1 from public.plays p
     where p.song_id = p_song and p.created_at > now() - interval '30 seconds'
       and ((v_uid is not null and p.user_id = v_uid)
            or (v_uid is null and p.user_id is null and p.session_hash = v_session))
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
  -- Nobody hears more of a song than the time since their last play (plus a little slack for
  -- clocks and pauses): a burst of calls claims almost nothing.
  if v_last is not null then
    v_listened := least(v_listened, extract(epoch from now() - v_last) + 10);
  end if;

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

  -- A Boost the feed served this listener counts them once they've heard 10 seconds of it.
  if v_uid is not null and v_listened >= 10 then
    for v_boost in
      select b.id from public.boosts b
        join public.boost_served sv on sv.boost_id = b.id and sv.user_id = v_uid and sv.at > now() - interval '6 hours'
       where b.song_id = p_song and b.status = 'active' and b.user_id <> v_uid
         and (b.source = 'welcome' or public._wavee_money_ok(b.environment))
       for update of b
    loop
      insert into public.boost_reach (boost_id, user_id) values (v_boost.id, v_uid) on conflict do nothing;
      if found then
        update public.boosts
           set reached = reached + 1,
               status = case when reached + 1 >= listeners then 'done' else status end,
               done_at = case when reached + 1 >= listeners then now() else done_at end
         where id = v_boost.id;
      end if;
    end loop;
  end if;
end $$;

-- ── Charts and Trending ─────────────────────────────────────────────────

-- Streams that count: Wavee accounts only, at most one per listener, song and day, heard (30 s
-- or half), never the artist's own, never a paid Boost's listener. Frozen to the hour.
create or replace function public.wavee_chart_plays()
returns table (song_id uuid, this_week bigint, last_week bigint)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with bounds as (select date_trunc('hour', now()) as t),
  counted as (
    select distinct p.song_id, p.user_id, date_trunc('day', p.created_at) as day
      from public.plays p
      cross join bounds b
      join public.songs s on s.id = p.song_id
      join public.users o on o.id = s.user_id
     where p.created_at >= b.t - interval '14 days'
       and p.created_at < b.t
       and p.user_id is not null
       and p.user_id <> s.user_id
       and not o.is_official
       and (p.duration_listened >= 30 or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
       and not exists (
         select 1 from public.boost_reach r join public.boosts bo on bo.id = r.boost_id
          where bo.song_id = p.song_id and r.user_id = p.user_id and bo.source <> 'welcome')
  )
  select c.song_id,
         count(*) filter (where c.day >= (select t from bounds) - interval '7 days') as this_week,
         count(*) filter (where c.day < (select t from bounds) - interval '7 days') as last_week
    from counted c
   group by c.song_id
$$;

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
    left join public.wavee_chart_plays() t on t.song_id = s.id
    where s.status = 'active' and u.banned_at is null and not u.is_official
    order by coalesce(t.this_week, 0) desc, s.likes_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ))
$$;

-- Same rule for anything else that asks whether a listener came from a paid Boost.
create or replace function public._wavee_boosted(p_song uuid, p_user uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_user is not null and exists (
    select 1 from public.boost_reach r join public.boosts b on b.id = r.boost_id
     where b.song_id = p_song and r.user_id = p_user and b.source <> 'welcome');
$$;

-- ── Rate limits and bans on direct writes ──────────────────────────────

create or replace function public._wavee_write_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return new;  -- the server itself (migrations, the service role)
  end if;
  perform public.wavee_rate_limit(tg_argv[0], 'u:' || v_me::text, tg_argv[1]::int, tg_argv[2]::interval);
  return new;
end;
$$;

drop trigger if exists wavee_limit_songs on public.songs;
create trigger wavee_limit_songs before insert on public.songs
  for each row execute function public._wavee_write_limit('song', '20', '24 hours');
drop trigger if exists wavee_limit_likes on public.likes;
create trigger wavee_limit_likes before insert on public.likes
  for each row execute function public._wavee_write_limit('like', '300', '1 hour');
drop trigger if exists wavee_limit_follows on public.follows;
create trigger wavee_limit_follows before insert on public.follows
  for each row execute function public._wavee_write_limit('follow', '200', '1 hour');
drop trigger if exists wavee_limit_playlists on public.playlists;
create trigger wavee_limit_playlists before insert on public.playlists
  for each row execute function public._wavee_write_limit('playlist', '30', '1 hour');
drop trigger if exists wavee_limit_playlist_songs on public.playlist_songs;
create trigger wavee_limit_playlist_songs before insert on public.playlist_songs
  for each row execute function public._wavee_write_limit('playlist_song', '500', '1 hour');

drop policy if exists "likes: insert own" on public.likes;
create policy "likes: insert own" on public.likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not (select public.wavee_is_banned())
    and exists (select 1 from public.songs s where s.id = song_id)
  );
drop policy if exists "follows: insert own" on public.follows;
create policy "follows: insert own" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and not (select public.wavee_is_banned()));
drop policy if exists "playlists: insert own" on public.playlists;
create policy "playlists: insert own" on public.playlists
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.wavee_is_banned()));

-- Uploads: the Worker asks before storing a file (60 an hour per account).
create or replace function public.upload_allowed()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.wavee_is_banned() then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  perform public.wavee_rate_limit('upload', 'u:' || auth.uid()::text, 60);
  return true;
end;
$$;

-- ── Founding spots: real people ────────────────────────────────────────

create or replace function public.claim_founding(p_role text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role text := lower(btrim(p_role));
  v_growth public.wavee_growth;
  v_member public.founding_members;
  v_cap int;
  v_number int;
begin
  if v_me is null or not exists (select 1 from public.users where id = v_me and banned_at is null) then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  select * into v_member from public.founding_members where user_id = v_me;
  if found then
    return jsonb_build_object('number', v_member.number, 'role', v_member.role);
  end if;
  if v_role is null or v_role not in ('artist', 'listener') then
    raise exception 'Unknown founding role' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users a where a.id = v_me and a.email_confirmed_at is not null) then
    raise exception 'Confirm your email first: founding spots are for real people.' using errcode = 'WV001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('wavee:founding', 0));
  select * into v_growth from public.wavee_growth where id;
  if not v_growth.founding_open then
    raise exception 'The founding spots are closed.' using errcode = 'WV001';
  end if;
  if v_role = 'artist' and not exists (
    select 1 from public.songs s where s.user_id = v_me and s.status = 'active'
  ) then
    raise exception 'Upload a song first: founding artists have music on Wavee.' using errcode = 'WV001';
  end if;
  if v_role = 'listener' and (
    select count(distinct p.song_id) from public.plays p join public.songs s on s.id = p.song_id
     where p.user_id = v_me and s.user_id <> v_me
       and (p.duration_listened >= 30 or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
  ) < 3 then
    raise exception 'Listen to three songs first: founding listeners are here for the music.' using errcode = 'WV001';
  end if;
  v_cap := case when v_role = 'artist' then v_growth.founding_artists else v_growth.founding_listeners end;
  if (select count(*) from public.founding_members where role = v_role) >= v_cap then
    raise exception 'All the founding % spots are taken.', v_role using errcode = 'WV001';
  end if;

  select coalesce(max(number), 0) + 1 into v_number from public.founding_members;
  insert into public.founding_members (user_id, number, role) values (v_me, v_number, v_role);
  return jsonb_build_object('number', v_number, 'role', v_role);
end;
$$;

-- ── Reserved usernames ──────────────────────────────────────────────────

create or replace function public.wavee_username_reserved(p_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(p_name) ~ '^(wavee|kaivon)'
      or lower(p_name) = any (array['admin', 'administrator', 'support', 'help', 'team', 'staff', 'moderator',
                                    'moderators', 'mod', 'mods', 'official', 'security', 'system', 'root', 'api',
                                    'www', 'mail', 'info', 'contact', 'billing', 'payments', 'abuse', 'copyright',
                                    'legal', 'press', 'null', 'undefined', 'everyone', 'settings', 'upload',
                                    'feed', 'charts', 'search', 'library', 'picks', 'founding', 'stats', 'auth',
                                    'signin', 'signup', 'login', 'logout']);
$$;

create or replace function public._wavee_users_reserved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wavee_username_reserved(new.username) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.username is not distinct from old.username or public.wavee_is_admin() or auth.uid() is null then
      return new;
    end if;
    raise exception 'That username is reserved for the Wavee team.' using errcode = 'WV001';
  end if;
  -- A new account asking for a reserved name gets a free variation instead.
  new.username := left(new.username, 24) || '_' || substr(md5(new.id::text), 1, 4);
  return new;
end;
$$;

drop trigger if exists wavee_users_reserved on public.users;
create trigger wavee_users_reserved
  before insert or update of username on public.users
  for each row execute function public._wavee_users_reserved();

-- ── Old tables from before the relaunch ────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['song_boosts', 'subscriptions', 'ai_song_insights', 'song_metrics', 'song_scores',
                           'artist_leaderboard_global', 'artist_leaderboard_rising', 'artist_leaderboard_weekly_trending'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── Access ──────────────────────────────────────────────────────────────

alter table public.wavee_money_settings enable row level security;
alter table public.boost_served enable row level security;
revoke all on public.wavee_money_settings, public.boost_served from public, anon, authenticated;

revoke all on function public._wavee_money_ok(text) from public, anon, authenticated;
revoke all on function public._wavee_write_limit() from public, anon, authenticated;
revoke all on function public._wavee_users_reserved() from public, anon, authenticated;
revoke all on function public.wavee_username_reserved(text) from public, anon, authenticated;
revoke all on function public._wavee_boosted(uuid, uuid) from public, anon, authenticated;
revoke all on function public.upload_allowed() from public, anon;
grant execute on function public.upload_allowed() to authenticated;
revoke all on function public.get_promoted(integer) from public;
grant execute on function public.get_promoted(integer) to anon, authenticated;
revoke all on function public.boost_heard(uuid) from public, anon;
grant execute on function public.boost_heard(uuid) to authenticated;
revoke all on function public.record_play(uuid, numeric, numeric, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.record_play(uuid, numeric, numeric, boolean, text, text, text) to anon, authenticated;
revoke all on function public.claim_founding(text) from public, anon;
grant execute on function public.claim_founding(text) to authenticated;
