import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiMusic, FiPause, FiPlay, FiUser } from "react-icons/fi";
import { AddToPlaylistSheet } from "@/components/music/AddToPlaylistSheet";
import { SongCard } from "@/components/music/SongCard";
import { PlaylistSongSearchBar } from "@/components/playlist/PlaylistSongSearchBar";
import { PlaylistSongOptionsSheet } from "@/components/playlist/PlaylistSongOptionsSheet";
import {
  DetailPageHeroSkeleton,
  DetailPageTrackListSkeleton,
} from "@/components/layout/DetailPageSkeleton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMusicRoles } from "@/constants/musicRoles";
import { useLikeSongMutation } from "@/hooks/mutations/useLikeSongMutation";
import { useMyLikesQuery } from "@/hooks/queries/useMyLikesQuery";
import { useUserSongsQuery } from "@/hooks/queries/useUserSongsQuery";
import { useUserSongsSearchQuery } from "@/hooks/queries/useUserSongsSearchQuery";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import type { Song } from "@/types/entities";

const HERO_IMAGE_MASK =
  "linear-gradient(to bottom, #000 0%, #000 36%, rgba(0,0,0,0.55) 58%, transparent 92%)";

const SEARCH_DEBOUNCE_MS = 280;

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [optionsSong, setOptionsSong] = useState<Song | null>(null);
  const [addToPlaylist, setAddToPlaylist] = useState<{ songId: string; title: string } | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, isError } = useUserSongsQuery(userId ?? "", !!userId);
  const searchQuery = useUserSongsSearchQuery(
    userId ?? "",
    debouncedSearch,
    isAuthenticated && !!userId,
  );
  const myLikesQuery = useMyLikesQuery(isAuthenticated);
  const likeMutation = useLikeSongMutation();
  const { currentSongId, isPlaying, setQueue, playSong, togglePlay } = usePlayerStore();

  const profile = data?.user;
  const songs = data?.songs ?? [];

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
  }, [userId]);

  const likedSet = useMemo(() => new Set(myLikesQuery.data ?? []), [myLikesQuery.data]);

  const isSearchMode = debouncedSearch.length >= 1;
  const searchResults = searchQuery.data ?? [];
  const displaySongs = isSearchMode ? searchResults : songs;

  const playingThisProfile = useMemo(
    () => Boolean(currentSongId && songs.some((s) => s.id === currentSongId)),
    [currentSongId, songs],
  );
  const heroShowsPause = playingThisProfile && isPlaying;

  const playAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0]!);
  };

  const playSongFromProfile = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;
    setQueue(songs);
    playSong(song);
  };

  const roleLabel =
    profile && (formatMusicRoles(profile.music_roles) ?? (profile.is_artist ? "Artist" : null));

  const searchHint =
    isSearchMode && !searchQuery.isFetching
      ? searchResults.length === 0
        ? "No matches for this artist"
        : `${searchResults.length} ${searchResults.length === 1 ? "match" : "matches"}`
      : undefined;

  if (isLoading) {
    return (
      <section>
        <DetailPageHeroSkeleton />
        <DetailPageTrackListSkeleton rows={5} />
      </section>
    );
  }

  if (isError || !profile) {
    return (
      <section>
        <GlassPanel className="p-10 text-center">
          <p className="text-wavee-muted">We couldn&apos;t load this profile.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 text-sm font-medium text-wavee-primary hover:underline"
          >
            Go back
          </button>
        </GlassPanel>
      </section>
    );
  }

  const hasAvatar = Boolean(profile.avatar_url);
  const optionsOpen = optionsSong !== null;
  const showTrackSearch = songs.length > 0;

  return (
    <section>
      <div className="relative -mx-4 -mt-4 mb-5 min-h-[200px] sm:-mx-6 sm:-mt-6 sm:min-h-[220px]">
        <div
          className="pointer-events-none absolute inset-0 min-h-[200px] bg-wavee-bg bg-wavee-gradient sm:min-h-[220px]"
          aria-hidden
        />
        {hasAvatar ? (
          <img
            src={profile.avatar_url!}
            alt=""
            className="absolute inset-0 h-full min-h-[200px] w-full object-cover object-center sm:min-h-[220px]"
            style={{
              maskImage: HERO_IMAGE_MASK,
              WebkitMaskImage: HERO_IMAGE_MASK,
            }}
          />
        ) : (
          <div
            className="absolute inset-0 flex min-h-[200px] items-center justify-center bg-gradient-to-b from-zinc-700 via-zinc-900 to-wavee-bg sm:min-h-[220px]"
            style={{
              maskImage: HERO_IMAGE_MASK,
              WebkitMaskImage: HERO_IMAGE_MASK,
            }}
            aria-hidden
          >
            <FiUser className="text-white/25" size={72} strokeWidth={1} />
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
              onClick={() => navigate(-1)}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-black/25 hover:text-white"
            >
              <FiArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl">
                {profile.username}
              </h1>
              {roleLabel ? (
                <p className="mt-0.2 text-sm text-white/60 font-medium">{roleLabel}</p>
              ) : null}
              {/* <p className="mt-0.2 text-sm text-white/60">
                {songs.length} {songs.length === 1 ? "song" : "songs"}
              </p> */}
              {profile.bio ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">{profile.bio}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center pt-1">
            {songs.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (playingThisProfile) {
                    togglePlay();
                  } else {
                    playAll();
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wavee-primary text-black shadow-[0_0_18px_rgba(0,209,160,0.28)] transition-transform hover:scale-105 active:scale-95"
                aria-label={
                  heroShowsPause
                    ? "Pause"
                    : playingThisProfile
                      ? "Resume"
                      : "Play all"
                }
              >
                {heroShowsPause ? (
                  <FiPause size={18} strokeWidth={2.5} />
                ) : (
                  <FiPlay size={18} className="ml-0.5" fill="currentColor" />
                )}
              </button>
            ) : (
              <p className="text-sm text-white/55">No uploads yet</p>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && userId && (
        <>
          <PlaylistSongOptionsSheet
            open={optionsOpen}
            onOpenChange={(open) => !open && setOptionsSong(null)}
            song={optionsSong}
            isLiked={optionsSong ? likedSet.has(optionsSong.id) : false}
            likePending={likeMutation.isPending}
            removePending={false}
            showRemoveFromPlaylist={false}
            onPlay={() => {
              if (!optionsSong) return;
              const id = optionsSong.id;
              setOptionsSong(null);
              playSongFromProfile(id);
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
            onRemoveFromPlaylist={async () => { }}
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

      {showTrackSearch && (
        <PlaylistSongSearchBar
          value={searchInput}
          onChange={setSearchInput}
          hint={
            isSearchMode
              ? searchQuery.isFetching
                ? "Searching…"
                : searchHint
              : "Filter tracks from this artist"
          }
        />
      )}

      {songs.length > 0 ? (
        <>
          {isSearchMode && searchQuery.isError ? (
            <GlassPanel className="mb-4 border border-wavee-danger/20 bg-wavee-danger/[0.06] p-4 text-center text-sm text-wavee-danger">
              Couldn&apos;t search these tracks. Try again.
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
                  isPlaying={currentSongId === song.id && isPlaying}
                  meta="none"
                  onPlay={() => playSongFromProfile(song.id)}
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
            {profile.username} hasn&apos;t uploaded any tracks yet.
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
