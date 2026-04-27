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
            className="absolute inset-x-0 bottom-0 top-0 flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col border-l border-white/[0.04] bg-wavee-bg bg-wavee-gradient shadow-[0_-8px_64px_rgba(0,0,0,0.4)] safe-top safe-bottom lg:border-l-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[min(45dvh,320px)] bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(0,209,160,0.1),transparent_65%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none h-px shrink-0 bg-gradient-to-r from-transparent via-wavee-primary/35 to-transparent"
              aria-hidden
            />
            <header className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Close"
              >
                <FiChevronDown size={20} strokeWidth={2} />
              </button>
              <div className="h-9 w-9" aria-hidden />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
              <div className="mx-auto flex w-full min-h-[min(calc(90dvh-2.75rem),calc(100dvh-2.75rem))] max-w-md flex-col items-center justify-center gap-3 px-4 py-1 sm:px-6 min-[800px]:min-h-[min(88dvh,40rem)]">
                {/* Futuristic art frame: gradient rim + soft radial bloom */}
                <div className="relative w-full max-w-[min(100%,24rem)] max-h-[min(52dvh,88vw,24rem)]">
                  <div
                    className="pointer-events-none absolute -inset-3 rounded-3xl opacity-70 blur-2xl"
                    style={{
                      background:
                        "radial-gradient(60% 60% at 50% 100%, rgba(0, 209, 160, 0.18), transparent 70%)",
                    }}
                    aria-hidden
                  />
                  <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.14] to-white/[0.03] p-[1px] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <div
                      className="relative aspect-square w-full max-h-[min(52dvh,88vw,24rem)] overflow-hidden rounded-[15px] bg-[#0a0a0c]"
                    >
                      <img
                        src={currentSong.cover_image_url || COVER_FALLBACK}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[0.04]" />
                      {isPlaying && !progressIndeterminate && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
                          <WaveformBar isPlaying barCount={5} className="h-5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex w-full max-w-md items-start gap-3 sm:mt-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-balance text-xl font-semibold leading-snug tracking-[-0.02em] text-white/95 sm:text-2xl">
                      {currentSong.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/40">
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
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${isLiked
                        ? "border-wavee-primary/40 bg-wavee-primary/10 text-wavee-primary shadow-[0_0_32px_-10px_rgba(0,209,160,0.45)]"
                        : "border-white/[0.1] bg-white/[0.03] text-white/50 ring-1 ring-inset ring-white/[0.04] hover:border-wavee-primary/30 hover:text-wavee-primary"
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

                <div className="w-full max-w-md">
                  <ProgressBar
                    progress={progress}
                    duration={duration}
                    onSeek={seek}
                    indeterminate={progressIndeterminate}
                    className="!h-1.5"
                  />
                  <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-white/45">
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

                <div className="flex w-full max-w-md items-center justify-center gap-8 sm:mb-1 sm:gap-12">
                  <button
                    type="button"
                    onClick={previous}
                    className="rounded-full p-2.5 text-white/45 ring-1 ring-inset ring-white/[0.06] transition-all hover:bg-white/[0.06] hover:text-white/95"
                    aria-label="Previous"
                  >
                    <FiSkipBack size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-wavee-primary text-[#0a0a0c] shadow-[0_0_40px_-6px_rgba(0,209,160,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:h-16 sm:w-16"
                    aria-label={
                      !isPlaying
                        ? "Play"
                        : progressIndeterminate
                          ? "Loading"
                          : "Pause"
                    }
                  >
                    {!isPlaying ? (
                      <FiPlay
                        size={24}
                        className="ml-0.5"
                        strokeWidth={2.25}
                      />
                    ) : progressIndeterminate ? (
                      <span
                        className="inline-block h-5 w-5 shrink-0 rounded-full border-2 border-black/20 border-t-black/70 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <FiPause size={24} strokeWidth={2.25} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="rounded-full p-2.5 text-white/45 ring-1 ring-inset ring-white/[0.06] transition-all hover:bg-white/[0.06] hover:text-white/95"
                    aria-label="Next"
                  >
                    <FiSkipForward size={20} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="mx-4 h-px max-w-md shrink-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent sm:mx-auto" aria-hidden />

              <section
                className="mx-auto w-full max-w-md px-4 pb-10 pt-5 sm:px-6"
                aria-label="Artist"
              >
                {profileQuery.isLoading && (
                  <GlassPanel className="space-y-3 border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </GlassPanel>
                )}
                {profileQuery.isError && (
                  <GlassPanel className="border-white/[0.08] bg-white/[0.02] p-5 text-sm text-wavee-muted">
                    Couldn&apos;t load artist info.
                  </GlassPanel>
                )}
                {profile && !profileQuery.isLoading && (
                  <GlassPanel className="overflow-hidden border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-0 shadow-[0_0_48px_-24px_rgba(0,209,160,0.2)]">
                    <div className="relative aspect-[21/9] w-full overflow-hidden border-b border-white/[0.05] bg-[#0c0c0f]">
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
                    </div>
                    <div className="space-y-3 p-4 sm:p-5">
                      <div>
                        <p className="text-base font-medium tracking-[-0.01em] text-white/90 sm:text-lg">
                          {profile.username}
                        </p>
                        {roleLabel && (
                          <p className="mt-1 text-xs text-white/35 sm:text-sm">
                            {roleLabel}
                          </p>
                        )}
                      </div>
                      {profile.bio ? (
                        <p className="text-sm leading-relaxed text-white/50">
                          {profile.bio}
                        </p>
                      ) : (
                        <p className="text-sm text-white/35">No bio yet.</p>
                      )}
                      <Link
                        to={`/users/${profile.id}`}
                        onClick={close}
                        className="group inline-flex items-center gap-1.5 text-sm font-medium text-wavee-primary transition-colors hover:text-white"
                      >
                        <span className="border-b border-transparent transition-colors group-hover:border-wavee-primary/50">
                          Profile
                        </span>
                        <span className="text-white/20 transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
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
