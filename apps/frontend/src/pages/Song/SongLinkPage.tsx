import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { FiHome, FiMusic } from "react-icons/fi";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSongByIdQuery } from "@/hooks/queries/useSongByIdQuery";
import { usePlayerStore } from "@/store/usePlayerStore";

const COVER_FALLBACK = "/cover-placeholder.svg";

export function SongLinkPage() {
  const { songId } = useParams<{ songId: string }>();
  const { data: song, isLoading, isError } = useSongByIdQuery(songId ?? "", !!songId);
  const { setQueue, playSong } = usePlayerStore();

  useEffect(() => {
    if (!song) return;
    setQueue([song]);
    playSong(song);
  }, [song, setQueue, playSong]);

  if (!songId) {
    return (
      <section>
        <GlassPanel className="p-8 text-center">
          <p className="text-wavee-muted">Invalid link.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-wavee-primary hover:underline">
            Back to home
          </Link>
        </GlassPanel>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-md space-y-4">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </section>
    );
  }

  if (isError || !song) {
    return (
      <section>
        <GlassPanel className="p-8 text-center">
          <FiMusic className="mx-auto mb-3 text-wavee-muted/40" size={40} />
          <p className="text-wavee-muted">This track isn&apos;t available or the link is wrong.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-wavee-primary hover:underline">
            Go to home
          </Link>
        </GlassPanel>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md">
      <GlassPanel className="overflow-hidden p-0">
        <div className="relative aspect-square w-full bg-wavee-surface">
          <img
            src={song.cover_image_url || COVER_FALLBACK}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-wavee-primary">Shared track</p>
          <h1 className="mt-1 text-xl font-bold text-wavee-text">{song.title}</h1>
          {song.artist_name ? (
            <p className="mt-1 text-sm text-wavee-muted">{song.artist_name}</p>
          ) : null}
          <p className="mt-3 text-sm text-wavee-muted">
            Playback has started. Use the player at the bottom to control audio.
          </p>
          <Link
            to="/"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-3 text-sm font-medium text-wavee-text transition-colors hover:bg-white/[0.1]"
          >
            <FiHome size={18} />
            Browse home feed
          </Link>
        </div>
      </GlassPanel>
    </section>
  );
}
