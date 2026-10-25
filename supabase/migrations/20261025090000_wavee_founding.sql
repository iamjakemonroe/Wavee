-- Growing Wavee from nothing: the "Founding 100" plan in docs/LAUNCH.md.
--
--   * Founding 100: the first 30 artists and 70 listeners who join on purpose
--     get a numbered Founding badge for good (founding_members). The
--     /founding page shows the real spots left; nothing here is ever padded.
--   * First listens: an artist's first three songs are each played to 25
--     listeners in the feed, free, marked "New artist" (a Boost with source
--     'welcome'). Unlike a paid Boost these listens count toward the charts:
--     every new artist gets the same.
--   * Fresh Finds: songs the team picks each week, with a line on why
--     (weekly_picks).
--   * Feedback: listeners who heard a song tell the artist what worked,
--     privately (song_feedback).
--   * Your week (my_week) for artists; the weekly discovery challenge
--     (my_challenge) and early finds (get_user_finds) for listeners.
--   * Invites: who brought whom (users.referred_by).
--   * Collections: playlists the team features on Home (featured_playlists).
--   * For the team: admin_pulse (the numbers that matter each week) and
--     admin_new_artists (every new artist, so no first upload goes unheard).
--
-- The numbers live in wavee_growth; change them in the SQL editor, e.g.
--   update wavee_growth set founding_open = false;      -- close the founding spots
--   update wavee_growth set welcome_listeners = 40;     -- first listens per song
--
-- Messages a person should read come with errcode WV001; the app shows them
-- as they are.

-- ── Settings ────────────────────────────────────────────────────────────

create table if not exists public.wavee_growth (
  id                 boolean primary key default true check (id),
  founding_open      boolean not null default true,
  founding_artists   int not null default 30 check (founding_artists >= 0),
  founding_listeners int not null default 70 check (founding_listeners >= 0),
  welcome_songs      int not null default 3 check (welcome_songs >= 0),
  welcome_listeners  int not null default 25 check (welcome_listeners > 0),
  challenge_goal     int not null default 3 check (challenge_goal > 0)
);
insert into public.wavee_growth (id) values (true) on conflict (id) do nothing;

-- The Monday (UTC) that starts the week of [p_at].
create or replace function public.wavee_week(p_at timestamptz)
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc('week', p_at at time zone 'utc')::date;
$$;

-- A listen that counts as hearing the song: 30 seconds, or half of a short one
-- (the same rule as early likes and the charts).
create or replace function public.wavee_heard(p_listened numeric, p_duration numeric)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_listened >= 30 or (p_duration > 0 and p_listened >= p_duration / 2.0), false);
$$;

-- ── Founding 100 ────────────────────────────────────────────────────────

create table if not exists public.founding_members (
  user_id    uuid primary key references public.users (id) on delete cascade,
  number     int not null unique check (number > 0),
  role       text not null check (role in ('artist', 'listener')),
  joined_at  timestamptz not null default now(),
  granted_by uuid references public.users (id) on delete set null
);
create index if not exists founding_members_by_granter on public.founding_members (granted_by);

-- The founding spots as they really are, and the latest to join.
create or replace function public.founding_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'open', g.founding_open,
    'artists', jsonb_build_object(
      'taken', (select count(*) from public.founding_members where role = 'artist'),
      'cap', g.founding_artists),
    'listeners', jsonb_build_object(
      'taken', (select count(*) from public.founding_members where role = 'listener'),
      'cap', g.founding_listeners),
    'me', (select jsonb_build_object('number', f.number, 'role', f.role)
             from public.founding_members f where f.user_id = auth.uid()),
    'members', (select coalesce(jsonb_agg(x.card order by x.number desc), '[]'::jsonb) from (
                  select f.number, jsonb_build_object(
                           'number', f.number, 'role', f.role, 'username', u.username,
                           'display_name', u.display_name, 'avatar_url', u.avatar_url,
                           'verified', u.verified_at is not null) as card
                    from public.founding_members f
                    join public.users u on u.id = f.user_id
                   where u.banned_at is null
                   order by f.number desc
                   limit 24) x)
  )
  from public.wavee_growth g
  where g.id;
$$;

