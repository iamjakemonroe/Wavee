-- Home feed (signed-in): better discovery + stable pagination.
--
-- Problems addressed:
-- 1) Final sort was almost only score DESC → same viral tracks dominated every session.
-- 2) random() in row_number() changed each query → exploration bucket shuffled between pages (odd skips/overlaps).
-- 3) No dedicated "new music" slice → recent uploads could lose to genre/trending/random caps.
--
-- Approach:
-- - Stratified UNION (personalized / trending / exploration / fresh) then DISTINCT ON (id).
-- - Exploration uses md5(song_id || user_id) for stable per-user variety (same ordering for a paginated fetch).
-- - fresh_bucket: newest tracks in the last 14 days (quota scales with input_limit).
-- - Final ORDER BY: boost last 7 days, then trending_score, then score, then created_at (deterministic tie-break with id).

DROP FUNCTION IF EXISTS public.get_home_feed(uuid, integer, integer);

CREATE FUNCTION public.get_home_feed(
  input_user_id uuid,
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
      md5(s.id::text || input_user_id::text) AS exploration_key
    FROM public.songs s
    JOIN public.song_metrics m ON m.song_id = s.id
    JOIN public.song_scores sc ON sc.song_id = s.id
    LEFT JOIN user_genres ug ON ug.genre = s.genre
  ),
  buckets AS (
    SELECT
      r.*,
      row_number() OVER (
        PARTITION BY r.personalized_flag
        ORDER BY r.score DESC, r.created_at DESC
      ) AS personalized_rank,
      row_number() OVER (
        ORDER BY r.trending_score DESC NULLS LAST, r.created_at DESC
      ) AS trending_rank,
      row_number() OVER (ORDER BY r.exploration_key) AS exploration_rank
    FROM ranked r
  ),
  fresh_bucket AS (
    SELECT b.*, row_number() OVER (ORDER BY b.created_at DESC) AS fresh_rank
    FROM buckets b
    WHERE b.created_at > (now() - interval '14 days')
  ),
  mixed AS (
    SELECT * FROM buckets
    WHERE personalized_flag = 1 AND personalized_rank <= ceil(input_limit * 0.40)
    UNION ALL
    SELECT * FROM buckets WHERE trending_rank <= ceil(input_limit * 0.25)
    UNION ALL
    SELECT * FROM buckets WHERE exploration_rank <= greatest(2, ceil(input_limit * 0.15))
    UNION ALL
    -- Same columns as `buckets` (fresh_bucket adds fresh_rank; UNION requires identical column lists).
    SELECT b.*
    FROM fresh_bucket fb
    JOIN buckets b ON b.id = fb.id
    WHERE fb.fresh_rank <= greatest(3, ceil(input_limit * 0.30))
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
  ORDER BY
    (d.created_at > (now() - interval '7 days')) DESC,
    d.trending_score DESC NULLS LAST,
    d.score DESC,
    d.created_at DESC,
    d.id
  OFFSET input_offset
  LIMIT input_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_feed(uuid, integer, integer) TO anon, authenticated;
