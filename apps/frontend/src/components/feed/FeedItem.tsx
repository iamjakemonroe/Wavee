import { memo, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHeart,
  FiPlay,
  FiPause,
  FiShare2,
  FiMoreVertical,
  FiPlus,
} from "react-icons/fi";
import type { Song } from "@/types/entities";
import { WaveformBar } from "@/components/music/WaveformBar";

const COVER_FALLBACK = "/cover-placeholder.svg";

interface FeedItemProps {
  song: Song;
  isActive: boolean;
  isPlaying: boolean;
  isLiked: boolean;
  onToggle: () => void;
  onLike: () => void;
  onAddToPlaylist?: () => void;
}

export const FeedItem = memo(function FeedItem({
  song,
  isActive,
  isPlaying,
  isLiked,
  onToggle,
  onLike,
  onAddToPlaylist,
}: FeedItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: song.title,
      text: `Check out "${song.title}" on Wavee!`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(
          `${shareData.text} ${shareData.url}`,
        );
      } catch {
        /* clipboard not available */
      }
    }
  }, [song.title]);

  return (
    <motion.div
      data-song-id={song.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative h-full shrink-0 snap-start overflow-hidden"
    >
      <img
        src={song.cover_image_url || COVER_FALLBACK}
        alt={song.title}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />

      <button
        onClick={onToggle}
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.div
          key={isPlaying ? "pause" : "play"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: isActive && isPlaying ? 0 : 0.7 }}
          whileHover={{ opacity: 0.9 }}
          className="rounded-full bg-black/50 p-4 backdrop-blur-sm sm:p-5"
        >
          {isActive && isPlaying ? (
            <FiPause className="text-white" size={28} />
          ) : (
            <FiPlay className="text-white" size={28} />
          )}
        </motion.div>
      </button>

      <div className="absolute bottom-4 left-0 right-14 px-4 sm:bottom-6 sm:right-16 sm:px-5">
        <div className="flex items-center gap-2">
          {isActive && isPlaying && (
            <WaveformBar isPlaying barCount={5} className="h-4" />
          )}
          <span className="text-[10px] font-medium uppercase tracking-wider text-wavee-primary sm:text-xs">
            {isActive && isPlaying ? "Now Playing" : song.genre}
          </span>
        </div>
        <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
          {song.title}
        </h3>
        {song.artist_name && (
          <p className="mt-0.5 text-xs font-medium text-white/80 sm:text-sm">
            {song.artist_name}
          </p>
        )}
        <p className="mt-0.5 text-xs text-white/60 sm:text-sm">
          {song.plays_count.toLocaleString()} plays ·{" "}
          {song.likes_count.toLocaleString()} likes
        </p>
      </div>

      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-3 sm:bottom-8 sm:right-4 sm:gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <motion.div
            animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`rounded-full p-2.5 backdrop-blur-sm transition-colors sm:p-3 ${
              isLiked
                ? "bg-wavee-primary/20"
                : "bg-white/10 group-hover/btn:bg-wavee-primary/20"
            }`}
          >
            <FiHeart
              className={`transition-colors ${
                isLiked
                  ? "fill-wavee-primary text-wavee-primary"
                  : "text-white group-hover/btn:text-wavee-primary"
              }`}
              size={18}
            />
          </motion.div>
          <span className="text-[10px] text-white/60">{song.likes_count}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            void handleShare();
          }}
          className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm transition-colors group-hover/btn:bg-white/20 sm:p-3">
            <FiShare2 className="text-white" size={18} />
          </div>
          <span className="text-[10px] text-white/60">Share</span>
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm transition-colors group-hover/btn:bg-white/20 sm:p-3">
              <FiMoreVertical className="text-white" size={18} />
            </div>
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-wavee-surface/95 shadow-2xl backdrop-blur-xl"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onAddToPlaylist?.();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm text-wavee-text transition-colors hover:bg-white/[0.06]"
                >
                  <FiPlus size={15} className="text-wavee-primary" />
                  Add to Playlist
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Close menu on outside click */}
      {showMenu && (
        <div
          className="absolute inset-0 z-[-1]"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
        />
      )}
    </motion.div>
  );
});