-- Take a founding spot. Artists need a song on Wavee first; a spot, once
-- taken, is kept (asking again returns it).
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
  v_cap := case when v_role = 'artist' then v_growth.founding_artists else v_growth.founding_listeners end;
  if (select count(*) from public.founding_members where role = v_role) >= v_cap then
    raise exception 'All the founding % spots are taken.', v_role using errcode = 'WV001';
  end if;

  select coalesce(max(number), 0) + 1 into v_number from public.founding_members;
  insert into public.founding_members (user_id, number, role) values (v_me, v_number, v_role);
  return jsonb_build_object('number', v_number, 'role', v_role);
end;
$$;

-- The team gives (or takes back) a founding spot by hand, past the limits:
-- for the artists and listeners they recruit themselves. p_role null removes it.
create or replace function public.admin_set_founding(p_user uuid, p_role text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text := lower(btrim(p_role));
  v_number int;
begin
  perform public.wavee_require_admin();
  if not exists (select 1 from public.users where id = p_user) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_role is null then
    delete from public.founding_members where user_id = p_user;
  elsif v_role not in ('artist', 'listener') then
    raise exception 'Unknown founding role' using errcode = '22023';
  else
    perform pg_advisory_xact_lock(hashtextextended('wavee:founding', 0));
    update public.founding_members set role = v_role where user_id = p_user;
    if not found then
      select coalesce(max(number), 0) + 1 into v_number from public.founding_members;
      insert into public.founding_members (user_id, number, role, granted_by)
      values (p_user, v_number, v_role, auth.uid());
    end if;
  end if;
  insert into public.moderation_log (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'user', p_user, 'founding', coalesce(v_role, 'removed'));
  return (select jsonb_build_object('number', f.number, 'role', f.role)
            from public.founding_members f where f.user_id = p_user);
end;
$$;

-- ── First listens: every new artist's first songs get heard ────────────

alter table public.boosts drop constraint if exists boosts_source_check;
alter table public.boosts add constraint boosts_source_check check (source in ('paid', 'pro', 'welcome'));

-- No price, so it can't be bought (the shop lists priced packs only).
insert into public.boost_packs (id, listeners, sort) values ('wavee.welcome', 25, 0)
on conflict (id) do nothing;

-- Which songs got first listens. Kept when a song is deleted, so deleting and
-- uploading again doesn't earn more.
create table if not exists public.first_listens (
  user_id  uuid not null references public.users (id) on delete cascade,
  song_id  uuid not null,
  given_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create or replace function public._wavee_first_listens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_growth public.wavee_growth;
begin
  if new.status <> 'active' then
    return null;
  end if;
  select * into v_growth from public.wavee_growth where id;
  if exists (select 1 from public.users u
              where u.id = new.user_id and (u.is_official or u.banned_at is not null)) then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('wavee:first-listens:' || new.user_id::text, 0));
  if (select count(*) from public.first_listens where user_id = new.user_id) >= v_growth.welcome_songs then
    return null;
  end if;
  insert into public.first_listens (user_id, song_id) values (new.user_id, new.id);
  insert into public.boosts (ref, song_id, user_id, pack, listeners, source, currency, amount, status, paid_at)
  values ('wavee-welcome-' || replace(gen_random_uuid()::text, '-', ''), new.id, new.user_id, 'wavee.welcome',
          v_growth.welcome_listeners, 'welcome', 'USD', 0, 'active', now());
  return null;
end;
$$;

drop trigger if exists wavee_first_listens on public.songs;
create trigger wavee_first_listens
  after insert on public.songs
  for each row execute function public._wavee_first_listens();

-- Only paid promotion stays out of the charts: first listens are the same
-- for everyone, so they count like any other play from the feed.
create or replace function public._wavee_boosted(p_song uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1 from public.boost_reach r join public.boosts b on b.id = r.boost_id
     where b.song_id = p_song and r.user_id = p_user and b.source <> 'welcome');
$$;

-- Songs for this listener's feed: paid Boosts and first listens take turns
-- (a paid one first), each kind least-heard first. 'kind' is 'promoted' for a
-- Boost, 'new' for first listens.
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'boost_id', p.id,
           'kind', case when p.source = 'welcome' then 'new' else 'promoted' end,
           'song', to_jsonb(c)) order by p.turn), '[]'::jsonb)
    from picks p
    cross join lateral public.wavee_song_cards(array[p.song_id]) c;
