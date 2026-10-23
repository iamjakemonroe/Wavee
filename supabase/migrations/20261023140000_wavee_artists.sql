-- Wavee artists (October 2026): featured artists, the official account, "Made with AI", music roles.
--
-- Builds on 20261023100000_wavee_relaunch.sql and 20261023120000_wavee_growth.sql. Idempotent like
-- them.
--
-- - Music roles: the old app's rule only allowed five lowercase roles, so saving the new ones failed.
--   Roles are now keys (singer, rapper, producer, songwriter, dj, instrumentalist, engineer, manager);
--   old values are carried over.
-- - Featured artists (song_artists): the uploader adds Wavee users to a song. Each one is asked and
--   shows on the song only once they accept, so nobody can be credited on music they didn't make.
--   Song cards list accepted features in order: "Wavee, Jake, Drake".
-- - The official account (users.is_official, set by admins): Wavee's own account posts music people
--   can find and play, but it stays out of Trending, the charts and tastemaker hits, and ranks below
--   real artists in the feed.
-- - songs.made_with_ai: any uploader can say a song was made with AI tools (Suno and the like); it's
--   shown on the song.

-- ─────────────────────────────────────────────────────────────────────────────
-- Music roles
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users drop constraint if exists users_music_roles_check;

update public.users
   set music_roles = array(
         select distinct case r when 'audio_engineer' then 'engineer' else r end
         from unnest(music_roles) r
         where r in ('songwriter', 'producer', 'audio_engineer', 'manager', 'singer', 'rapper', 'dj',
                     'instrumentalist', 'engineer')
       )
 where not (music_roles <@ array['singer', 'rapper', 'producer', 'songwriter', 'dj', 'instrumentalist',
                                 'engineer', 'manager']::text[]);

alter table public.users add constraint users_music_roles_check
  check (music_roles <@ array['singer', 'rapper', 'producer', 'songwriter', 'dj', 'instrumentalist',
                              'engineer', 'manager']::text[]);

-- ─────────────────────────────────────────────────────────────────────────────
-- The official account, and "Made with AI"
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users add column if not exists is_official boolean not null default false;
grant select (is_official) on public.users to anon, authenticated;

alter table public.songs add column if not exists made_with_ai boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Featured artists
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.song_artists (
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  position smallint not null default 0,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (song_id, user_id)
);
create index if not exists song_artists_user_idx on public.song_artists (user_id, status);
create index if not exists song_artists_invited_by_idx on public.song_artists (invited_by);

alter table public.song_artists enable row level security;
drop policy if exists "song_artists: read" on public.song_artists;
create policy "song_artists: read" on public.song_artists
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.songs s where s.id = song_artists.song_id and s.user_id = (select auth.uid()))
    or (status = 'accepted' and exists (
          select 1 from public.songs s join public.users u on u.id = s.user_id
          where s.id = song_artists.song_id and s.status = 'active' and u.banned_at is null))
    or (select public.wavee_is_admin())
  );
-- Clients only read; every change goes through the functions below.
revoke all on public.song_artists from anon, authenticated;
grant select on public.song_artists to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Song cards: features, the official badge, "Made with AI"
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_rel oid := (select typrelid from pg_type where oid = 'public.song_card'::regtype);
begin
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'features' and not attisdropped) then
    alter type public.song_card add attribute features jsonb;
  end if;
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'artist_official' and not attisdropped) then
    alter type public.song_card add attribute artist_official boolean;
  end if;
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'made_with_ai' and not attisdropped) then
    alter type public.song_card add attribute made_with_ai boolean;
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
         u.verified_at is not null,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', f.id, 'username', f.username,
                                               'display_name', f.display_name,
                                               'verified', f.verified_at is not null)
                            order by sa.position, sa.created_at)
           from public.song_artists sa
           join public.users f on f.id = sa.user_id
           where sa.song_id = s.id and sa.status = 'accepted' and f.banned_at is null
         ), '[]'::jsonb),
         u.is_official,
         s.made_with_ai
  from unnest(p_ids) with ordinality as t(song_id, ord)
  join public.songs s on s.id = t.song_id
  join public.users u on u.id = s.user_id
  order by t.ord
$$;

-- The owner sets who's featured, in order (up to 10). New names are asked; names left out are
-- removed; someone who declined isn't asked again.
create or replace function public.set_song_features(p_song uuid, p_users uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_users uuid[];
  v_new integer;
begin
  if v_uid is null or public.wavee_is_banned() then
    raise exception 'Please sign in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.songs where id = p_song and user_id = v_uid) then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;
  -- distinct, in the order given, without the owner, only real (not banned) users
  select coalesce(array_agg(x.id order by x.first), '{}') into v_users
  from (
    select t.id, min(t.ord) as first
    from unnest(coalesce(p_users, '{}')) with ordinality as t(id, ord)
    join public.users u on u.id = t.id and u.banned_at is null
    where t.id <> v_uid
    group by t.id
  ) x;
  if coalesce(array_length(v_users, 1), 0) > 10 then
    raise exception 'A song can feature up to 10 artists' using errcode = '22023';
  end if;

  select count(*) into v_new
  from unnest(v_users) as t(uid)
  where not exists (select 1 from public.song_artists sa where sa.song_id = p_song and sa.user_id = t.uid);
  if v_new > 0 then
    perform public.wavee_rate_limit('feature_invite', 'u:' || v_uid::text, 60, interval '1 hour');
  end if;

  delete from public.song_artists where song_id = p_song and not (user_id = any (v_users));
  insert into public.song_artists (song_id, user_id, position, invited_by)
  select p_song, t.id, t.ord - 1, v_uid
  from unnest(v_users) with ordinality as t(id, ord)
  on conflict (song_id, user_id) do update set position = excluded.position;

  return public.get_song_credits(p_song);
end $$;

-- Everyone asked to feature on a song, with where they stand (the owner and admins).
create or replace function public.get_song_credits(p_song uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', jsonb_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
                                      'avatar_url', u.avatar_url, 'verified', u.verified_at is not null),
           'status', sa.status) order by sa.position, sa.created_at), '[]'::jsonb)
  from public.song_artists sa
  join public.users u on u.id = sa.user_id
  where sa.song_id = p_song
    and exists (select 1 from public.songs s where s.id = p_song
                and (s.user_id = auth.uid() or public.wavee_is_admin()))
