-- Public home feed (no personalization) + ranked song/user search

CREATE OR REPLACE FUNCTION public.get_home_feed_public(
  input_limit integer DEFAULT 20,
  input_offset integer DEFAULT 0
)
RETURNS TABLE (
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
  score numeric,
  artist_name text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id,
    s.user_id,
    s.title,
    s.audio_url,
    s.cover_image_url,
    s.genre,
    s.plays_count,
    s.likes_count,
    s.created_at,
    m.completion_rate,
    m.skip_rate,
    sc.trending_score,
    sc.score,
    u.username AS artist_name
  FROM public.songs s
  JOIN public.song_metrics m ON m.song_id = s.id
  JOIN public.song_scores sc ON sc.song_id = s.id
  JOIN public.users u ON u.id = s.user_id
  ORDER BY sc.score DESC, sc.trending_score DESC, s.plays_count DESC, s.likes_count DESC, s.created_at DESC
  OFFSET input_offset
  LIMIT input_limit;
$$;

CREATE OR REPLACE FUNCTION public.search_songs_ranked(
  search_q text,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
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
  score numeric,
  artist_name text
)
LANGUAGE sql
STABLE
AS $$
  WITH pat AS (
    SELECT
      '%' || trim(search_q) || '%' AS p,
      lower(trim(search_q)) AS qlower
  )
  SELECT
    s.id,
    s.user_id,
    s.title,
    s.audio_url,
    s.cover_image_url,
    s.genre,
    s.plays_count,
    s.likes_count,
    s.created_at,
    m.completion_rate,
    m.skip_rate,
    sc.trending_score,
    sc.score,
    u.username AS artist_name
  FROM public.songs s
  JOIN public.users u ON u.id = s.user_id
  JOIN public.song_metrics m ON m.song_id = s.id
  JOIN public.song_scores sc ON sc.song_id = s.id
  CROSS JOIN pat
  WHERE s.title ILIKE pat.p
     OR s.genre ILIKE pat.p
     OR u.username ILIKE pat.p
  ORDER BY
    CASE
      WHEN lower(s.title) = (SELECT qlower FROM pat) THEN 0
      WHEN lower(u.username) = (SELECT qlower FROM pat) THEN 1
      WHEN s.title ILIKE (SELECT qlower FROM pat) || '%' THEN 2
      WHEN u.username ILIKE (SELECT qlower FROM pat) || '%' THEN 3
      ELSE 4
    END,
    (s.likes_count::numeric * 2 + s.plays_count::numeric + coalesce(sc.score, 0) * 50) DESC NULLS LAST,
    s.created_at DESC
  LIMIT result_limit;
$$;

CREATE OR REPLACE FUNCTION public.search_users_ranked(
  search_q text,
  result_limit integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  music_roles text[],
  is_artist boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH pat AS (
    SELECT
      '%' || trim(search_q) || '%' AS p,
      lower(trim(search_q)) AS qlower
  ),
  follower_counts AS (
    SELECT following_id AS user_id, count(*)::bigint AS cnt
    FROM public.follows
    GROUP BY following_id
  )
  SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.music_roles,
    u.is_artist
  FROM public.users u
  LEFT JOIN follower_counts fc ON fc.user_id = u.id
  CROSS JOIN pat
  WHERE u.username ILIKE pat.p
  ORDER BY
    CASE
      WHEN lower(u.username) = (SELECT qlower FROM pat) THEN 0
      WHEN u.username ILIKE (SELECT qlower FROM pat) || '%' THEN 1
      ELSE 2
    END,
    coalesce(fc.cnt, 0) DESC,
    char_length(u.username) ASC,
    u.username ASC
  LIMIT result_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_feed_public(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_songs_ranked(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_ranked(text, integer) TO anon, authenticated;
