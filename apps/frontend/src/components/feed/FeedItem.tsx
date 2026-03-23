import { memo } from "react";
import { motion } from "framer-motion";
import { FiHeart, FiPlay, FiPause, FiShare2 } from "react-icons/fi";
import type { Song } from "@/types/entities";
import { WaveformBar } from "@/components/music/WaveformBar";

interface FeedItemProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  onToggle: () => void;
  onLike: () => void;
}

export const FeedItem = memo(function FeedItem({
  song,
  isActive,
  isPlaying,
  onToggle,
  onLike,
}: FeedItemProps) {
  return (
    <motion.div
      data-song-id={song.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative h-[75vh] snap-center overflow-hidden rounded-2xl"
    >
      <img
        src={song.cover_image_url ?? "/icons.svg"}
        alt={song.title}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />

      {/* Center play/pause */}
      <button
        onClick={onToggle}
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.div
          key={isPlaying ? "pause" : "play"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: isActive && isPlaying ? 0 : 0.7 }}
          whileHover={{ opacity: 0.9 }}
          className="rounded-full bg-black/50 p-5 backdrop-blur-sm"
        >
          {isActive && isPlaying ? (
            <FiPause className="text-white" size={32} />
          ) : (
            <FiPlay className="text-white" size={32} />
          )}
        </motion.div>
      </button>

      {/* Song info */}
      <div className="absolute bottom-0 left-0 right-16 p-5">
        <div className="flex items-center gap-2">
          {isActive && isPlaying && (
            <WaveformBar isPlaying barCount={4} className="h-4" />
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-wavee-primary">
            {isActive && isPlaying ? "Now Playing" : song.genre}
          </span>
        </div>
        <h3 className="mt-1 text-2xl font-bold text-white">{song.title}</h3>
        <p className="mt-0.5 text-sm text-white/60">
          {song.plays_count.toLocaleString()} plays ·{" "}
          {song.likes_count.toLocaleString()} likes
        </p>
      </div>

      {/* Actions */}
      <div className="absolute bottom-6 right-4 flex flex-col items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm transition-colors group-hover/btn:bg-wavee-primary/20">
            <FiHeart
              className="text-white transition-colors group-hover/btn:text-wavee-primary"
              size={20}
            />
          </div>
          <span className="text-[10px] text-white/60">{song.likes_count}</span>
        </button>
        <button className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm transition-colors group-hover/btn:bg-white/20">
            <FiShare2 className="text-white" size={20} />
          </div>
          <span className="text-[10px] text-white/60">Share</span>
        </button>
      </div>
    </motion.div>
  );
});