$$;

-- The featured artist answers (or later takes their name off: p_accept false).
create or replace function public.respond_to_feature(p_song uuid, p_accept boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
begin
  update public.song_artists
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where song_id = p_song and user_id = auth.uid()
  returning status into v_status;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('status', v_status);
end $$;

-- Songs you've been asked to feature on and haven't answered yet.
create or replace function public.my_feature_invites()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by sa.created_at desc), '[]'::jsonb)
  from public.song_artists sa
  join public.songs s on s.id = sa.song_id
  join public.users o on o.id = s.user_id
  cross join lateral public.wavee_song_cards(array[sa.song_id]) c
  where sa.user_id = auth.uid() and sa.status = 'pending'
    and s.status = 'active' and o.banned_at is null
$$;

-- Songs someone is featured on (their profile's "Appears on").
create or replace function public.get_user_appearances(p_user uuid, p_limit integer default 50,
                                                       p_offset integer default 0)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select s.id
    from public.song_artists sa
    join public.songs s on s.id = sa.song_id
    join public.users o on o.id = s.user_id
    where sa.user_id = p_user and sa.status = 'accepted'
      and s.status = 'active' and o.banned_at is null
    order by s.created_at desc, s.id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ))
$$;

-- Admins mark Wavee's own accounts.
create or replace function public.set_official(p_user uuid, p_official boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  perform public.wavee_require_admin();
  update public.users set is_official = coalesce(p_official, false) where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, target_type, target_id, action)
  values (auth.uid(), 'user', p_user, case when p_official then 'official' else 'not_official' end);
  return jsonb_build_object('official', coalesce(p_official, false));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Real artists first: the official account stays out of Trending, the charts and tastemaker hits,
-- and ranks below real artists in the feed. Search finds songs by their featured artists too.
-- ─────────────────────────────────────────────────────────────────────────────

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
           -- Wavee's own account plays too, but below real artists.
           - case when u.is_official then 2.5 else 0 end
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
    where s.status = 'active' and u.banned_at is null and not u.is_official
    order by coalesce(t.n, 0) desc, s.likes_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ))
$$;

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
    union
    -- songs an artist is featured on
    select sa.song_id from artists a join public.song_artists sa on sa.user_id = a.id and sa.status = 'accepted'
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
  join public.users o on o.id = s.user_id
  where p.created_at >= b.t - interval '14 days'
    and not o.is_official
    and p.created_at < b.t
    and (p.user_id is null or p.user_id <> s.user_id)
    and (p.duration_listened >= 30 or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
  group by p.song_id
$$;

create or replace function public.wavee_likes_early()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  select s.plays_count < 50
         and s.user_id <> new.user_id
         and not exists (select 1 from public.users o where o.id = s.user_id and o.is_official)
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
           'official', u.is_official
         )
  from public.users u
  where lower(u.username) = lower(btrim(p_username))
    and (u.banned_at is null or u.id = auth.uid() or public.wavee_is_admin())
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.wavee_song_cards(uuid[]) from public, anon, authenticated;
revoke all on function public.wavee_chart_plays() from public, anon, authenticated;
revoke all on function public.wavee_likes_early() from public, anon, authenticated;

revoke all on function public.set_song_features(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.respond_to_feature(uuid, boolean) from public, anon, authenticated;
revoke all on function public.my_feature_invites() from public, anon, authenticated;
revoke all on function public.set_official(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_song_credits(uuid) from public, anon, authenticated;
revoke all on function public.get_user_appearances(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.set_song_features(uuid, uuid[]) to authenticated;
grant execute on function public.respond_to_feature(uuid, boolean) to authenticated;
grant execute on function public.my_feature_invites() to authenticated;
grant execute on function public.set_official(uuid, boolean) to authenticated;
grant execute on function public.get_song_credits(uuid) to authenticated;
grant execute on function public.get_user_appearances(uuid, integer, integer) to anon, authenticated;

revoke all on function public.get_feed(integer, integer) from public, anon, authenticated;
revoke all on function public.get_trending(integer) from public, anon, authenticated;
revoke all on function public.search_songs(text, integer) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
grant execute on function public.get_feed(integer, integer) to anon, authenticated;
grant execute on function public.get_trending(integer) to anon, authenticated;
grant execute on function public.search_songs(text, integer) to anon, authenticated;
grant execute on function public.get_profile(text) to anon, authenticated;

notify pgrst, 'reload schema';
