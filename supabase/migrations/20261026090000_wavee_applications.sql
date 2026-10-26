-- Founding artists are chosen, not first come (decided 2026-10-26): if anyone
-- could be a founder, being one would mean nothing.
--
--   * Artists apply (artist_applications), on one of two tracks:
--       emerging: show the music is yours (your code on a profile that carries
--                 it, or a video of you making or performing it) and let
--                 listeners who never chose you decide: what the strangers
--                 its first listens reached did with each song is measured
--                 for the review (_wavee_song_signal);
--       known:    show you are who you say: your code in the bio of an
--                 official account. Chosen known artists are verified too.
--   * Anyone can ask for the Verified badge the same way, founding or not
--     (kind 'verified'). Verified stays identity only, never sold.
--   * Every applicant has one code (artist_codes), e.g. wavee-k7qf3m, to put
--     on a profile until the team has looked.
--   * The team reads every application with the evidence (admin_applications)
--     and decides (admin_decide_application): chosen, or "not yet" with a kind
--     reason. "Not yet" can apply again after wavee_growth.reapply_days.
--   * While wavee_growth.artists_by_review is on, claim_founding('artist')
--     points to the application. Listeners still take their own spot.
--     Founding spots already taken stay.
--
--   update wavee_growth set artists_by_review = false;   -- back to first come
--   update wavee_growth set reapply_days = 14;           -- a shorter wait

-- ── Settings ────────────────────────────────────────────────────────────

alter table public.wavee_growth add column if not exists artists_by_review boolean not null default true;
alter table public.wavee_growth add column if not exists reapply_days int not null default 30;
alter table public.wavee_growth drop constraint if exists wavee_growth_reapply_days_check;
alter table public.wavee_growth add constraint wavee_growth_reapply_days_check check (reapply_days between 0 and 365);

-- ── Codes: proof that an account elsewhere is yours ─────────────────────

-- Letters and digits that can't be misread (no i, l, o, 0 or 1).
create table if not exists public.artist_codes (
  user_id    uuid primary key references public.users (id) on delete cascade,
  code       text not null unique check (code ~ '^wavee-[a-hjkmnp-z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create or replace function public._wavee_code(p_user uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from public.artist_codes where user_id = p_user;
  while v_code is null loop
    insert into public.artist_codes (user_id, code)
    select p_user, 'wavee-' || string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
      from generate_series(1, 6)
    on conflict do nothing;
    -- Taken by someone else (rare): try another.
    select code into v_code from public.artist_codes where user_id = p_user;
  end loop;
  return v_code;
end;
$$;

-- ── Applications ────────────────────────────────────────────────────────

create table if not exists public.artist_applications (
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null check (kind in ('founding', 'verified')),
  track       text not null check (track in ('emerging', 'known')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'not_yet')),
  artist_name text not null check (char_length(artist_name) between 1 and 60),
  songs       uuid[] not null default '{}' check (cardinality(songs) <= 3),
  links       jsonb not null default '{}'::jsonb check (public.wavee_links_ok(links, 'artist')),
  -- Which of [links] carries the code.
  code_on     text check (code_on is null or links ? code_on),
  making_of   text check (making_of is null or char_length(making_of) <= 300),
  about       text not null check (char_length(about) between 1 and 800),
  audience    text check (audience is null or char_length(audience) <= 300),
  attempts    int not null default 1 check (attempts > 0),
  applied_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references public.users (id) on delete set null,
  -- To the artist, shown with the decision.
  message     text check (message is null or char_length(message) <= 600),
  -- The team's own: never shown to the artist.
  note        text check (note is null or char_length(note) <= 1000),
  review      jsonb check (review is null or (jsonb_typeof(review) = 'object' and char_length(review::text) <= 2000)),
  primary key (user_id, kind)
);
create index if not exists artist_applications_queue on public.artist_applications (status, kind, updated_at);
create index if not exists artist_applications_by_decider on public.artist_applications (decided_by);

-- An application as its artist sees it: never the team's note or checks.
create or replace function public._wavee_application(p_app public.artist_applications)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p_app.user_id is null then null else jsonb_build_object(
    'kind', p_app.kind,
    'track', p_app.track,
    'status', p_app.status,
    'artist_name', p_app.artist_name,
    'songs', to_jsonb(p_app.songs),
    'links', p_app.links,
    'code_on', p_app.code_on,
    'making_of', p_app.making_of,
    'about', p_app.about,
    'audience', p_app.audience,
    'attempts', p_app.attempts,
    'applied_at', p_app.applied_at,
    'updated_at', p_app.updated_at,
    'decided_at', p_app.decided_at,
    'message', p_app.message,
    'again_at', case when p_app.status = 'not_yet'
                     then p_app.decided_at + make_interval(days => (select g.reapply_days from public.wavee_growth g where g.id)) end)
  end;
$$;

-- Your code (made the first time you ask), whether you're verified, and your applications.
create or replace function public.my_applications()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not exists (select 1 from public.users where id = v_me and banned_at is null) then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'code', public._wavee_code(v_me),
    'is_verified', (select u.verified_at is not null from public.users u where u.id = v_me),
    'founding', (select public._wavee_application(a) from public.artist_applications a
                  where a.user_id = v_me and a.kind = 'founding'),
    'verified', (select public._wavee_application(a) from public.artist_applications a
                  where a.user_id = v_me and a.kind = 'verified'));
