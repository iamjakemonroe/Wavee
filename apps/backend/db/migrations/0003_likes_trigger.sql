-- ============================================
-- Auto-update songs.likes_count via trigger
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION public.update_song_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET likes_count = likes_count + 1 WHERE id = NEW.song_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.song_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_song_likes_count ON public.likes;
CREATE TRIGGER trigger_update_song_likes_count
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_song_likes_count();
