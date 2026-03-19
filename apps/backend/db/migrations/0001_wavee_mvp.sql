-- Wavee MVP schema sql file
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  avatar_url text,
  bio text,
  is_artist boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  audio_url text not null,
  cover_image_url text,
  genre text not null default 'unknown',
  plays_count integer not null default 0,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, song_id)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (playlist_id, song_id)
);

create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  song_id uuid not null references public.songs(id) on delete cascade,
  duration_listened numeric not null default 0,
  song_duration numeric not null default 1,
  skipped boolean not null default false,
  replayed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_type text not null check (plan_type in ('free', 'premium', 'creator_pro')),
  status text not null check (status in ('active', 'canceled', 'past_due')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.song_boosts (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  budget numeric not null check (budget > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null
);

create table if not exists public.ai_song_insights (
  song_id uuid primary key references public.songs(id) on delete cascade,
  predicted_genre text,
  recommended_tags text[],
  model_version text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.songs enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.plays enable row level security;
alter table public.subscriptions enable row level security;
alter table public.song_boosts enable row level security;
alter table public.ai_song_insights enable row level security;

drop policy if exists "users are readable" on public.users;
create policy "users are readable"
  on public.users for select using (true);
drop policy if exists "users can upsert self" on public.users;
create policy "users can upsert self"
  on public.users for insert with check (auth.uid() = id);
drop policy if exists "users can update self" on public.users;
create policy "users can update self"
  on public.users for update using (auth.uid() = id);

drop policy if exists "songs are readable" on public.songs;
create policy "songs are readable"
  on public.songs for select using (true);
drop policy if exists "artists can create own songs" on public.songs;
create policy "artists can create own songs"
  on public.songs for insert with check (auth.uid() = user_id);
drop policy if exists "artists can update own songs" on public.songs;
create policy "artists can update own songs"
  on public.songs for update using (auth.uid() = user_id);

drop policy if exists "likes are readable" on public.likes;
create policy "likes are readable"
  on public.likes for select using (true);
drop policy if exists "users manage own likes" on public.likes;
create policy "users manage own likes"
  on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable"
  on public.follows for select using (true);
drop policy if exists "users manage own follows" on public.follows;
create policy "users manage own follows"
  on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

drop policy if exists "playlists are readable" on public.playlists;
create policy "playlists are readable"
  on public.playlists for select using (true);
drop policy if exists "users manage own playlists" on public.playlists;
create policy "users manage own playlists"
  on public.playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "playlist songs are readable" on public.playlist_songs;
create policy "playlist songs are readable"
  on public.playlist_songs for select using (true);
drop policy if exists "playlist owners manage songs" on public.playlist_songs;
create policy "playlist owners manage songs"
  on public.playlist_songs
  for all
  using (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "plays are readable" on public.plays;
create policy "plays are readable"
  on public.plays for select using (true);
drop policy if exists "plays can be inserted" on public.plays;
create policy "plays can be inserted"
  on public.plays for insert with check (auth.uid() is null or auth.uid() = user_id);

drop policy if exists "users can read own subscriptions" on public.subscriptions;
create policy "users can read own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "boost owner can manage boost" on public.song_boosts;
create policy "boost owner can manage boost"
  on public.song_boosts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "boosts readable" on public.song_boosts;
create policy "boosts readable"
  on public.song_boosts for select using (true);

drop policy if exists "ai insights readable" on public.ai_song_insights;
create policy "ai insights readable"
  on public.ai_song_insights for select using (true);

create or replace view public.song_metrics as
select
  s.id as song_id,
  coalesce(s.likes_count, 0)::numeric as likes,
  coalesce(s.plays_count, 0)::numeric as plays,
  coalesce(avg(case when p.song_duration > 0 then p.duration_listened / p.song_duration else 0 end), 0)::numeric as completion_rate,
  coalesce(avg(case when p.skipped then 1 else 0 end), 0)::numeric as skip_rate,
  coalesce(sum(case when p.replayed then 1 else 0 end), 0)::numeric as replays
from public.songs s
left join public.plays p on p.song_id = s.id
group by s.id;

create or replace view public.song_scores as
select
  s.id as song_id,
  (0.4 * m.likes) + (0.3 * m.completion_rate) + (0.2 * m.plays) - (0.3 * m.skip_rate) as score,
  (
    (coalesce(s.likes_count, 0) + coalesce(s.plays_count, 0) + m.completion_rate + m.replays)
    / ((extract(epoch from (now() - s.created_at)) / 3600.0) + 2.0)
  ) as trending_score
from public.songs s
join public.song_metrics m on m.song_id = s.id;

create or replace function public.get_home_feed(
  input_user_id uuid,
  input_limit integer default 20,
  input_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  audio_url text,
  cover_image_url text,
  genre text,
  plays_count integer,
  likes_count integer,
  created_at timestamptz,
  completion_rate numeric,
  skip_rate numeric,
  trending_score numeric,
  score numeric
)
language sql
stable
as $$
  with user_genres as (
    select s.genre, count(*) as genre_hits
    from public.plays p
    join public.songs s on s.id = p.song_id
    where p.user_id = input_user_id
    group by s.genre
  ),
  ranked as (
    select
      s.*,
      m.completion_rate,
      m.skip_rate,
      sc.trending_score,
      sc.score,
      case
        when ug.genre is not null then 1
        else 0
      end as personalized_flag,
      random() as random_sort
    from public.songs s
    join public.song_metrics m on m.song_id = s.id
    join public.song_scores sc on sc.song_id = s.id
    left join user_genres ug on ug.genre = s.genre
  ),
  buckets as (
    select
      *,
      row_number() over (partition by personalized_flag order by score desc, created_at desc) as personalized_rank,
      row_number() over (order by trending_score desc, created_at desc) as trending_rank,
      row_number() over (order by random_sort) as random_rank
    from ranked
  ),
  mixed as (
    select * from buckets where personalized_flag = 1 and personalized_rank <= ceil(input_limit * 0.6)
    union all
    select * from buckets where trending_rank <= ceil(input_limit * 0.3)
    union all
    select * from buckets where random_rank <= greatest(1, floor(input_limit * 0.1))
  )
  select
    id,
    user_id,
    title,
    audio_url,
    cover_image_url,
    genre,
    plays_count,
    likes_count,
    created_at,
    completion_rate,
    skip_rate,
    trending_score,
    score
  from mixed
  order by score desc, created_at desc
  offset input_offset
  limit input_limit;
$$;

create or replace view public.artist_leaderboard_global as
select
  u.id as artist_id,
  u.username,
  (
    0.4 * coalesce(sum(s.plays_count), 0) +
    0.3 * coalesce(sum(s.likes_count), 0) +
    0.2 * coalesce(avg(sm.completion_rate), 0) +
    0.1 * 0
  ) as artist_score
from public.users u
join public.songs s on s.user_id = u.id
left join public.song_metrics sm on sm.song_id = s.id
group by u.id, u.username
order by artist_score desc;

create or replace view public.artist_leaderboard_rising as
with base as (
  select
    u.id as artist_id,
    u.username,
    coalesce(sum(case when s.created_at >= now() - interval '14 days' then s.plays_count else 0 end), 0)::numeric as recent_plays,
    coalesce(sum(case when s.created_at < now() - interval '14 days' then s.plays_count else 0 end), 0)::numeric as historical_plays,
    coalesce(sum(s.likes_count), 0)::numeric as likes,
    coalesce(avg(sm.completion_rate), 0)::numeric as completion_rate
  from public.users u
  join public.songs s on s.user_id = u.id
  left join public.song_metrics sm on sm.song_id = s.id
  group by u.id, u.username
)
select
  artist_id,
  username,
  (
    0.4 * recent_plays +
    0.3 * likes +
    0.2 * completion_rate +
    0.1 * case when historical_plays = 0 then recent_plays else (recent_plays / historical_plays) end
  ) as artist_score
from base
order by artist_score desc;

create or replace view public.artist_leaderboard_weekly_trending as
with weekly as (
  select
    u.id as artist_id,
    u.username,
    coalesce(sum(p.duration_listened), 0)::numeric as plays,
    coalesce(sum(case when l.id is not null then 1 else 0 end), 0)::numeric as likes,
    coalesce(avg(case when p.song_duration > 0 then p.duration_listened / p.song_duration else 0 end), 0)::numeric as completion_rate
  from public.users u
  join public.songs s on s.user_id = u.id
  left join public.plays p on p.song_id = s.id and p.created_at >= now() - interval '7 days'
  left join public.likes l on l.song_id = s.id and l.created_at >= now() - interval '7 days'
  group by u.id, u.username
)
select
  artist_id,
  username,
  (
    0.4 * plays +
    0.3 * likes +
    0.2 * completion_rate +
    0.1 * plays
  ) as artist_score
from weekly
order by artist_score desc;

grant execute on function public.get_home_feed(uuid, integer, integer) to anon, authenticated;
grant select on public.song_metrics, public.song_scores to anon, authenticated;
grant select on public.artist_leaderboard_global, public.artist_leaderboard_rising, public.artist_leaderboard_weekly_trending to anon, authenticated;
