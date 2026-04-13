import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiChevronRight, FiMusic, FiPause, FiPlay } from "react-icons/fi";
import { AddToPlaylistSheet } from "@/components/music/AddToPlaylistSheet";
import { SongCard } from "@/components/music/SongCard";
import { PlaylistFormSheet } from "@/components/playlist/PlaylistFormSheet";
import { PlaylistSongSearchBar } from "@/components/playlist/PlaylistSongSearchBar";
import { PlaylistSongOptionsSheet } from "@/components/playlist/PlaylistSongOptionsSheet";
import {
  DetailPageHeroSkeleton,
  DetailPageTrackListSkeleton,
} from "@/components/layout/DetailPageSkeleton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLikeSongMutation } from "@/hooks/mutations/useLikeSongMutation";
import { useRemoveSongFromPlaylistMutation } from "@/hooks/mutations/useRemoveSongFromPlaylistMutation";
import { useMyLikesQuery } from "@/hooks/queries/useMyLikesQuery";
import { usePlaylistSongsQuery } from "@/hooks/queries/usePlaylistSongsQuery";
import { usePlaylistSongsSearchQuery } from "@/hooks/queries/usePlaylistSongsSearchQuery";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import type { Song } from "@/types/entities";

/** Fades cover out at the bottom so the app’s wavee-bg + wavee-gradient shows through (matches main chrome). */
const HERO_IMAGE_MASK =
  "linear-gradient(to bottom, #000 0%, #000 36%, rgba(0,0,0,0.55) 58%, transparent 92%)";