$$;

-- ── Fresh Finds: the team's picks of the week ───────────────────────────

create table if not exists public.weekly_picks (
  week       date not null check (extract(isodow from week) = 1),
  song_id    uuid not null references public.songs (id) on delete cascade,
  note       text check (note is null or char_length(note) <= 280),
  position   int not null default 0,
  picked_by  uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (week, song_id)
);
create index if not exists weekly_picks_by_song on public.weekly_picks (song_id);
create index if not exists weekly_picks_by_picker on public.weekly_picks (picked_by);

-- A week's picks (any day of it), or the latest week with picks so far. Also
-- the recent weeks that have picks, to look back.
create or replace function public.get_picks(p_week date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_now date := public.wavee_week(now());
  v_week date;
begin
  if p_week is null then
    select max(w.week) into v_week
      from public.weekly_picks w
      join public.songs s on s.id = w.song_id
      join public.users u on u.id = s.user_id
     where w.week <= v_now and s.status = 'active' and u.banned_at is null;
  else
    v_week := date_trunc('week', p_week::timestamp)::date;
  end if;
  v_week := coalesce(v_week, v_now);
  return jsonb_build_object(
    'week', v_week,
    'this_week', v_week = v_now,
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object('note', w.note, 'song', to_jsonb(c)) order by w.position, w.created_at)
        from public.weekly_picks w
        join public.songs s on s.id = w.song_id
        join public.users u on u.id = s.user_id
        cross join lateral public.wavee_song_cards(array[w.song_id]) c
       where w.week = v_week and s.status = 'active' and u.banned_at is null), '[]'::jsonb),
    'weeks', coalesce((
      select jsonb_agg(x.week order by x.week desc)
        from (select distinct w.week from public.weekly_picks w where w.week <= v_now
               order by w.week desc limit 12) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_pick(p_song uuid, p_note text default null, p_week date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_week date := date_trunc('week', coalesce(p_week::timestamp, now() at time zone 'utc'))::date;
  v_note text := nullif(btrim(p_note), '');
begin
  perform public.wavee_require_admin();
  if not exists (select 1 from public.songs where id = p_song and status = 'active') then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;
  if char_length(v_note) > 280 then
    raise exception 'Keep the note under 280 characters.' using errcode = 'WV001';
  end if;
  insert into public.weekly_picks (week, song_id, note, position, picked_by)
  values (v_week, p_song, v_note,
          coalesce((select max(position) + 1 from public.weekly_picks where week = v_week), 0), auth.uid())
  on conflict (week, song_id) do update set note = excluded.note;
  insert into public.moderation_log (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'song', p_song, 'pick', v_week::text);
  return public.get_picks(v_week);
end;
$$;

create or replace function public.admin_unpick(p_song uuid, p_week date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_week date := date_trunc('week', p_week::timestamp)::date;
begin
  perform public.wavee_require_admin();
  delete from public.weekly_picks where week = v_week and song_id = p_song;
  return public.get_picks(v_week);
end;
$$;

-- ── Feedback for artists ────────────────────────────────────────────────

create table if not exists public.song_feedback (
  song_id    uuid not null references public.songs (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  tags       text[] not null default '{}' check (
               tags <@ array['replay', 'hook', 'vocals', 'beat', 'lyrics', 'vibe', 'share', 'mix', 'intro', 'long']::text[]
               and cardinality(tags) <= 4),
  note       text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);
create index if not exists song_feedback_by_user on public.song_feedback (user_id);

-- Tell an artist what worked (and what didn't), after really listening:
-- a play that counts, or [p_listened] seconds of the song playing now (its
-- play is only recorded when it ends). Asking again changes your feedback.
create or replace function public.give_feedback(p_song uuid, p_tags text[], p_note text default null,
                                                p_listened numeric default 0)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_song public.songs;
  v_tags text[];
  v_note text := nullif(btrim(p_note), '');
begin
  if v_me is null or not exists (select 1 from public.users where id = v_me and banned_at is null) then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  select * into v_song from public.songs where id = p_song;
  if not found or v_song.status <> 'active' then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;
  if v_song.user_id = v_me then
    raise exception 'It’s your own song.' using errcode = 'WV001';
  end if;
  v_tags := array(select distinct t from unnest(coalesce(p_tags, '{}')) t where t is not null order by t);
  if not v_tags <@ array['replay', 'hook', 'vocals', 'beat', 'lyrics', 'vibe', 'share', 'mix', 'intro', 'long']::text[] then
    raise exception 'Unknown feedback' using errcode = '22023';
  end if;
  if cardinality(v_tags) > 4 then
    raise exception 'Pick up to four.' using errcode = 'WV001';
  end if;
  if cardinality(v_tags) = 0 and v_note is null then
    raise exception 'Pick what stood out, or write a line.' using errcode = 'WV001';
  end if;
  if char_length(v_note) > 280 then
    raise exception 'Keep it under 280 characters.' using errcode = 'WV001';
  end if;
  if not exists (
       select 1 from public.plays p
        where p.song_id = p_song and p.user_id = v_me and public.wavee_heard(p.duration_listened, p.song_duration))
     and not public.wavee_heard(coalesce(p_listened, 0), coalesce(v_song.duration_seconds, 0)) then
    raise exception 'Listen a little longer first.' using errcode = 'WV001';
  end if;
  perform public.wavee_rate_limit('feedback', public.wavee_rate_key(v_me, null), 60);

  insert into public.song_feedback (song_id, user_id, tags, note)
  values (p_song, v_me, v_tags, v_note)
  on conflict (song_id, user_id) do update
    set tags = excluded.tags, note = excluded.note, updated_at = now();
  return jsonb_build_object('tags', v_tags, 'note', v_note);
end;
$$;

create or replace function public.my_feedback(p_song uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('tags', f.tags, 'note', f.note)
    from public.song_feedback f
   where f.song_id = p_song and f.user_id = auth.uid();
$$;

-- What listeners told the artist, without their names (honest is the point).
create or replace function public.song_feedback_summary(p_song uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.songs where id = p_song;
  if v_owner is null or (v_owner is distinct from auth.uid() and not public.wavee_is_admin()) then
    raise exception 'not your song' using errcode = '42501';
  end if;
  return (
    with given as (
      select f.* from public.song_feedback f
        join public.users u on u.id = f.user_id
       where f.song_id = p_song and u.banned_at is null
    )
    select jsonb_build_object(
      'count', (select count(*) from given),
      'tags', coalesce((select jsonb_object_agg(x.tag, x.n)
                          from (select t as tag, count(*) as n from given g, unnest(g.tags) t group by t) x), '{}'::jsonb),
      'notes', coalesce((select jsonb_agg(jsonb_build_object('note', g.note, 'tags', g.tags, 'at', g.updated_at)
                                          order by g.updated_at desc)
                           from (select * from given where note is not null order by updated_at desc limit 50) g),
                        '[]'::jsonb)
    )
  );
end;
$$;

-- ── Your week, for artists ──────────────────────────────────────────────

-- The last seven days next to the seven before: listens from others only.
create or replace function public.my_week()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_since timestamptz := now() - interval '7 days';
  v_before timestamptz := now() - interval '14 days';
  v_out jsonb;
begin
  if v_me is null then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  with mine as (
    select s.id from public.songs s where s.user_id = v_me and s.status = 'active'
  ),
  heard as (
    select p.song_id, p.user_id, p.session_hash, p.created_at,
           public.wavee_heard(p.duration_listened, p.song_duration) as heard
      from public.plays p
      join mine m on m.id = p.song_id
     where p.created_at >= v_before and (p.user_id is null or p.user_id <> v_me)
  )
  select jsonb_build_object(
    'songs', (select count(*) from mine),
    'plays', count(*) filter (where h.created_at >= v_since),
    'plays_before', count(*) filter (where h.created_at < v_since),
    'listeners', count(distinct coalesce(h.user_id::text, h.session_hash)) filter (where h.created_at >= v_since),
    'listeners_before', count(distinct coalesce(h.user_id::text, h.session_hash)) filter (where h.created_at < v_since),
    'heard', count(*) filter (where h.created_at >= v_since and h.heard),
    'top', (select h2.song_id from heard h2 where h2.created_at >= v_since
             group by h2.song_id order by count(*) desc, h2.song_id limit 1)
  ) into v_out
  from heard h;

  return v_out || jsonb_build_object(
    'top_song', (select to_jsonb(c) from public.wavee_song_cards(array[(v_out ->> 'top')::uuid]) c
                  where v_out ->> 'top' is not null),
    'followers', (select count(*) from public.follows f where f.following_id = v_me and f.created_at >= v_since),
    'likes', (select count(*) from public.likes l join public.songs s on s.id = l.song_id
               where s.user_id = v_me and l.user_id <> v_me and l.created_at >= v_since),
    'feedback', (select count(*) from public.song_feedback f join public.songs s on s.id = f.song_id
                  where s.user_id = v_me and f.updated_at >= v_since),
    'first_listens', (select jsonb_build_object('reached', sum(b.reached), 'listeners', sum(b.listeners))
                        from public.boosts b where b.user_id = v_me and b.source = 'welcome'
                          and b.status in ('active', 'done') having count(*) > 0),
    'picked', exists (select 1 from public.weekly_picks w join public.songs s on s.id = w.song_id
                       where s.user_id = v_me and w.week = public.wavee_week(now()))
  );
end;
$$;

-- ── The discovery challenge and early finds, for listeners ─────────────

-- Each week, hear [challenge_goal] artists you'd never heard before. 'streak'
-- counts the weeks in a row you did (this week counts once it's done).
create or replace function public._wavee_explorer(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_goal int;
  v_now date := public.wavee_week(now());
  v_found int := 0;
  v_streak int := 0;
  v_expect date;
  r record;
begin
  select challenge_goal into v_goal from public.wavee_growth where id;
  v_expect := v_now - 7;
  for r in
    select public.wavee_week(h.first_at) as week, count(*) as n
      from (select s.user_id, min(p.created_at) as first_at
              from public.plays p
              join public.songs s on s.id = p.song_id
              join public.users u on u.id = s.user_id
             where p.user_id = p_user and s.user_id <> p_user and not u.is_official
               and public.wavee_heard(p.duration_listened, p.song_duration)
             group by s.user_id) h
     group by 1
     order by 1 desc
  loop
    if r.week = v_now then
      v_found := r.n;
      if r.n >= v_goal then v_streak := 1; end if;
      continue;
    end if;
    exit when r.week <> v_expect or r.n < v_goal;
    v_streak := v_streak + 1;
    v_expect := v_expect - 7;
  end loop;
  return jsonb_build_object('goal', v_goal, 'found', v_found, 'streak', v_streak);
end;
$$;

create or replace function public.my_challenge()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_now date := public.wavee_week(now());
begin
  if v_me is null then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  return public._wavee_explorer(v_me) || jsonb_build_object(
    'week', v_now,
    'ends_at', (v_now + 7)::timestamp at time zone 'utc',
    'artists', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                                          'avatar_url', u.avatar_url, 'verified', u.verified_at is not null)
                       order by h.first_at)
        from (select s.user_id, min(p.created_at) as first_at
                from public.plays p
                join public.songs s on s.id = p.song_id
                join public.users a on a.id = s.user_id
               where p.user_id = v_me and s.user_id <> v_me and not a.is_official
                 and public.wavee_heard(p.duration_listened, p.song_duration)
               group by s.user_id) h
        join public.users u on u.id = h.user_id
       where h.first_at >= v_now::timestamp at time zone 'utc'), '[]'::jsonb)
  );
end;
$$;

-- Songs someone liked early, after really listening (the Early Ear record):
-- their finds, newest first.
create or replace function public.get_user_finds(p_user uuid, p_limit integer default 50)
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
      join public.users me on me.id = l.user_id
     where l.user_id = p_user and l.early and s.status = 'active' and u.banned_at is null
       and me.banned_at is null
     order by l.created_at desc, l.song_id
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ))
$$;

-- The profile, now with the founding badge and the explorer streak.
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
           'verified', u.verified_at is not null,
           'official', u.is_official,
           'founding', (select jsonb_build_object('number', f.number, 'role', f.role)
                          from public.founding_members f where f.user_id = u.id),
           'explorer', (public._wavee_explorer(u.id) ->> 'streak')::int
         )
  from public.users u
  where lower(u.username) = lower(btrim(p_username))
    and (u.banned_at is null or u.id = auth.uid() or public.wavee_is_admin())
$$;

-- ── Invites ─────────────────────────────────────────────────────────────

alter table public.users add column if not exists referred_by uuid references public.users (id) on delete set null;
create index if not exists users_referred_by on public.users (referred_by);

-- Who sent you: kept once, for an account made in the last 14 days. Quiet
-- when it doesn't apply (a stale link is no one's problem).
create or replace function public.claim_referral(p_username text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_from uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false);
  end if;
  select id into v_from from public.users
   where lower(username) = lower(btrim(p_username)) and banned_at is null;
  if v_from is null or v_from = v_me then
    return jsonb_build_object('ok', false);
  end if;
  update public.users set referred_by = v_from
   where id = v_me and referred_by is null and created_at > now() - interval '14 days';
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.my_invites()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'count', count(*),
    'artists', count(*) filter (where exists (select 1 from public.songs s where s.user_id = u.id and s.status = 'active')),
    'people', coalesce(jsonb_agg(jsonb_build_object('username', u.username, 'display_name', u.display_name,
                                                    'avatar_url', u.avatar_url, 'joined', u.created_at)
                                 order by u.created_at desc) filter (where u.id is not null), '[]'::jsonb)
  )
  from public.users u
  where u.referred_by = auth.uid() and u.banned_at is null;
$$;

-- ── Collections: playlists the team features on Home ──────────────────

create table if not exists public.featured_playlists (
  playlist_id uuid primary key references public.playlists (id) on delete cascade,
  position    int not null default 0,
  featured_by uuid references public.users (id) on delete set null,
  featured_at timestamptz not null default now()
);
create index if not exists featured_playlists_by_user on public.featured_playlists (featured_by);

create or replace function public.get_featured_playlists()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'description', p.description, 'cover_image_url', p.cover_image_url,
           'owner', jsonb_build_object('username', o.username, 'display_name', o.display_name),
           'songs_count', (select count(*) from public.playlist_songs ps
                             join public.songs s on s.id = ps.song_id
                            where ps.playlist_id = p.id and s.status = 'active'),
           'covers', coalesce((select jsonb_agg(x.cover_image_url) from (
                                 select s.cover_image_url from public.playlist_songs ps
                                   join public.songs s on s.id = ps.song_id
                                  where ps.playlist_id = p.id and s.status = 'active' and s.cover_image_url is not null
                                  order by ps.position nulls last, ps.created_at
                                  limit 4) x), '[]'::jsonb))
           order by f.position, f.featured_at desc), '[]'::jsonb)
    from public.featured_playlists f
    join public.playlists p on p.id = f.playlist_id
    join public.users o on o.id = p.user_id
   where not p.is_private and o.banned_at is null;
