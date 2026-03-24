import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeedItem } from "@/components/feed/FeedItem";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { AddToPlaylistSheet } from "@/components/music/AddToPlaylistSheet";
import { useLikeSongMutation } from "@/hooks/mutations/useLikeSongMutation";
import { useMyLikesQuery } from "@/hooks/queries/useMyLikesQuery";
import { useHomeFeedQuery } from "@/hooks/queries/useHomeFeedQuery";
import { mockSongs } from "@/constants/mockSongs";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";

export function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const feedQuery = useHomeFeedQuery(isAuthenticated);
  const likeMutation = useLikeSongMutation();
  const myLikesQuery = useMyLikesQuery(isAuthenticated);
  const likedSet = useMemo(
    () => new Set(myLikesQuery.data ?? []),
    [myLikesQuery.data],
  );

  const { currentSongId, isPlaying, setQueue, playSong, togglePlay } =
    usePlayerStore();
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [playlistSheet, setPlaylistSheet] = useState<{
    songId: string;
    title: string;
  } | null>(null);

  const songs = useMemo(() => {
    if (!isAuthenticated) return mockSongs;
    return feedQuery.data?.pages.flat() ?? [];
  }, [feedQuery.data?.pages, isAuthenticated]);

  useEffect(() => {
    if (songs.length > 0) setQueue(songs);
  }, [songs, setQueue]);

  useEffect(() => {
    const container = feedRef.current;
    if (!container || songs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const songId = (entry.target as HTMLElement).dataset.songId;
          if (!songId) continue;

          const state = usePlayerStore.getState();
          if (songId === state.currentSongId && state.userPaused) continue;

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
    (songId: string) => {
      if (!isAuthenticated) return;
      likeMutation.mutate(songId);
    },
    [likeMutation, isAuthenticated],
  );

  const handleAddToPlaylist = useCallback(
    (songId: string, title: string) => {
      if (!isAuthenticated) return;
      setPlaylistSheet({ songId, title });
    },
    [isAuthenticated],
  );

  if (feedQuery.isLoading && isAuthenticated) {
    return (
      <section>
        <header className="mb-4 sm:mb-6">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            For You
          </h2>
          <p className="mt-1 text-xs text-wavee-muted sm:text-sm">
            Discover your next favorite track
          </p>
        </header>
        <FeedSkeleton />
      </section>
    );
  }

  return (
    <>
      <section className="flex h-feed flex-col">
        <header className="mb-2 shrink-0 sm:mb-4">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            For You
          </h2>
          <p className="mt-1 text-xs text-wavee-muted sm:text-sm">
            {isAuthenticated
              ? "Personalized discovery feed"
              : "Sign in to get personalized recommendations"}
          </p>
        </header>

        <div
          ref={feedRef}
          className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto scrollbar-hide"
        >
          {songs.map((song) => (
            <FeedItem
              key={song.id}
              song={song}
              isActive={currentSongId === song.id}
              isPlaying={currentSongId === song.id && isPlaying}
              isLiked={likedSet.has(song.id)}
              onToggle={() => handleToggle(song.id)}
              onLike={() => handleLike(song.id)}
              onAddToPlaylist={() =>
                handleAddToPlaylist(song.id, song.title)
              }
            />
          ))}

          {feedQuery.hasNextPage && isAuthenticated && (
            <div
              ref={sentinelRef}
              className="flex h-full shrink-0 snap-start items-center justify-center"
            >
              <span className="text-sm text-wavee-muted">
                {feedQuery.isFetchingNextPage
                  ? "Loading more tracks..."
                  : "Scroll for more"}
              </span>
            </div>
          )}
        </div>
      </section>

      {playlistSheet && (
        <AddToPlaylistSheet
          open
          songId={playlistSheet.songId}
          songTitle={playlistSheet.title}
          onClose={() => setPlaylistSheet(null)}
        />
      )}
    </>
  );
}
