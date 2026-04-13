import { memo } from "react";
import { FiMoreHorizontal, FiPlay } from "react-icons/fi";
import type { Song } from "@/types/entities";
import { WaveformBar } from "@/components/music/WaveformBar";
import { useAudioMetadataDuration } from "@/hooks/useAudioMetadataDuration";
import { usePlaybackUiState } from "@/hooks/usePlaybackUiState";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatTime } from "@/utils/format";

const COVER_FALLBACK = "/cover-placeholder.svg";

interface SongCardProps {
  song: Song;
  isActive: boolean;
  onPlay: () => void;
  /** Right column: play count (default), duration, or hidden. */
  meta?: "plays" | "duration" | "none";
  /** @deprecated use meta="duration" */
  showDuration?: boolean;
  /** Opens overflow menu (e.g. playlist track actions). */
  onMore?: () => void;
}

export const SongCard = memo(function SongCard({
  song,
  isActive,
  onPlay,
  meta: metaProp,
  showDuration = false,
  onMore,
}: SongCardProps) {
  const meta = showDuration ? "duration" : metaProp ?? "plays";
  const { showPauseIcon } = usePlaybackUiState(song.id);

  const playerDuration = usePlayerStore((s) =>
    meta === "duration" && isActive && s.currentSongId === song.id ? s.duration : 0,
  );
  const needMetaFetch = meta === "duration" && (!isActive || playerDuration <= 0);
  const metaDuration = useAudioMetadataDuration(needMetaFetch ? song.audio_url : undefined);

  const durationSeconds =
    meta === "duration" && playerDuration > 0
      ? playerDuration
      : metaDuration != null && metaDuration > 0
        ? metaDuration
        : null;

  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border p-3 transition-all hover:bg-white/[0.03] ${isActive
          ? "border-wavee-primary/30 bg-wavee-primary/[0.05] shadow-neon"
          : "border-white/[0.06]"
        }`}
    >
      <button
        type="button"
        aria-label={`Play ${song.title} by ${song.artist_name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-wavee-primary/40"
        onClick={onPlay}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg max-[1023px]:active:opacity-90">
          <img
            src={song.cover_image_url || COVER_FALLBACK}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:hidden"
            aria-hidden
          >
            <FiPlay className="text-white" size={18} />
          </div>
          {isActive && showPauseIcon && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <WaveformBar isPlaying barCount={3} className="h-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-wavee-text">{song.title}</p>
          <p className="truncate text-xs text-wavee-muted">{song.artist_name}</p>
        </div>
        {meta !== "none" && (
          <div className="min-w-[3rem] shrink-0 text-right text-xs tabular-nums text-wavee-muted">
            {meta === "duration" ? (
              <span>
                {durationSeconds != null ? formatTime(durationSeconds) : "--:--"}
              </span>
            ) : (
              <span>{song.plays_count.toLocaleString()} plays</span>
            )}
          </div>
        )}
      </button>
      {onMore && (
        <button
          type="button"
          aria-label="More options"
          className="flex h-9 w-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full text-wavee-muted transition-colors hover:bg-white/[0.08] hover:text-wavee-text"
          onClick={onMore}
        >
          <FiMoreHorizontal size={20} strokeWidth={2} />
        </button>
      )}
    </div>
  );
});
