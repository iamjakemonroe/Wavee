import type { ReactNode } from "react";
import { useCallback } from "react";
import { FiHeart, FiList, FiPlay, FiShare2, FiTrash2 } from "react-icons/fi";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import type { Song } from "@/types/entities";
import { getSongShareUrl, useShare } from "@/hooks/useShare";

const COVER_FALLBACK = "/cover-placeholder.svg";

interface PlaylistSongOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song | null;
  isLiked: boolean;
  likePending: boolean;
  removePending: boolean;
  onPlay: () => void;
  onAddToPlaylist: () => void;
  onToggleLike: () => void;
  onRemoveFromPlaylist: () => Promise<void>;
  /** When false, hides “Remove from this playlist” (e.g. artist / user track list). */
  showRemoveFromPlaylist?: boolean;
}

function MenuRow({
  icon,
  label,
  danger,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg py-2 pl-1.5 pr-2 text-left text-[13px] font-normal leading-snug tracking-wide antialiased transition-colors disabled:opacity-50 ${danger
        ? "text-rose-400/90 hover:bg-rose-500/[0.08]"
        : "text-neutral-400 hover:bg-white/[0.05]"
        }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center [&_svg]:stroke-[1.6] ${danger ? "text-rose-400/85" : "text-neutral-500"
          }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

export function PlaylistSongOptionsSheet({
  open,
  onOpenChange,
  song,
  isLiked,
  likePending,
  removePending,
  onPlay,
  onAddToPlaylist,
  onToggleLike,
  onRemoveFromPlaylist,
  showRemoveFromPlaylist = true,
}: PlaylistSongOptionsSheetProps) {
  const busy = showRemoveFromPlaylist && removePending;
  const { handleShare } = useShare();

  const handleShareLink = useCallback(() => {
    if (!song) return;
    const url = getSongShareUrl(song.id);
    const artist = song.artist_name?.trim();
    const text = artist
      ? `Listen to "${song.title}" by ${artist} on Wavee\n${url}`
      : `Listen to "${song.title}" on Wavee\n${url}`;
    handleShare({ title: song.title, text, url });
  }, [song, handleShare]);

  if (!song) return null;

  const artist = song.artist_name ?? "Unknown";

  return (
    <BottomSheetModal
      variant="menu"
      menuBare
      aria-label="Song options"
      title="Song options"
      open={open}
      onOpenChange={onOpenChange}
      isSaving={busy}
      contentClassName="px-2.5 pt-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      menuTopSlot={
        <div className="flex gap-3 px-3 pb-3 pt-0 text-left">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/[0.08]">
            <img
              src={song.cover_image_url || COVER_FALLBACK}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 py-0.5 pr-1">
            <p className="truncate font-sans text-sm font-semibold leading-tight tracking-tight text-neutral-300">
              {song.title}
            </p>
            <p className="mt-0.5 truncate font-sans text-xs font-normal leading-snug tracking-wide text-white/40">
              {artist}
            </p>
          </div>
        </div>
      }
    >
      <nav
        className="border-t border-white/[0.08] pt-1 font-sans antialiased"
        aria-label="Song actions"
      >
        <MenuRow
          icon={<FiPlay size={16} />}
          label="Play"
          onClick={() => onPlay()}
        />
        <MenuRow
          icon={<FiList size={16} />}
          label="Add to playlist"
          onClick={() => onAddToPlaylist()}
        />
        <MenuRow
          icon={<FiShare2 size={16} />}
          label="Share"
          onClick={handleShareLink}
        />
        <MenuRow
          icon={
            <FiHeart
              size={16}
              className={isLiked ? "text-wavee-primary" : undefined}
              fill={isLiked ? "currentColor" : "none"}
            />
          }
          label={isLiked ? "Unlike" : "Like"}
          disabled={likePending}
          onClick={() => onToggleLike()}
        />
        {showRemoveFromPlaylist ? (
          <MenuRow
            icon={<FiTrash2 size={16} />}
            label="Remove from this playlist"
            danger
            disabled={removePending}
            onClick={() => void onRemoveFromPlaylist()}
          />
        ) : null}
      </nav>
    </BottomSheetModal>
  );
}