const SEARCH_DEBOUNCE_MS = 280;

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [optionsSong, setOptionsSong] = useState<Song | null>(null);
  const [addToPlaylist, setAddToPlaylist] = useState<{ songId: string; title: string } | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading } = usePlaylistSongsQuery(playlistId ?? "");
  const searchQuery = usePlaylistSongsSearchQuery(
    playlistId ?? "",
    debouncedSearch,
    isAuthenticated && !!playlistId,
  );
  const myLikesQuery = useMyLikesQuery(isAuthenticated);
  const likeMutation = useLikeSongMutation();
  const removeMutation = useRemoveSongFromPlaylistMutation();
  const {
    currentSongId,
    isPlaying,
    audioElementPlaying,
    audioBuffering,
    setQueue,
    playSong,
    togglePlay,
  } = usePlayerStore();

  const playlist = data?.playlist;
  const songs = data?.songs ?? [];

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
  }, [playlistId]);

  const likedSet = useMemo(() => new Set(myLikesQuery.data ?? []), [myLikesQuery.data]);

  const isSearchMode = debouncedSearch.length >= 1;
  const searchResults = searchQuery.data ?? [];
  const displaySongs = isSearchMode ? searchResults : songs;

  const playingThisPlaylist = useMemo(
    () => Boolean(currentSongId && songs.some((s) => s.id === currentSongId)),
    [currentSongId, songs],
  );
  const playlistProgressIndeterminate =
    playingThisPlaylist && isPlaying && (!audioElementPlaying || audioBuffering);

  const playAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0]!);
  };

  const playSongFromPlaylist = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;
    setQueue(songs);
    playSong(song);
  };

  const handleRemoveFromPlaylist = async () => {
    if (!playlistId || !optionsSong) return;
    await removeMutation.mutateAsync({ playlistId, songId: optionsSong.id });
    setOptionsSong(null);
  };

  // const searchHint =
  //   isSearchMode && !searchQuery.isFetching
  //     ? searchResults.length === 0
  //       ? "No matches in this playlist"
  //       : `${searchResults.length} ${searchResults.length === 1 ? "match" : "matches"}`
  //     : undefined;

  if (isLoading) {
    return (
      <section>
        <DetailPageHeroSkeleton />
        <DetailPageTrackListSkeleton rows={5} />
      </section>
    );
  }

  const hasCover = Boolean(playlist?.cover_image_url);
  const optionsOpen = optionsSong !== null;
  const showPlaylistSearch = isAuthenticated && songs.length > 0;

  return (
    <section>
      <div className="relative -mx-4 -mt-4 mb-5 min-h-[200px] sm:-mx-6 sm:-mt-6 sm:min-h-[220px]">
        <div
          className="pointer-events-none absolute inset-0 min-h-[200px] bg-wavee-bg bg-wavee-gradient sm:min-h-[220px]"
          aria-hidden
        />
        {hasCover ? (
          <img
            src={playlist!.cover_image_url!}
            alt=""
            className="absolute inset-0 h-full min-h-[200px] w-full object-cover object-center sm:min-h-[220px]"
            style={{
              maskImage: HERO_IMAGE_MASK,
              WebkitMaskImage: HERO_IMAGE_MASK,
            }}
          />
        ) : (
          <div
            className="absolute inset-0 flex min-h-[200px] items-center justify-center bg-gradient-to-b from-zinc-800 via-zinc-900 to-wavee-bg sm:min-h-[220px]"
            style={{
              maskImage: HERO_IMAGE_MASK,
              WebkitMaskImage: HERO_IMAGE_MASK,
            }}
            aria-hidden
          >
            <FiMusic className="text-white/20" size={80} strokeWidth={1.15} />
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 min-h-[200px] bg-gradient-to-b from-black/50 via-black/25 via-[45%] to-transparent sm:min-h-[220px]"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[200px] flex-col px-4 pb-5 pt-2 sm:min-h-[220px] sm:px-6 sm:pb-6 sm:pt-3">
          <div className="mb-4 flex items-start gap-3 sm:mb-5">
            <button
              type="button"
              onClick={() => navigate("/playlists")}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-black/25 hover:text-white"
            >
              <FiArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!isAuthenticated || !playlist}
                onClick={() => playlist && setEditOpen(true)}
                className="group flex w-full max-w-full items-center gap-1 text-left disabled:pointer-events-none disabled:opacity-60"
              >
                <h1 className="text-3xl font-black leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl">
                  {playlist?.name ?? "Playlist"}
                </h1>
                {isAuthenticated && playlist && (
                  <FiChevronRight
                    className="shrink-0 text-white/55"
                    size={22}
                    aria-hidden
                  />
                )}
              </button>
              {playlist && (
                <p className="mt-1.5 text-sm text-white/60">
                  {songs.length} {songs.length === 1 ? "song" : "songs"}
                </p>
              )}
              {playlist?.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                  {playlist.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center pt-1">
            {songs.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (playingThisPlaylist) {
                    togglePlay();
                  } else {
                    playAll();
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wavee-primary text-black shadow-[0_0_18px_rgba(0,209,160,0.28)] transition-transform hover:scale-105 active:scale-95"
                aria-label={
                  playingThisPlaylist && isPlaying && !playlistProgressIndeterminate
                    ? "Pause"
                    : playingThisPlaylist
                      ? playlistProgressIndeterminate
                        ? "Loading"
                        : "Resume playlist"
                      : "Play playlist"
                }
              >
                {!playingThisPlaylist || !isPlaying ? (
                  <FiPlay size={18} className="ml-0.5" fill="currentColor" />
                ) : playlistProgressIndeterminate ? (
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-black/25 border-t-black/80 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <FiPause size={18} strokeWidth={2.5} />
                )}
              </button>
            ) : (
              <p className="text-sm text-white/55">Browse the feed to build this playlist</p>
            )}
          </div>
        </div>
      </div>

      {playlist && isAuthenticated && (
        <PlaylistFormSheet
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          playlist={playlist}
        />
      )}

      {isAuthenticated && playlistId && (
        <>
          <PlaylistSongOptionsSheet
            open={optionsOpen}
            onOpenChange={(open) => !open && setOptionsSong(null)}
            song={optionsSong}
            isLiked={optionsSong ? likedSet.has(optionsSong.id) : false}
            likePending={likeMutation.isPending}
            removePending={removeMutation.isPending}
            onPlay={() => {
              if (!optionsSong) return;
              const id = optionsSong.id;
              setOptionsSong(null);
              playSongFromPlaylist(id);
            }}
            onAddToPlaylist={() => {
              if (!optionsSong) return;
              const payload = { songId: optionsSong.id, title: optionsSong.title };
              setOptionsSong(null);
              setAddToPlaylist(payload);
            }}
            onToggleLike={() => {
              if (!optionsSong) return;
              likeMutation.mutate(optionsSong.id);
            }}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
          />

          {addToPlaylist && (
            <AddToPlaylistSheet
              songId={addToPlaylist.songId}
              songTitle={addToPlaylist.title}
              open
              onClose={() => setAddToPlaylist(null)}
            />
          )}
        </>
      )}

      {showPlaylistSearch && (
        <PlaylistSongSearchBar
          value={searchInput}
          onChange={setSearchInput}
        // hint={
        //   isSearchMode
        //     ? searchQuery.isFetching
        //       ? "Searching…"
        //       : searchHint
        //     : "Filter tracks in this playlist"
        // }
        />
      )}

      {songs.length > 0 ? (
        <>
          {isSearchMode && searchQuery.isError ? (
            <GlassPanel className="mb-4 border border-wavee-danger/20 bg-wavee-danger/[0.06] p-4 text-center text-sm text-wavee-danger">
              Couldn&apos;t search this playlist. Try again.
            </GlassPanel>
          ) : null}
          {isSearchMode && searchQuery.isFetching ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-3"
                >
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : isSearchMode && displaySongs.length === 0 ? (
            <GlassPanel className="border-white/[0.06] p-10 text-center">
              <p className="text-sm text-wavee-muted">
                No songs match{" "}
                <span className="font-medium text-wavee-text">&quot;{debouncedSearch}&quot;</span>
              </p>
            </GlassPanel>
          ) : (
            <div className="space-y-2">
              {displaySongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isActive={currentSongId === song.id}
                  meta="none"
                  onPlay={() => playSongFromPlaylist(song.id)}
                  onMore={isAuthenticated ? () => setOptionsSong(song) : undefined}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <GlassPanel className="p-12 text-center">
          <FiMusic className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">
            This playlist is empty. Discover tracks on the home feed and add them with the + menu on
            each song.
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
