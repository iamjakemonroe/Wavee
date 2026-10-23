import clsx from 'clsx';
import { LuHeart, LuPause, LuPlay } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { useLike } from '../../hooks/data';
import type { Song } from '../../lib/api';
import { artistName, count, duration } from '../../lib/format';
import { withAccount } from '../../store/auth';
import { currentSong, usePlayer } from '../../store/player';
import { Bars, Cover, IconButton, Spinner } from '../ui';
import { SongMenu } from './SongMenu';

/** Whether [song] is the one playing, and whether it's sounding. */
export function useIsCurrent(song: Song) {
  const isCurrent = usePlayer((s) => currentSong(s)?.id === song.id);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  return { isCurrent, playing: isCurrent && playing, buffering: isCurrent && buffering };
}

export function LikeButton({ song, size = 'md' }: { song: Song; size?: 'sm' | 'md' | 'lg' }) {
  const like = useLike();
  return (
    <IconButton
      label={song.liked ? 'Unlike' : 'Like'}
      size={size}
      active={song.liked}
      aria-pressed={song.liked}
      onClick={(e) => {
        e.stopPropagation();
        withAccount('Sign in to like songs and keep them in your library.', () =>
          like.mutate({ song, liked: !song.liked }),
        );
      }}
    >
      <LuHeart className={clsx(song.liked && 'fill-current')} />
    </IconButton>
  );
}

/** A round play/pause button for [song] in [list]. */
export function PlayToggle({
  song,
  list,
  index,
  source,
  className,
}: {
  song: Song;
  list: Song[];
  index: number;
  source?: string;
  className?: string;
}) {
  const { isCurrent, playing, buffering } = useIsCurrent(song);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  return (
    <button
      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
      onClick={(e) => {
        e.stopPropagation();
        if (isCurrent) toggle();
        else playList(list, index, source);
      }}
      className={clsx(
        'grid place-items-center rounded-full bg-ink text-bg shadow-lift transition duration-300 ease-out hover:scale-105 active:scale-95',
        className ?? 'h-12 w-12 text-xl',
      )}
    >
      {buffering ? <Spinner className="h-5 w-5" /> : playing ? <LuPause className="fill-current" /> : <LuPlay className="ml-0.5 fill-current" />}
    </button>
  );
}

/** A song in a list: number (or bars while it plays), cover, title and
 * artist, plays, length, like and the song's menu. */
export function SongRow({
  song,
  list,
  index,
  source,
  showNumber = true,
  extraMenu,
}: {
  song: Song;
  list: Song[];
  index: number;
  source?: string;
  showNumber?: boolean;
  extraMenu?: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const { isCurrent, playing } = useIsCurrent(song);
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const start = () => (isCurrent ? toggle() : playList(list, index, source));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === 'Enter') start();
      }}
      className={clsx(
        'group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 transition duration-200 hover:bg-line/[0.05] sm:grid-cols-[2rem_auto_1fr_auto_auto] sm:gap-4 sm:px-3',
        isCurrent && 'bg-line/[0.04]',
      )}
    >
      {showNumber && (
        <span className="hidden w-8 text-center text-sm tabular-nums text-faint sm:block">
          {isCurrent && playing ? (
            <Bars playing className="mx-auto h-4 w-4" />
          ) : (
            <>
              <span className="group-hover:hidden">{index + 1}</span>
              <LuPlay className="mx-auto hidden fill-current text-ink group-hover:block" />
            </>
          )}
        </span>
      )}
      {!showNumber && <span className="hidden sm:block" />}
      <Cover src={song.cover_image_url} title={song.title} className="h-12 w-12" rounded="rounded-lg" />
      <div className="min-w-0">
        <p className={clsx('truncate text-[15px] font-medium', isCurrent ? 'text-teal' : 'text-ink')}>
          {song.title}
          {song.explicit && (
            <span className="ml-2 rounded bg-line/10 px-1 align-middle text-[10px] font-semibold text-muted">E</span>
          )}
        </p>
        <Link
          to={`/u/${song.artist_username}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-[13px] text-muted transition hover:text-ink hover:underline"
        >
          {artistName(song)}
        </Link>
      </div>
      <span className="hidden text-[13px] tabular-nums text-faint md:block">{count(song.plays_count)} plays</span>
      <div className="flex items-center gap-1">
        <span className="hidden w-12 text-right text-[13px] tabular-nums text-faint sm:block">
          {duration(song.duration_seconds)}
        </span>
        <span className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:has-[[aria-pressed=true]]:opacity-100">
          <LikeButton song={song} size="sm" />
        </span>
        <SongMenu song={song} extra={extraMenu} />
      </div>
    </div>
  );
}

/** A song as a square card (rows of new music, trending). */
export function SongTile({
  song,
  list,
  index,
  source,
  rank,
}: {
  song: Song;
  list: Song[];
  index: number;
  source?: string;
  rank?: number;
}) {
  const { isCurrent, playing } = useIsCurrent(song);
  return (
    <div className="group w-[156px] shrink-0 snap-start sm:w-[176px]">
      <div className="relative">
        <Link to={`/songs/${song.id}`} aria-label={song.title}>
          <Cover
            src={song.cover_image_url}
            title={song.title}
            className="aspect-square w-full shadow-lift transition duration-500 ease-out group-hover:-translate-y-1"
            rounded="rounded-2xl"
          />
        </Link>
        {rank != null && (
          <span className="absolute left-3 top-2 text-3xl font-bold text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {rank}
          </span>
        )}
        <div
          className={clsx(
            'absolute bottom-3 right-3 transition duration-300 ease-out',
            isCurrent ? 'opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100',
          )}
        >
          <PlayToggle song={song} list={list} index={index} source={source} className="h-11 w-11 text-lg" />
        </div>
        {playing && (
          <span className="absolute left-3 bottom-3 rounded-full bg-black/60 p-1.5 backdrop-blur">
            <Bars playing className="h-4 w-4" />
          </span>
        )}
      </div>
      <Link to={`/songs/${song.id}`} className="mt-3 block truncate text-[15px] font-medium hover:underline">
        {song.title}
      </Link>
      <Link to={`/u/${song.artist_username}`} className="block truncate text-[13px] text-muted hover:text-ink hover:underline">
        {artistName(song)}
      </Link>
    </div>
  );
}
