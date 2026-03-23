import { memo } from "react";
import { FiPlay } from "react-icons/fi";
import type { Song } from "@/types/entities";
import { WaveformBar } from "@/components/music/WaveformBar";

interface SongCardProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export const SongCard = memo(function SongCard({
  song,
  isActive,
  isPlaying,
  onPlay,
}: SongCardProps) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all hover:bg-white/[0.03] ${
        isActive
          ? "border-wavee-primary/30 bg-wavee-primary/[0.05] shadow-neon"
          : "border-white/[0.06]"
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <img
          src={song.cover_image_url ?? "/icons.svg"}
          alt={song.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <FiPlay className="text-white" size={18} />
        </button>
        {isActive && isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <WaveformBar isPlaying barCount={3} className="h-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-wavee-text">{song.title}</p>
        <p className="truncate text-xs text-wavee-muted">{song.genre}</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-wavee-muted">
        <span>{song.plays_count.toLocaleString()} plays</span>
      </div>
    </div>
  );
});