$$;

create or replace function public.admin_feature_playlist(p_playlist uuid, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.wavee_require_admin();
  if coalesce(p_on, false) then
    if not exists (select 1 from public.playlists where id = p_playlist and not is_private) then
      raise exception 'Only a public playlist can be featured.' using errcode = 'WV001';
    end if;
    insert into public.featured_playlists (playlist_id, position, featured_by)
    values (p_playlist, coalesce((select max(position) + 1 from public.featured_playlists), 0), auth.uid())
    on conflict (playlist_id) do nothing;
  else
    delete from public.featured_playlists where playlist_id = p_playlist;
  end if;
  return public.get_featured_playlists();
end;
$$;

-- ── For the team ────────────────────────────────────────────────────────

-- Who the team has personally welcomed (a message, a setup call).
create table if not exists public.artist_welcomes (
  user_id     uuid primary key references public.users (id) on delete cascade,
  welcomed_by uuid references public.users (id) on delete set null,
  note        text check (note is null or char_length(note) <= 500),
  welcomed_at timestamptz not null default now()
);
create index if not exists artist_welcomes_by_admin on public.artist_welcomes (welcomed_by);

-- Every artist whose first song came in the last [p_days] days, newest first,
-- with how their start is going: listeners in their first week, first
-- listens, feedback, and whether the team has said hello.
create or replace function public.admin_new_artists(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  return (
    with firsts as (
      select s.user_id, min(s.created_at) as first_at, count(*) as songs
        from public.songs s
       where s.status <> 'removed'
       group by s.user_id
      having min(s.created_at) >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'user', jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                                        'avatar_url', u.avatar_url, 'verified', u.verified_at is not null,
                                        'links', u.links),
             'first_at', f.first_at,
             'songs', f.songs,
             'song', (select to_jsonb(c) from public.wavee_song_cards(array(
                        select s.id from public.songs s where s.user_id = u.id and s.status <> 'removed'
                         order by s.created_at limit 1)) c),
             'listeners', (select count(distinct coalesce(p.user_id::text, p.session_hash))
                             from public.plays p join public.songs s on s.id = p.song_id
                            where s.user_id = u.id and (p.user_id is null or p.user_id <> u.id)
                              and p.created_at < f.first_at + interval '7 days'),
             'first_listens', (select jsonb_build_object('reached', sum(b.reached), 'listeners', sum(b.listeners))
                                 from public.boosts b where b.user_id = u.id and b.source = 'welcome'
                               having count(*) > 0),
             'feedback', (select count(*) from public.song_feedback fb join public.songs s on s.id = fb.song_id
                           where s.user_id = u.id),
             'founding', (select fm.number from public.founding_members fm where fm.user_id = u.id),
             'picked', exists (select 1 from public.weekly_picks w join public.songs s on s.id = w.song_id
                                where s.user_id = u.id),
             'welcomed_at', w.welcomed_at,
             'welcome_note', w.note)
             order by f.first_at desc), '[]'::jsonb)
      from firsts f
      join public.users u on u.id = f.user_id
      left join public.artist_welcomes w on w.user_id = u.id
     where u.banned_at is null and not u.is_official
  );
