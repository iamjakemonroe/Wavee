import { memo, useCallback, useState, type MouseEvent } from "react";
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
import { getSongShareUrl, useShare } from "@/hooks/useShare";
import { usePlaybackUiState } from "@/hooks/usePlaybackUiState";

const COVER_FALLBACK = "/cover-placeholder.svg";

interface FeedItemProps {
  song: Song;
  isActive: boolean;
  isLiked: boolean;
  onToggle: () => void;
  onLike: () => void;
  onAddToPlaylist?: () => void;
}

export const FeedItem = memo(function FeedItem({
  song,
  isActive,
  isLiked,
  onToggle,
  onLike,
  onAddToPlaylist,
}: FeedItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { handleShare } = useShare();
  const { intentPlaying, progressIndeterminate, showPauseIcon } =
    usePlaybackUiState(song.id);

  const onShareClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const url = getSongShareUrl(song.id);
      const artist = song.artist_name?.trim();
      const text = artist
        ? `Listen to "${song.title}" by ${artist} on Wavee`
        : `Listen to "${song.title}" on Wavee`;
      handleShare({ title: song.title || "Wavee", text, url });
    },
    [song.id, song.title, song.artist_name, handleShare],
  );

  return (
    <motion.div
      data-song-id={song.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative h-full shrink-0 snap-start overflow-hidden touch-pan-y"
    >
      <img
        src={song.cover_image_url || COVER_FALLBACK}
        alt={song.title}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />

      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-0 z-0 flex items-center justify-center"
      >
        <motion.div
          key={showPauseIcon ? "pause" : progressIndeterminate ? "load" : "play"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: isActive && showPauseIcon ? 0 : 0.7,
          }}
          whileHover={{ opacity: 0.9 }}
          className="rounded-full bg-black/50 p-4 backdrop-blur-sm sm:p-5"
        >
          {isActive && showPauseIcon ? (
            <FiPause className="text-white" size={28} />
          ) : isActive && intentPlaying && progressIndeterminate ? (
            <div
              className="h-7 w-7 shrink-0 rounded-full border-2 border-white/25 border-t-wavee-primary animate-spin"
              aria-hidden
            />
          ) : (
            <FiPlay className="text-white" size={28} />
          )}
        </motion.div>
      </button>

      <div className="absolute bottom-4 left-0 right-14 z-10 px-4 sm:bottom-6 sm:right-16 sm:px-5">
        <div className="flex items-center gap-2">
          {isActive && showPauseIcon && (
            <WaveformBar isPlaying barCount={5} className="h-4" />
          )}
          <span className="text-[10px] font-medium uppercase tracking-wider text-wavee-primary sm:text-xs">
            {isActive && intentPlaying ? "Now Playing" : song.genre}
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

      <div className="absolute bottom-6 right-3 z-20 flex flex-col items-center gap-3 sm:bottom-8 sm:right-4 sm:gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <motion.div
            animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`rounded-full p-2.5 backdrop-blur-sm transition-colors sm:p-3 ${isLiked
              ? "bg-wavee-primary/20"
              : "bg-white/10 group-hover/btn:bg-wavee-primary/20"
              }`}
          >
            <FiHeart
              className={`transition-colors ${isLiked
                ? "fill-wavee-primary text-wavee-primary"
                : "text-white group-hover/btn:text-wavee-primary"
                }`}
              size={18}
            />
          </motion.div>
          <span className="text-[10px] text-white/60">{song.likes_count}</span>
        </button>

        <button
          type="button"
          onClick={onShareClick}
          className="group/btn flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="rounded-full bg-white/10 p-2.5 backdrop-blur-sm transition-colors group-hover/btn:bg-white/20 sm:p-3">
            <FiShare2 className="text-white" size={18} />
          </div>
          <span className="text-[10px] text-white/60">Share</span>
        </button>

        <div className="relative">
          <button
            type="button"
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
                  type="button"
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
