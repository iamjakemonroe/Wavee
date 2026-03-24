-- ============================================
-- Fix home feed: add artist_name, deduplicate
-- Add plays_count auto-increment trigger
-- Run this in the Supabase SQL Editor
-- ============================================

-- Drop old function first because the return type changed (added artist_name)
DROP FUNCTION IF EXISTS public.get_home_feed(uuid, integer, integer);

CREATE FUNCTION public.get_home_feed(
  input_user_id uuid,
  input_limit integer default 20,
  input_offset integer default 0
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
  WITH user_genres AS (
    SELECT s.genre, count(*) AS genre_hits
    FROM public.plays p
    JOIN public.songs s ON s.id = p.song_id
    WHERE p.user_id = input_user_id
    GROUP BY s.genre
  ),
  ranked AS (
    SELECT
      s.*,
      m.completion_rate,
      m.skip_rate,
      sc.trending_score,
      sc.score,
      CASE WHEN ug.genre IS NOT NULL THEN 1 ELSE 0 END AS personalized_flag,
      random() AS random_sort
    FROM public.songs s
    JOIN public.song_metrics m ON m.song_id = s.id
    JOIN public.song_scores sc ON sc.song_id = s.id
    LEFT JOIN user_genres ug ON ug.genre = s.genre
  ),
  buckets AS (
    SELECT
      *,
      row_number() OVER (PARTITION BY personalized_flag ORDER BY score DESC, created_at DESC) AS personalized_rank,
      row_number() OVER (ORDER BY trending_score DESC, created_at DESC) AS trending_rank,
      row_number() OVER (ORDER BY random_sort) AS random_rank
    FROM ranked
  ),
  mixed AS (
    SELECT * FROM buckets WHERE personalized_flag = 1 AND personalized_rank <= ceil(input_limit * 0.6)
    UNION ALL
    SELECT * FROM buckets WHERE trending_rank <= ceil(input_limit * 0.3)
    UNION ALL
    SELECT * FROM buckets WHERE random_rank <= greatest(1, floor(input_limit * 0.1))
  ),
  deduped AS (
    SELECT DISTINCT ON (id) * FROM mixed ORDER BY id, score DESC
  )
  SELECT
    d.id,
    d.user_id,
    d.title,
    d.audio_url,
    d.cover_image_url,
    d.genre,
    d.plays_count,
    d.likes_count,
    d.created_at,
    d.completion_rate,
    d.skip_rate,
    d.trending_score,
    d.score,
    u.username AS artist_name
  FROM deduped d
  JOIN public.users u ON u.id = d.user_id
  ORDER BY d.score DESC, d.created_at DESC
  OFFSET input_offset
  LIMIT input_limit;
$$;

-- Auto-update songs.plays_count via trigger
CREATE OR REPLACE FUNCTION public.update_song_plays_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.songs SET plays_count = plays_count + 1 WHERE id = NEW.song_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_song_plays_count ON public.plays;
CREATE TRIGGER trigger_update_song_plays_count
  AFTER INSERT ON public.plays
  FOR EACH ROW EXECUTE FUNCTION public.update_song_plays_count();

GRANT EXECUTE ON FUNCTION public.get_home_feed(uuid, integer, integer) TO anon, authenticated;