end;
$$;

-- Apply (or change a pending application). Messages say exactly what's
-- missing; the app checks the same things first.
create or replace function public.submit_application(
  p_kind text,
  p_track text,
  p_artist_name text,
  p_songs uuid[],
  p_links jsonb,
  p_code_on text,
  p_making_of text,
  p_about text,
  p_audience text,
  p_promise boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_kind text := lower(btrim(p_kind));
  v_track text := lower(btrim(p_track));
  v_name text := nullif(btrim(p_artist_name), '');
  v_songs uuid[];
  v_links jsonb;
  v_code_on text := nullif(lower(btrim(p_code_on)), '');
  v_making text := nullif(btrim(p_making_of), '');
  v_about text := nullif(btrim(p_about), '');
  v_audience text := nullif(btrim(p_audience), '');
  v_growth public.wavee_growth;
  v_old public.artist_applications;
  v_app public.artist_applications;
begin
  if v_me is null or not exists (select 1 from public.users where id = v_me and banned_at is null) then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  if v_kind is null or v_kind not in ('founding', 'verified') then
    raise exception 'Unknown application' using errcode = '22023';
  end if;
  if v_kind = 'verified' then
    v_track := 'known';
  elsif v_track is null or v_track not in ('emerging', 'known') then
    raise exception 'Unknown track' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users a where a.id = v_me and a.email_confirmed_at is not null) then
    raise exception 'Confirm your email first: we review real people.' using errcode = 'WV001';
  end if;
  perform public.wavee_rate_limit('apply', 'u:' || v_me::text, 10, interval '1 day');

  select * into v_growth from public.wavee_growth where id;
  if v_kind = 'founding' then
    if exists (select 1 from public.founding_members f where f.user_id = v_me and f.role = 'artist') then
      raise exception 'You''re already a founding artist.' using errcode = 'WV001';
    end if;
    if not v_growth.founding_open then
      raise exception 'The founding spots are closed.' using errcode = 'WV001';
    end if;
    if (select count(*) from public.founding_members where role = 'artist') >= v_growth.founding_artists then
      raise exception 'All the founding artist spots are taken.' using errcode = 'WV001';
    end if;
  elsif exists (select 1 from public.users where id = v_me and verified_at is not null) then
    raise exception 'You''re already verified.' using errcode = 'WV001';
  end if;

  select * into v_old from public.artist_applications where user_id = v_me and kind = v_kind for update;
  if found and v_old.status = 'approved' then
    raise exception 'The team has already said yes to this one.' using errcode = 'WV001';
  end if;
  if found and v_old.status = 'not_yet'
     and v_old.decided_at + make_interval(days => v_growth.reapply_days) > now() then
    raise exception 'You can apply again from %.',
      to_char(v_old.decided_at + make_interval(days => v_growth.reapply_days), 'FMDD FMMonth YYYY')
      using errcode = 'WV001';
  end if;

  if v_name is null then
    raise exception 'Add the name you release music under.' using errcode = 'WV001';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'Keep your artist name under 60 characters.' using errcode = 'WV001';
  end if;

  -- Songs, once each, in the order chosen.
  v_songs := coalesce(array(
    select x.id from unnest(coalesce(p_songs, '{}')) with ordinality x(id, n)
     where x.id is not null group by x.id order by min(x.n)), '{}');
  if cardinality(v_songs) > 3 then
    raise exception 'Choose up to three songs: your best.' using errcode = 'WV001';
  end if;
  if v_kind = 'founding' and cardinality(v_songs) = 0 then
    raise exception 'Choose at least one of your songs on Wavee.' using errcode = 'WV001';
  end if;
  if exists (select 1 from unnest(v_songs) x(id)
              where not exists (select 1 from public.songs s
                                 where s.id = x.id and s.user_id = v_me and s.status = 'active')) then
    raise exception 'Choose songs you uploaded yourself.' using errcode = 'WV001';
  end if;

  -- Links: empty ones dropped, the rest checked like a profile's.
  if p_links is not null and jsonb_typeof(p_links) <> 'object' then
    raise exception 'Links should be a list of platforms' using errcode = '22023';
  end if;
  v_links := coalesce((select jsonb_object_agg(e.key, to_jsonb(btrim(e.value #>> '{}')))
                         from jsonb_each(coalesce(p_links, '{}'::jsonb)) e
                        where jsonb_typeof(e.value) = 'string' and btrim(e.value #>> '{}') <> ''), '{}'::jsonb);
  if not public.wavee_links_ok(v_links, 'artist') then
    raise exception 'One of your links isn''t right: check each one.' using errcode = 'WV001';
  end if;
  if v_code_on is not null and not v_links ? v_code_on then
    raise exception 'Add the link to the profile where you put your code.' using errcode = 'WV001';
  end if;
  if v_making is not null and (char_length(v_making) > 300
     or v_making !~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(:443)?([/?#][^\s"''<>\\]*)?$') then
    raise exception 'The video link should be a full web address, starting with https://' using errcode = 'WV001';
  end if;
  if v_track = 'known' and v_code_on is null then
    raise exception 'Put your code in the bio of an official account, and tell us which one.' using errcode = 'WV001';
  end if;
  if v_track = 'emerging' and v_code_on is null and v_making is null then
    raise exception 'Show us the music is yours: your code on one of your profiles, or a video of you making or performing it.'
      using errcode = 'WV001';
  end if;

  if v_about is null or char_length(v_about) < 40 then
    raise exception 'Tell us a little more about you and your music: a few sentences.' using errcode = 'WV001';
  end if;
  if char_length(v_about) > 800 then
    raise exception 'Keep "about you" under 800 characters.' using errcode = 'WV001';
  end if;
  if char_length(v_audience) > 300 then
    raise exception 'Keep "your listeners" under 300 characters.' using errcode = 'WV001';
  end if;
  if p_promise is not true then
    raise exception 'Tick the promise at the end to send it.' using errcode = 'WV001';
  end if;

  insert into public.artist_applications as a
    (user_id, kind, track, artist_name, songs, links, code_on, making_of, about, audience)
  values (v_me, v_kind, v_track, v_name, v_songs, v_links, v_code_on, v_making, v_about, v_audience)
  on conflict (user_id, kind) do update
     set track = excluded.track, artist_name = excluded.artist_name, songs = excluded.songs,
         links = excluded.links, code_on = excluded.code_on, making_of = excluded.making_of,
         about = excluded.about, audience = excluded.audience, updated_at = now(),
         -- Applying again after "not yet": a fresh review, with the last one's note kept for context.
         attempts = a.attempts + (a.status = 'not_yet')::int,
         status = 'pending', decided_at = null, decided_by = null, message = null
  returning * into v_app;
  return public._wavee_application(v_app);
end;
$$;

-- Take back a pending application.
create or replace function public.withdraw_application(p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in to do that.' using errcode = '42501';
  end if;
  delete from public.artist_applications
   where user_id = auth.uid() and kind = lower(btrim(p_kind)) and status = 'pending';
  return public.my_applications();
end;
$$;

-- ── What listeners did with a song ──────────────────────────────────────

-- For the review: everyone's listening (not the artist's own), and on its own
-- the strangers its first listens reached, who never chose the artist. How
-- much of the song each listener played is their best listen, so replays
-- don't count twice.
create or replace function public._wavee_song_signal(p_song uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with song as (
    select s.id, s.user_id from public.songs s where s.id = p_song
  ),
  per as (
    select coalesce(p.user_id::text, p.session_hash) as who, p.user_id,
           max(least(p.duration_listened / nullif(p.song_duration, 0), 1)) as best,
           count(*) filter (where public.wavee_heard(p.duration_listened, p.song_duration)) as heard
      from public.plays p
      join song on song.id = p.song_id
     where (p.user_id is null or p.user_id <> song.user_id)
       and coalesce(p.user_id::text, p.session_hash) is not null
     group by 1, 2
  ),
  strangers as (
    select distinct r.user_id
      from public.boost_reach r
      join public.boosts b on b.id = r.boost_id
     where b.song_id = p_song and b.source = 'welcome'
  )
  select jsonb_build_object(
    'listeners', (select count(*) from per),
    'heard', (select count(*) from per where heard > 0),
    'completion', (select round(avg(best), 3) from per),
    'finished', (select count(*) from per where best >= 0.9),
    'came_back', (select count(*) from per where heard >= 2),
    'likes', (select count(*) from public.likes l, song where l.song_id = song.id and l.user_id <> song.user_id),
    'saves', (select count(distinct pl.user_id) from public.playlist_songs ps
                join public.playlists pl on pl.id = ps.playlist_id, song
               where ps.song_id = song.id and pl.user_id <> song.user_id),
    'feedback', (select count(*) from public.song_feedback f where f.song_id = p_song),
    'tags', coalesce((select jsonb_object_agg(x.tag, x.n)
                        from (select t as tag, count(*) as n from public.song_feedback f, unnest(f.tags) t
                               where f.song_id = p_song group by t) x), '{}'::jsonb),
    'strangers', jsonb_build_object(
      'reached', (select count(*) from strangers),
      'heard', (select count(*) from per join strangers st on st.user_id = per.user_id where per.heard > 0),
      'completion', (select round(avg(per.best), 3) from per join strangers st on st.user_id = per.user_id),
      'likes', (select count(*) from public.likes l join strangers st on st.user_id = l.user_id where l.song_id = p_song),
      'came_back', (select count(*) from per join strangers st on st.user_id = per.user_id where per.heard >= 2))
  );
$$;

-- ── The team's review ───────────────────────────────────────────────────

-- Applications with everything needed to decide: pending ones oldest first
-- (first come, first read), decided ones newest first.
create or replace function public.admin_applications(p_status text default 'pending', p_kind text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text := nullif(lower(btrim(p_status)), '');
  v_kind text := nullif(lower(btrim(p_kind)), '');
begin
  perform public.wavee_require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user', jsonb_build_object(
                       'id', u.id, 'username', u.username, 'display_name', u.display_name,
                       'avatar_url', u.avatar_url, 'verified', u.verified_at is not null,
                       'links', u.links, 'joined_at', u.created_at, 'email', public._wavee_email(u.id),
                       'followers', u.followers_count,
                       'songs', (select count(*) from public.songs s where s.user_id = u.id and s.status = 'active')),
             'kind', a.kind,
             'track', a.track,
             'status', a.status,
             'artist_name', a.artist_name,
             'links', a.links,
             'code', c.code,
             'code_on', a.code_on,
             'making_of', a.making_of,
             'about', a.about,
             'audience', a.audience,
             'attempts', a.attempts,
             'applied_at', a.applied_at,
             'updated_at', a.updated_at,
             'decided_at', a.decided_at,
             'decided_by', (select d.username from public.users d where d.id = a.decided_by),
             'message', a.message,
             'note', a.note,
             'review', a.review,
             'founding', (select f.number from public.founding_members f where f.user_id = u.id and f.role = 'artist'),
             -- Other accounts going by the same name: a known artist's name on a new account is the first
             -- thing to check.
             'same_name', coalesce((
               select jsonb_agg(jsonb_build_object('username', o.username, 'display_name', o.display_name,
                                                   'verified', o.verified_at is not null) order by o.verified_at nulls last)
                 from public.users o
                where o.id <> u.id and o.banned_at is null
                  and regexp_replace(lower(a.artist_name), '[[:space:][:punct:]]', '', 'g') <> ''
                  and regexp_replace(lower(a.artist_name), '[[:space:][:punct:]]', '', 'g')
                      in (regexp_replace(lower(o.display_name), '[[:space:][:punct:]]', '', 'g'),
                          regexp_replace(lower(o.username), '[[:space:][:punct:]]', '', 'g'))), '[]'::jsonb),
             'songs', coalesce((
               select jsonb_agg(jsonb_build_object('song', to_jsonb(card), 'signal', public._wavee_song_signal(x.id))
                                order by x.n)
                 from unnest(a.songs) with ordinality x(id, n)
                 cross join lateral public.wavee_song_cards(array[x.id]) card), '[]'::jsonb))
             order by case when a.status = 'pending' then a.updated_at end,
                      a.decided_at desc nulls last), '[]'::jsonb)
      from public.artist_applications a
      join public.users u on u.id = a.user_id
      left join public.artist_codes c on c.user_id = a.user_id
     where u.banned_at is null
       and (v_status is null or v_status = 'all' or a.status = v_status)
       and (v_kind is null or a.kind = v_kind)
  );
end;
$$;

-- Decide. 'approved' gives a founding application the next founding number
-- (within the limit) and, with p_verify, the Verified badge; a 'verified'
-- application always verifies. Verifying needs to say how it was checked
-- (p_review.identity). 'not_yet' needs a kind reason for the artist.
create or replace function public.admin_decide_application(
  p_user uuid,
  p_kind text,
  p_decision text,
  p_message text default null,
  p_note text default null,
  p_verify boolean default false,
  p_review jsonb default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kind text := lower(btrim(p_kind));
  v_decision text := lower(btrim(p_decision));
  v_message text := nullif(btrim(p_message), '');
  v_note text := nullif(btrim(p_note), '');
  v_app public.artist_applications;
  v_growth public.wavee_growth;
  v_verify boolean;
  v_number int;
begin
  perform public.wavee_require_admin();
  if v_decision is null or v_decision not in ('approved', 'not_yet') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
  select * into v_app from public.artist_applications where user_id = p_user and kind = v_kind for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status = 'approved' then
    raise exception 'Already approved. To undo it, take back the spot or the badge by hand.' using errcode = 'WV001';
  end if;
  if p_review is not null and jsonb_typeof(p_review) <> 'object' then
    raise exception 'The checks should be an object' using errcode = '22023';
  end if;
  v_verify := v_decision = 'approved' and (v_kind = 'verified' or coalesce(p_verify, false));
  if v_verify and coalesce(p_review ->> 'identity', '') not in ('code', 'email', 'personal') then
    raise exception 'Say how you checked it''s really them before verifying.' using errcode = 'WV001';
  end if;
  if v_decision = 'not_yet' and char_length(coalesce(v_message, '')) < 10 then
    raise exception 'Tell them why, kindly: it helps them come back stronger.' using errcode = 'WV001';
  end if;

  if v_decision = 'approved' and v_kind = 'founding' then
    perform pg_advisory_xact_lock(hashtextextended('wavee:founding', 0));
    select * into v_growth from public.wavee_growth where id;
    if not exists (select 1 from public.founding_members where user_id = p_user and role = 'artist')
       and (select count(*) from public.founding_members where role = 'artist') >= v_growth.founding_artists then
      raise exception 'All % founding artist spots are taken. Raise the limit first.', v_growth.founding_artists
        using errcode = 'WV001';
    end if;
    -- A founding listener who's chosen as an artist keeps their number.
    update public.founding_members set role = 'artist' where user_id = p_user;
    if not found then
      select coalesce(max(number), 0) + 1 into v_number from public.founding_members;
      insert into public.founding_members (user_id, number, role, granted_by) values (p_user, v_number, 'artist', auth.uid());
    end if;
  end if;
  if v_verify then
    update public.users set verified_at = coalesce(verified_at, now()) where id = p_user;
    insert into public.moderation_log (admin_id, target_type, target_id, action, note)
    values (auth.uid(), 'user', p_user, 'verified', 'application: ' || (p_review ->> 'identity'));
  end if;

  update public.artist_applications
     set status = v_decision, decided_at = now(), decided_by = auth.uid(), message = v_message,
         note = coalesce(v_note, note), review = coalesce(p_review, review)
   where user_id = p_user and kind = v_kind;
  insert into public.moderation_log (admin_id, target_type, target_id, action, note)
  values (auth.uid(), 'user', p_user, 'application', v_kind || ': ' || v_decision);

  return jsonb_build_object(
    'status', v_decision,
    'founding', (select f.number from public.founding_members f where f.user_id = p_user and f.role = 'artist'),
    'verified', (select u.verified_at is not null from public.users u where u.id = p_user));
end;
$$;

-- ── Founding spots: artists are chosen ──────────────────────────────────

-- As before, plus whether artists apply, how many have, and where your own
-- application stands.
create or replace function public.founding_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'open', g.founding_open,
    'review', g.artists_by_review,
    'artists', jsonb_build_object(
      'taken', (select count(*) from public.founding_members where role = 'artist'),
      'cap', g.founding_artists,
      'applied', (select count(*) from public.artist_applications where kind = 'founding')),
    'listeners', jsonb_build_object(
      'taken', (select count(*) from public.founding_members where role = 'listener'),
      'cap', g.founding_listeners),
    'me', (select jsonb_build_object('number', f.number, 'role', f.role)
             from public.founding_members f where f.user_id = auth.uid()),
    'application', (select jsonb_build_object('status', a.status, 'decided_at', a.decided_at)
                      from public.artist_applications a where a.user_id = auth.uid() and a.kind = 'founding'),
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
  if v_role = 'artist' and v_growth.artists_by_review then
    raise exception 'Founding artists are chosen by the Wavee team: apply on the Founding page.' using errcode = 'WV001';
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

-- ── Access ──────────────────────────────────────────────────────────────

alter table public.artist_codes enable row level security;
alter table public.artist_applications enable row level security;
-- Read and written only through the functions above.
revoke all on public.artist_codes, public.artist_applications from public, anon, authenticated;

revoke all on function public._wavee_code(uuid) from public, anon, authenticated;
revoke all on function public._wavee_application(public.artist_applications) from public, anon, authenticated;
revoke all on function public._wavee_song_signal(uuid) from public, anon, authenticated;

revoke all on function public.founding_status() from public;
grant execute on function public.founding_status() to anon, authenticated;
revoke all on function public.claim_founding(text) from public, anon;
revoke all on function public.my_applications() from public, anon;
revoke all on function public.submit_application(text, text, text, uuid[], jsonb, text, text, text, text, boolean)
  from public, anon;
revoke all on function public.withdraw_application(text) from public, anon;
revoke all on function public.admin_applications(text, text) from public, anon;
revoke all on function public.admin_decide_application(uuid, text, text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.claim_founding(text) to authenticated;
grant execute on function public.my_applications() to authenticated;
grant execute on function public.submit_application(text, text, text, uuid[], jsonb, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.withdraw_application(text) to authenticated;
grant execute on function public.admin_applications(text, text) to authenticated;
grant execute on function public.admin_decide_application(uuid, text, text, text, text, boolean, jsonb) to authenticated;

notify pgrst, 'reload schema';
