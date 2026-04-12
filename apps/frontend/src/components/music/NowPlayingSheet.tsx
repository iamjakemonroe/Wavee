import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiChevronDown,
  FiHeart,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
} from "react-icons/fi";
import { ProgressBar } from "@/components/music/ProgressBar";
import { WaveformBar } from "@/components/music/WaveformBar";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMusicRoles } from "@/constants/musicRoles";
import { useLikeSongMutation } from "@/hooks/mutations/useLikeSongMutation";
import { useMyLikesQuery } from "@/hooks/queries/useMyLikesQuery";
import { useUserSongsQuery } from "@/hooks/queries/useUserSongsQuery";
import { useRequireAuthAction } from "@/hooks/useRequireAuthAction";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatTime } from "@/utils/format";

const COVER_FALLBACK = "/cover-placeholder.svg";

export function NowPlayingSheet() {
  const { isAuthenticated } = useAuthStore();
  const { run: withAuth } = useRequireAuthAction();
  const likeMutation = useLikeSongMutation();
  const myLikesQuery = useMyLikesQuery(isAuthenticated);

  const {
    queue,
    currentSongId,
    isPlaying,
    progress,
    duration,
    audioElementPlaying,
    audioBuffering,
    nowPlayingExpanded,
    setNowPlayingExpanded,
    togglePlay,
    next,
    previous,
    seek,
  } = usePlayerStore();

  const progressIndeterminate =
    isPlaying && (!audioElementPlaying || audioBuffering);

  const currentSong = queue.find((s) => s.id === currentSongId) ?? null;
  const artistUserId = currentSong?.user_id ?? "";

  const profileQuery = useUserSongsQuery(
    artistUserId,
    nowPlayingExpanded && !!artistUserId,
  );

  const profile = profileQuery.data?.user;
  const isLiked = currentSongId
    ? (myLikesQuery.data ?? []).includes(currentSongId)
    : false;

  const roleLabel =
    profile &&
    (formatMusicRoles(profile.music_roles) ??
      (profile.is_artist ? "Artist" : null));

  useEffect(() => {
    if (!currentSongId) setNowPlayingExpanded(false);
  }, [currentSongId, setNowPlayingExpanded]);

  useEffect(() => {
    if (!nowPlayingExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [nowPlayingExpanded]);

  const close = () => setNowPlayingExpanded(false);

  const remaining =
    duration > 0 && Number.isFinite(duration)
      ? Math.max(0, duration - progress)
      : 0;

  return (
    <AnimatePresence>
      {nowPlayingExpanded && currentSong && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] lg:left-64"
        >
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={close}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            className="absolute inset-x-0 bottom-0 top-0 flex max-h-[100dvh] flex-col border-l border-white/[0.06] bg-wavee-bg bg-wavee-gradient shadow-[0_-12px_48px_rgba(0,0,0,0.55)] safe-top safe-bottom lg:border-l-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none h-px shrink-0 bg-gradient-to-r from-transparent via-wavee-primary/45 to-transparent"
              aria-hidden
            />
            <header className="flex shrink-0 items-center justify-between px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <FiChevronDown size={20} strokeWidth={2} />
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-[0.38em] text-white/35">
                Now playing
              </span>
              <div className="h-9 w-9" aria-hidden />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-1 sm:px-6">
              <div className="mx-auto flex w-full max-w-md flex-col items-center">
                <div
                  className="relative aspect-square w-full max-w-[min(100%,20rem)] overflow-hidden rounded-2xl border border-white/[0.07] ring-1 ring-white/[0.04] shadow-[0_0_48px_-16px_rgba(0,209,160,0.22),0_16px_48px_rgba(0,0,0,0.45)]"
                >
                  <img
                    src={currentSong.cover_image_url || COVER_FALLBACK}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/[0.03]" />
                  {isPlaying && !progressIndeterminate && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                      <WaveformBar isPlaying barCount={5} className="h-5" />
                    </div>
                  )}
                </div>

                <div className="mt-5 flex w-full items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">
                      {currentSong.title}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-white/45">
                      {currentSong.artist_name ?? currentSong.genre}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      withAuth(
                        () => currentSongId && likeMutation.mutate(currentSongId),
                        "Sign in to like songs",
                      )
                    }
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isLiked
                        ? "border-wavee-primary/35 bg-wavee-primary/12 text-wavee-primary shadow-[0_0_20px_-8px_rgba(0,209,160,0.5)]"
                        : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:border-wavee-primary/25 hover:text-wavee-primary"
                    }`}
                    aria-label={isLiked ? "Unlike" : "Like"}
                  >
                    <FiHeart
                      size={17}
                      strokeWidth={2}
                      className={isLiked ? "fill-current" : ""}
                    />
                  </button>
                </div>

                <div className="mt-5 w-full">
                  <ProgressBar
                    progress={progress}
                    duration={duration}
                    onSeek={seek}
                    indeterminate={progressIndeterminate}
                    className="!h-5"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] tabular-nums tracking-wide text-white/35">
                    <span>
                      {progressIndeterminate ? "--:--" : formatTime(progress)}
                    </span>
                    <span>
                      {duration > 0 && !progressIndeterminate
                        ? `-${formatTime(remaining)}`
                        : "--:--"}
                    </span>
                  </div>
                </div>

                <div className="mt-7 flex w-full items-center justify-center gap-6 sm:gap-10">
                  <button
                    type="button"
                    onClick={previous}
                    className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/90"
                    aria-label="Previous"
                  >
                    <FiSkipBack size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-wavee-primary text-black shadow-[0_0_24px_-6px_rgba(0,209,160,0.65)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    aria-label={
                      !isPlaying
                        ? "Play"
                        : progressIndeterminate
                          ? "Loading"
                          : "Pause"
                    }
                  >
                    {!isPlaying ? (
                      <FiPlay size={20} className="ml-0.5" strokeWidth={2.25} />
                    ) : progressIndeterminate ? (
                      <span
                        className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-black/20 border-t-black/70 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <FiPause size={20} strokeWidth={2.25} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/90"
                    aria-label="Next"
                  >
                    <FiSkipForward size={20} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <section className="mx-auto mt-9 w-full max-w-md">
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30">
                  About the artist
                </h3>
                {profileQuery.isLoading && (
                  <GlassPanel className="space-y-3 p-4">
                    <Skeleton className="h-36 w-full rounded-xl" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </GlassPanel>
                )}
                {profileQuery.isError && (
                  <GlassPanel className="p-5 text-sm text-wavee-muted">
                    Couldn&apos;t load artist info.
                  </GlassPanel>
                )}
                {profile && !profileQuery.isLoading && (
                  <GlassPanel className="overflow-hidden p-0">
                    <div className="relative aspect-[21/9] w-full overflow-hidden bg-wavee-surface">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-wavee-primary/25 to-wavee-secondary/15">
                          <span className="text-4xl font-black text-white/40">
                            {profile.username.slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>
                    <div className="space-y-2 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-wavee-text">
                            {profile.username}
                          </p>
                          {roleLabel && (
                            <p className="mt-0.5 text-sm text-wavee-muted">
                              {roleLabel}
                            </p>
                          )}
                        </div>
                      </div>
                      {profile.bio ? (
                        <p className="text-sm leading-relaxed text-wavee-muted">
                          {profile.bio}
                        </p>
                      ) : (
                        <p className="text-sm text-wavee-muted/80">
                          No bio yet.
                        </p>
                      )}
                      <Link
                        to={`/users/${profile.id}`}
                        onClick={close}
                        className="inline-block pt-1 text-sm font-semibold text-wavee-primary hover:underline"
                      >
                        View profile
                      </Link>
                    </div>
                  </GlassPanel>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
