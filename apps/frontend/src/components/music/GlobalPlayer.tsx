import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiChevronUp,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
  FiVolume2,
} from "react-icons/fi";
import { usePlayerStore } from "@/store/usePlayerStore";
import { ProgressBar } from "@/components/music/ProgressBar";
import { WaveformBar } from "@/components/music/WaveformBar";
import { formatTime } from "@/utils/format";

const COVER_FALLBACK = "/cover-placeholder.svg";

export function GlobalPlayer() {
  const {
    queue,
    currentSongId,
    isPlaying,
    progress,
    duration,
    volume,
    audioElementPlaying,
    audioBuffering,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    setNowPlayingExpanded,
  } = usePlayerStore();

  const progressIndeterminate =
    isPlaying && (!audioElementPlaying || audioBuffering);

  const currentSong = useMemo(
    () => queue.find((s) => s.id === currentSongId) ?? null,
    [queue, currentSongId],
  );

  return (
    <AnimatePresence>
      {currentSong && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed left-0 right-0 z-40 border-t border-white/[0.06] bg-wavee-bg/90 backdrop-blur-2xl bottom-nav-offset lg:bottom-0 lg:left-64"
        >
          <ProgressBar
            progress={progress}
            duration={duration}
            onSeek={seek}
            indeterminate={progressIndeterminate}
            className="absolute -top-2.5 left-0 right-0"
          />

          <div className="flex items-center gap-2 px-3 pb-4 sm:gap-3 sm:px-5 sm:py-3">
            <button
              type="button"
              onClick={() => setNowPlayingExpanded(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-white/[0.04]"
              aria-label="Open now playing"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg sm:h-11 sm:w-11">
                <img
                  src={currentSong.cover_image_url || COVER_FALLBACK}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    {progressIndeterminate ? (
                      <div
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-white/25 border-t-wavee-primary animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <WaveformBar isPlaying barCount={3} className="h-3" />
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-wavee-text sm:text-sm">
                  {currentSong.title}
                </p>
                <p className="truncate text-[10px] text-wavee-muted sm:text-xs">
                  {currentSong.artist_name ?? currentSong.genre}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNowPlayingExpanded(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
              aria-label="Expand player"
            >
              <FiChevronUp size={22} strokeWidth={2.25} />
            </button>

            {/* Controls */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              <button
                onClick={previous}
                className="hidden rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text sm:block"
              >
                <FiSkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-wavee-primary text-black transition-all hover:shadow-neon active:scale-95 sm:h-10 sm:w-10"
                aria-label={
                  !isPlaying
                    ? "Play"
                    : progressIndeterminate
                      ? "Loading"
                      : "Pause"
                }
              >
                {!isPlaying ? (
                  <FiPlay size={16} className="ml-0.5" />
                ) : progressIndeterminate ? (
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-black/25 border-t-black/80 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <FiPause size={16} />
                )}
              </button>
              <button
                onClick={next}
                className="rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
              >
                <FiSkipForward size={18} />
              </button>
            </div>

            {/* Time + Volume — desktop only */}
            <div className="hidden items-center justify-end gap-4 text-xs text-wavee-muted md:flex">
              <span className="tabular-nums">
                {formatTime(progress)} /{" "}
                {duration > 0 ? formatTime(duration) : "--:--"}
              </span>
              <div className="flex items-center gap-2">
                <FiVolume2 size={14} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
