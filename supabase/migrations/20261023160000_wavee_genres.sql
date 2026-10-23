-- Wavee genres (October 2026): a song can have up to three genres, the first being its main one.
--
-- Builds on the relaunch, growth and artists migrations. Idempotent like them.
--
-- songs.genres holds them in order; songs.genre stays as the main one (genres[1]), kept in step by
-- a trigger, so everything that reads one genre keeps working. The charts' genre filter and search
-- match any of a song's genres.

alter table public.songs add column if not exists genres text[] not null default '{}';

update public.songs
   set genres = array[btrim(genre)]
 where cardinality(genres) = 0 and nullif(btrim(genre), '') is not null;

-- Up to three, each 1 to 40 characters. (Check constraints can't hold a subquery, so it's a
-- function; like the link checks, it keeps its default execute so any writer can run it.)
create or replace function public.wavee_genres_ok(p_genres text[])
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select cardinality(p_genres) <= 3
         and coalesce((select bool_and(g is not null and char_length(btrim(g)) between 1 and 40)
                       from unnest(p_genres) g), true)
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.songs'::regclass and conname = 'songs_genres_check') then
    alter table public.songs add constraint songs_genres_check check (public.wavee_genres_ok(genres));
  end if;
end $$;

-- Keeps genre and genres in step: a new genres list sets the main genre; a client that only
-- sends genre (older versions of the app) gets it as the main one.
create or replace function public.wavee_songs_genres()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.genres := array(
    select btrim(g) from unnest(coalesce(new.genres, '{}')) with ordinality t(g, i)
    where nullif(btrim(g), '') is not null
    order by i
  );
  if tg_op = 'UPDATE' and new.genres is not distinct from old.genres
     and new.genre is distinct from old.genre and nullif(btrim(new.genre), '') is not null then
    -- only the main genre changed: it replaces the first
    new.genres := array[btrim(new.genre)] || array(
      select g from unnest(new.genres) g where lower(g) <> lower(btrim(new.genre)) and g <> new.genres[1]
    );
    new.genres := new.genres[1:3];
  elsif cardinality(new.genres) = 0 and nullif(btrim(new.genre), '') is not null then
    new.genres := array[btrim(new.genre)];
  end if;
  if cardinality(new.genres) > 0 then
    new.genre := new.genres[1];
  end if;
  return new;
end $$;

drop trigger if exists wavee_songs_genres on public.songs;
create trigger wavee_songs_genres
  before insert or update on public.songs
  for each row execute function public.wavee_songs_genres();

-- Song cards carry every genre.
do $$
declare
  v_rel oid := (select typrelid from pg_type where oid = 'public.song_card'::regtype);
begin
  if not exists (select 1 from pg_attribute where attrelid = v_rel and attname = 'genres' and not attisdropped) then
    alter type public.song_card add attribute genres text[];
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
         s.made_with_ai,
         s.genres
  from unnest(p_ids) with ordinality as t(song_id, ord)
  join public.songs s on s.id = t.song_id
  join public.users u on u.id = s.user_id
  order by t.ord
$$;

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
      and (pr.genre is null
           or exists (select 1 from unnest(s.genres) g where public.wavee_genre_key(g) = pr.genre))
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
    select s.id from q, public.songs s
    where q.q <> '' and exists (select 1 from unnest(s.genres) g where g ilike q.pat)
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
        when exists (select 1 from unnest(s.genres) g where lower(g) = q.ql) then 4
        else 5
      end,
      greatest(similarity(s.title, q.q), similarity(u.username, q.q),
               similarity(coalesce(u.display_name, ''), q.q)) desc,
      s.plays_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ))
$$;

revoke all on function public.wavee_songs_genres() from public, anon, authenticated;
revoke all on function public.wavee_song_cards(uuid[]) from public, anon, authenticated;
revoke all on function public.get_chart(text, text, integer) from public, anon, authenticated;
revoke all on function public.search_songs(text, integer) from public, anon, authenticated;
grant execute on function public.get_chart(text, text, integer) to anon, authenticated;
grant execute on function public.search_songs(text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
