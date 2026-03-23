import { useCallback, useEffect, useMemo, useRef } from "react";
import { FeedItem } from "@/components/feed/FeedItem";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { useLikeSongMutation } from "@/hooks/mutations/useLikeSongMutation";
import { useHomeFeedQuery } from "@/hooks/queries/useHomeFeedQuery";
import { mockSongs } from "@/constants/mockSongs";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";

export function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const feedQuery = useHomeFeedQuery(isAuthenticated);
  const likeMutation = useLikeSongMutation();
  const { currentSongId, isPlaying, setQueue, playSong, togglePlay } =
    usePlayerStore();
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const songs = useMemo(() => {
    if (!isAuthenticated) return mockSongs;
    return feedQuery.data?.pages.flat() ?? [];
  }, [feedQuery.data?.pages, isAuthenticated]);

  useEffect(() => {
    if (songs.length > 0) setQueue(songs);
  }, [songs, setQueue]);

  // Autoplay when song scrolls into view
  useEffect(() => {
    const container = feedRef.current;
    if (!container || songs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const songId = (entry.target as HTMLElement).dataset.songId;
          if (!songId) continue;
          const song = songs.find((s) => s.id === songId);
          if (song) playSong(song);
          break;
        }
      },
      { threshold: 0.6 },
    );

    const items = container.querySelectorAll<HTMLElement>("[data-song-id]");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [songs, playSong]);

  // Infinite scroll
  useEffect(() => {
    if (!feedQuery.hasNextPage || !isAuthenticated) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !feedQuery.isFetchingNextPage) {
          void feedQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    feedQuery.hasNextPage,
    feedQuery.isFetchingNextPage,
    feedQuery.fetchNextPage,
    isAuthenticated,
  ]);

  const handleToggle = useCallback(
    (songId: string) => {
      if (currentSongId === songId) {
        togglePlay();
      } else {
        const song = songs.find((s) => s.id === songId);
        if (song) playSong(song);
      }
    },
    [currentSongId, songs, playSong, togglePlay],
  );

  const handleLike = useCallback(
    (songId: string) => likeMutation.mutate(songId),
    [likeMutation],
  );

  if (feedQuery.isLoading && isAuthenticated) {
    return (
      <section>
        <header className="mb-6">
          <h2 className="text-3xl font-black tracking-tight">For You</h2>
          <p className="mt-1 text-sm text-wavee-muted">
            Discover your next favorite track
          </p>
        </header>
        <FeedSkeleton />
      </section>
    );
  }

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">For You</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          {isAuthenticated
            ? "Personalized discovery feed"
            : "Sign in to get personalized recommendations"}
        </p>
      </header>

      <div
        ref={feedRef}
        className="h-[calc(100vh-12rem)] snap-y snap-mandatory space-y-4 overflow-y-auto"
      >
        {songs.map((song) => (
          <FeedItem
            key={song.id}
            song={song}
            isActive={currentSongId === song.id}
            isPlaying={currentSongId === song.id && isPlaying}
            onToggle={() => handleToggle(song.id)}
            onLike={() => handleLike(song.id)}
          />
        ))}

        {feedQuery.hasNextPage && isAuthenticated && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            <span className="text-sm text-wavee-muted">
              {feedQuery.isFetchingNextPage
                ? "Loading more tracks..."
                : "Scroll for more"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