end;
$$;

create or replace function public.admin_welcome_artist(p_user uuid, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.wavee_require_admin();
  if char_length(btrim(p_note)) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'WV001';
  end if;
  insert into public.artist_welcomes (user_id, welcomed_by, note)
  values (p_user, auth.uid(), nullif(btrim(p_note), ''))
  on conflict (user_id) do update
    set welcomed_by = excluded.welcomed_by, note = excluded.note, welcomed_at = now();
end;
$$;

-- The numbers that matter, a row per week (newest first): new accounts and
-- artists, listeners who really listened and came back, and whether new
-- songs got heard (5+ listeners in their first week).
create or replace function public.admin_pulse(p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  return (
    with weeks as (
      select w::date as week,
             w::timestamp at time zone 'utc' as a,
             (w + interval '7 days')::timestamp at time zone 'utc' as b
        from generate_series((public.wavee_week(now()) - 7 * (least(greatest(coalesce(p_weeks, 8), 1), 52) - 1))::timestamp,
                             public.wavee_week(now())::timestamp, interval '7 days') as w
    ),
    heard as (
      select p.user_id, p.song_id, p.created_at, s.user_id as artist
        from public.plays p join public.songs s on s.id = p.song_id
       where p.created_at >= (select min(a) from weeks) - interval '7 days'
         and public.wavee_heard(p.duration_listened, p.song_duration)
         and (p.user_id is null or p.user_id <> s.user_id)
    ),
    firsts as (
      select s.user_id, min(s.created_at) as first_at from public.songs s group by s.user_id
    )
    select jsonb_build_object(
      'weeks', (select jsonb_agg(jsonb_build_object(
        'week', k.week,
        'accounts', (select count(*) from public.users u where u.created_at >= k.a and u.created_at < k.b),
        'artists', (select count(*) from firsts f where f.first_at >= k.a and f.first_at < k.b),
        'songs', (select count(*) from public.songs s where s.created_at >= k.a and s.created_at < k.b),
        'listeners', (select count(distinct h.user_id) from heard h where h.created_at >= k.a and h.created_at < k.b),
        'returning', (select count(distinct h.user_id) from heard h
                       where h.created_at >= k.a and h.created_at < k.b
                         and exists (select 1 from heard e where e.user_id = h.user_id
                                      and e.created_at >= k.a - interval '7 days' and e.created_at < k.a)),
        'plays', (select count(*) from heard h where h.created_at >= k.a and h.created_at < k.b),
        'new_songs_heard', (select count(*) from public.songs s
                             where s.created_at >= k.a and s.created_at < k.b
                               and (select count(distinct coalesce(p.user_id::text, p.session_hash))
                                      from public.plays p
                                     where p.song_id = s.id and (p.user_id is null or p.user_id <> s.user_id)
                                       and p.created_at < s.created_at + interval '7 days') >= 5),
        'feedback', (select count(*) from public.song_feedback f where f.created_at >= k.a and f.created_at < k.b),
        'picks', (select count(*) from public.weekly_picks w where w.week = k.week))
        order by k.week desc) from weeks k),
      'totals', jsonb_build_object(
        'accounts', (select count(*) from public.users where banned_at is null),
        'artists', (select count(distinct s.user_id) from public.songs s where s.status = 'active'),
        'songs', (select count(*) from public.songs where status = 'active'),
        'founding_artists', (select count(*) from public.founding_members where role = 'artist'),
        'founding_listeners', (select count(*) from public.founding_members where role = 'listener'),
        'invited', (select count(*) from public.users where referred_by is not null))
    )
  );
end;
$$;

-- ── Access ──────────────────────────────────────────────────────────────

alter table public.wavee_growth enable row level security;
alter table public.founding_members enable row level security;
alter table public.first_listens enable row level security;
alter table public.weekly_picks enable row level security;
alter table public.song_feedback enable row level security;
alter table public.featured_playlists enable row level security;
alter table public.artist_welcomes enable row level security;
-- Read and written only through the functions above.
revoke all on public.wavee_growth, public.founding_members, public.first_listens, public.weekly_picks,
              public.song_feedback, public.featured_playlists, public.artist_welcomes
  from public, anon, authenticated;

revoke all on function public.wavee_week(timestamptz) from public, anon, authenticated;
revoke all on function public.wavee_heard(numeric, numeric) from public, anon, authenticated;
revoke all on function public._wavee_first_listens() from public, anon, authenticated;
revoke all on function public._wavee_boosted(uuid, uuid) from public, anon, authenticated;
revoke all on function public._wavee_explorer(uuid) from public, anon, authenticated;

revoke all on function public.founding_status() from public;
revoke all on function public.get_promoted(integer) from public;
revoke all on function public.get_picks(date) from public;
revoke all on function public.get_user_finds(uuid, integer) from public;
revoke all on function public.get_featured_playlists() from public;
revoke all on function public.get_profile(text) from public, anon, authenticated;
grant execute on function public.founding_status() to anon, authenticated;
grant execute on function public.get_promoted(integer) to anon, authenticated;
grant execute on function public.get_picks(date) to anon, authenticated;
grant execute on function public.get_user_finds(uuid, integer) to anon, authenticated;
grant execute on function public.get_featured_playlists() to anon, authenticated;
grant execute on function public.get_profile(text) to anon, authenticated;

revoke all on function public.claim_founding(text) from public, anon;
revoke all on function public.admin_set_founding(uuid, text) from public, anon;
revoke all on function public.admin_pick(uuid, text, date) from public, anon;
revoke all on function public.admin_unpick(uuid, date) from public, anon;
revoke all on function public.give_feedback(uuid, text[], text, numeric) from public, anon;
revoke all on function public.my_feedback(uuid) from public, anon;
revoke all on function public.song_feedback_summary(uuid) from public, anon;
revoke all on function public.my_week() from public, anon;
revoke all on function public.my_challenge() from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.my_invites() from public, anon;
revoke all on function public.admin_feature_playlist(uuid, boolean) from public, anon;
revoke all on function public.admin_new_artists(integer) from public, anon;
revoke all on function public.admin_welcome_artist(uuid, text) from public, anon;
revoke all on function public.admin_pulse(integer) from public, anon;
grant execute on function public.claim_founding(text) to authenticated;
grant execute on function public.admin_set_founding(uuid, text) to authenticated;
grant execute on function public.admin_pick(uuid, text, date) to authenticated;
grant execute on function public.admin_unpick(uuid, date) to authenticated;
grant execute on function public.give_feedback(uuid, text[], text, numeric) to authenticated;
grant execute on function public.my_feedback(uuid) to authenticated;
grant execute on function public.song_feedback_summary(uuid) to authenticated;
grant execute on function public.my_week() to authenticated;
grant execute on function public.my_challenge() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.admin_feature_playlist(uuid, boolean) to authenticated;
grant execute on function public.admin_new_artists(integer) to authenticated;
grant execute on function public.admin_welcome_artist(uuid, text) to authenticated;
grant execute on function public.admin_pulse(integer) to authenticated;
