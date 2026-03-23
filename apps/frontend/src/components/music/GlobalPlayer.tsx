import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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

export function GlobalPlayer() {
  const {
    queue,
    currentSongId,
    isPlaying,
    progress,
    duration,
    volume,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
  } = usePlayerStore();

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
          className="fixed bottom-0 left-64 right-0 z-50 border-t border-white/[0.06] bg-wavee-bg/90 backdrop-blur-2xl"
        >
          <ProgressBar
            progress={progress}
            duration={duration}
            onSeek={seek}
            className="absolute -top-2.5 left-0 right-0"
          />

          <div className="flex items-center gap-4 px-5 py-3">
            {/* Song info */}
            <div className="flex min-w-0 items-center gap-3" style={{ flex: "1 1 30%" }}>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={currentSong.cover_image_url ?? "/icons.svg"}
                  alt={currentSong.title}
                  className="h-full w-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <WaveformBar isPlaying barCount={3} className="h-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-wavee-text">
                  {currentSong.title}
                </p>
                <p className="truncate text-xs text-wavee-muted">{currentSong.genre}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3" style={{ flex: "0 0 auto" }}>
              <button
                onClick={previous}
                className="rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
              >
                <FiSkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-wavee-primary text-black transition-all hover:shadow-neon active:scale-95"
              >
                {isPlaying ? (
                  <FiPause size={18} />
                ) : (
                  <FiPlay size={18} className="ml-0.5" />
                )}
              </button>
              <button
                onClick={next}
                className="rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
              >
                <FiSkipForward size={18} />
              </button>
            </div>

            {/* Time + Volume */}
            <div
              className="flex items-center justify-end gap-4 text-xs text-wavee-muted"
              style={{ flex: "1 1 30%" }}
            >
              <span className="tabular-nums">
                {formatTime(progress)} / {formatTime(duration)}
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
