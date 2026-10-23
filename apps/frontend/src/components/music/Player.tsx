import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  LuChevronDown,
  LuFilm,
  LuListMusic,
  LuPause,
  LuPlay,
  LuRepeat,
  LuRepeat1,
  LuShuffle,
  LuSkipBack,
  LuSkipForward,
  LuVolume1,
  LuVolume2,
  LuVolumeX,
  LuX,
} from 'react-icons/lu';
import { Link, useLocation } from 'react-router-dom';
import { usePlaybackTime } from '../../hooks/data';
import { useMediaQuery, usePhone, useSwipeToClose } from '../../hooks/useSwipeToClose';
import { audio } from '../../lib/audio';
import { artistNames, duration } from '../../lib/format';
import { currentSong, usePlayer } from '../../store/player';
import { Artists } from './Artists';
import { Bars, Cover, IconButton, Spinner } from '../ui';
import { LikeButton } from './Song';
import { SongMenu } from './SongMenu';

/** A seek bar you can drag, tap or move with the arrow keys. */
export function ProgressBar({ compact, handle }: { compact?: boolean; handle?: boolean }) {
  const { time, duration: length, buffered } = usePlaybackTime();
  const seek = usePlayer((s) => s.seek);
  const bar = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? (length ? time / length : 0);

  const fractionAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  return (
    <div className={clsx('flex items-center gap-3', compact && 'gap-0')}>
      {!compact && <span className="w-10 text-right text-2xs tabular-nums text-faint">{duration(shown * length)}</span>}
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${duration(time)} of ${duration(length)}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(time + 5);
          if (e.key === 'ArrowLeft') seek(time - 5);
        }}
        onPointerDown={(e) => {
          if (!length) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag(fractionAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (drag != null) setDrag(fractionAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (drag == null) return;
          seek(fractionAt(e.clientX) * length);
          setDrag(null);
        }}
        className={clsx('group relative flex flex-1 cursor-pointer touch-none items-center', compact ? 'h-1' : 'h-5')}
      >
        <div className={clsx('relative w-full overflow-hidden rounded-full bg-line/10', compact ? 'h-[2px]' : 'h-1')}>
          <div className="absolute inset-y-0 left-0 bg-line/15" style={{ width: `${buffered * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${shown * 100}%` }} />
        </div>
        {!compact && (
          <span
            className={clsx(
              'absolute h-3 w-3 -translate-x-1/2 rounded-full bg-ink shadow transition group-hover:opacity-100 group-focus-visible:opacity-100',
              handle || drag != null ? 'opacity-100' : 'opacity-0',
            )}
            style={{ left: `${shown * 100}%` }}
          />
        )}
      </div>
      {!compact && <span className="w-10 text-2xs tabular-nums text-faint">{duration(length)}</span>}
    </div>
  );
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const level = muted ? 0 : volume;
  return (
    <div className="flex items-center gap-1">
      <IconButton label={muted ? 'Unmute' : 'Mute'} size="sm" onClick={toggleMute}>
        {level === 0 ? <LuVolumeX /> : level < 0.5 ? <LuVolume1 /> : <LuVolume2 />}
      </IconButton>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={level}
        aria-label="Volume"
        onChange={(e) => setVolume(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-line/15 accent-[rgb(var(--teal))]"
      />
    </div>
  );
}

function Transport({ big }: { big?: boolean }) {
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const previous = usePlayer((s) => s.previous);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  return (
    <div className={clsx('flex items-center justify-center', big ? 'gap-5' : 'gap-2')}>
      <IconButton label={shuffle ? 'Shuffle off' : 'Shuffle'} size={big ? 'md' : 'sm'} active={shuffle} onClick={toggleShuffle}>
        <LuShuffle />
      </IconButton>
      <IconButton label="Previous" size={big ? 'lg' : 'md'} onClick={previous} className="text-ink">
        <LuSkipBack className="fill-current" />
      </IconButton>
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={clsx(
          'grid place-items-center rounded-full bg-ink text-bg transition duration-300 hover:scale-105 active:scale-95',
          big ? 'h-[72px] w-[72px] text-3xl shadow-glow' : 'h-10 w-10 text-lg',
        )}
      >
        {buffering && !playing ? (
          <Spinner className={big ? 'h-7 w-7' : 'h-4 w-4'} />
        ) : playing ? (
          <LuPause className="fill-current" />
        ) : (
          <LuPlay className="ml-0.5 fill-current" />
        )}
      </button>
      <IconButton label="Next" size={big ? 'lg' : 'md'} onClick={() => void next()} className="text-ink">
        <LuSkipForward className="fill-current" />
      </IconButton>
      <IconButton
        label={repeat === 'off' ? 'Repeat' : repeat === 'all' ? 'Repeat one' : 'Repeat off'}
        size={big ? 'md' : 'sm'}
        active={repeat !== 'off'}
        onClick={cycleRepeat}
      >
        {repeat === 'one' ? <LuRepeat1 /> : <LuRepeat />}
      </IconButton>
    </div>
  );
}

/** The player along the bottom: a full bar on wide screens, a compact one
 * above the tabs on phones. Tap it to open Now Playing. */
export function PlayerBar() {
  const song = usePlayer(currentSong);
  const playing = usePlayer((s) => s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const setNowPlayingOpen = usePlayer((s) => s.setNowPlayingOpen);
  const setQueueOpen = usePlayer((s) => s.setQueueOpen);
  const queueOpen = usePlayer((s) => s.queueOpen);
  // On phones the feed's card is the player (with its own progress bar), so the mini player
  // steps aside there instead of covering the card.
  const { pathname } = useLocation();
  const wide = useMediaQuery('(min-width: 1024px)');
  const onFeed = pathname === '/feed';
  const mini = !onFeed || wide;

  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', song && mini ? '76px' : '0px');
  }, [song, mini]);

  if (!song) return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed inset-x-0 bottom-[var(--nav-h)] z-40 pl-[max(0.5rem,var(--sal))] pr-[max(0.5rem,var(--sar))] lg:bottom-0 lg:px-0"
    >
      {/* Phone */}
      {!onFeed && (
      <div className="relative overflow-hidden rounded-2xl border border-line/10 bg-raised shadow-lift lg:hidden">
        <div className="flex items-center gap-3 p-2 pr-1" onClick={() => setNowPlayingOpen(true)} role="button" tabIndex={0} aria-label="Open now playing">
          <Cover src={song.cover_image_url} title={song.title} className="h-11 w-11" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{song.title}</p>
            <p className="truncate text-[12px] text-muted">{artistNames(song)}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="flex items-center">
            <LikeButton song={song} size="sm" />
            <IconButton label={playing ? 'Pause' : 'Play'} onClick={toggle} className="text-ink">
              {playing ? <LuPause className="fill-current" /> : <LuPlay className="fill-current" />}
            </IconButton>
          </div>
        </div>
        <div className="absolute inset-x-3 bottom-0">
          <ProgressBar compact />
        </div>
      </div>
      )}

      {/* Wide screens */}
      <div className="hidden h-[76px] grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-6 border-t border-line/[0.07] bg-bg/90 px-5 backdrop-blur-2xl lg:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setNowPlayingOpen(true)} aria-label="Open now playing" className="relative">
            <Cover src={song.cover_image_url} title={song.title} className="h-12 w-12" rounded="rounded-lg" />
            {playing && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-bg p-1">
                <Bars playing className="h-3 w-3" />
              </span>
            )}
          </button>
          <div className="min-w-0">
            <Link to={`/songs/${song.id}`} className="block truncate text-sm font-medium hover:underline">
              {song.title}
            </Link>
            <Artists song={song} className="block text-[12px] text-muted" />
          </div>
          <LikeButton song={song} size="sm" />
        </div>
        <div className="flex flex-col gap-0.5">
          <Transport />
          <ProgressBar />
        </div>
        <div className="flex items-center justify-end gap-1">
          {song.video_url && (
            <IconButton label="Watch the video" size="sm" onClick={() => setNowPlayingOpen(true)}>
              <LuFilm />
            </IconButton>
          )}
          <IconButton label="Queue" size="sm" active={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>
            <LuListMusic />
          </IconButton>
          <VolumeControl />
        </div>
      </div>
    </motion.div>
  );
}

/** The song, big: artwork (or its video), controls, and what's next. */
export function NowPlaying() {
  const open = usePlayer((s) => s.nowPlayingOpen);
  const setOpen = usePlayer((s) => s.setNowPlayingOpen);
  const song = usePlayer(currentSong);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!open) setWatching(false);
  }, [open]);
  // Pull it down to close, on phones.
  const sheet = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  const dragY = useSwipeToClose(sheet, () => setOpen(false), open && !!song && phone);
  useEffect(() => {
    setWatching(false);
  }, [song?.id]);

  return (
    <AnimatePresence>
      {open && song && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        >
        <motion.div
          ref={sheet}
          style={{ y: dragY }}
          className="h-full overflow-y-auto overscroll-contain bg-bg"
          role="dialog"
          aria-label="Now playing"
        >
          {/* The cover's colours, blurred, behind everything. */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            {song.cover_image_url && (
              <img src={song.cover_image_url} alt="" className="h-full w-full scale-125 object-cover opacity-35 blur-3xl" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg" />
          </div>
          <div className="relative mx-auto flex min-h-full max-w-xl flex-col px-6 pb-[max(2rem,var(--sab))] pt-[max(1rem,var(--sat))]">
            <div className="flex items-center justify-between">
              <IconButton label="Close" onClick={() => setOpen(false)}>
                <LuChevronDown />
              </IconButton>
              <span className="label">Now playing</span>
              <SongMenu song={song} />
            </div>

            <div className="mt-6 flex flex-1 flex-col justify-center">
              {watching && song.video_url ? (
                <VideoView url={song.video_url} poster={song.cover_image_url} onClose={() => setWatching(false)} />
              ) : (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.2, 0.7, 0.1, 1] }}
                >
                  <Cover
                    src={song.cover_image_url}
                    title={song.title}
                    className="mx-auto aspect-square w-full max-w-[420px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]"
                    rounded="rounded-3xl"
                  />
                </motion.div>
              )}

              <div className="mt-8 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <Link to={`/songs/${song.id}`} onClick={() => setOpen(false)} className="block truncate text-2xl font-semibold tracking-tight hover:underline">
                    {song.title}
                  </Link>
                  <span onClick={() => setOpen(false)} className="mt-1 block truncate">
                    <Artists song={song} className="text-muted" badgeClassName="h-4 w-4" />
                  </span>
                </div>
                <LikeButton song={song} size="lg" />
              </div>

              <div className="mt-6">
                <ProgressBar />
              </div>
              <div className="mt-4">
                <Transport big />
              </div>
              {song.video_url && !watching && (
                <button
                  onClick={() => {
                    audio.pause();
                    setWatching(true);
                  }}
                  className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-line/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-line/[0.06]"
                >
                  <LuFilm /> Watch the video
                </button>
              )}
              {song.description && <p className="selectable mt-8 whitespace-pre-line text-sm leading-6 text-muted">{song.description}</p>}
            </div>
          </div>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VideoView({ url, poster, onClose }: { url: string; poster: string | null; onClose: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-black shadow-lift">
      <video src={url} poster={poster ?? undefined} controls autoPlay playsInline className="aspect-video w-full" />
      <IconButton label="Close the video" size="sm" onClick={onClose} className="absolute right-2 top-2 bg-black/50 text-white">
        <LuX />
      </IconButton>
    </div>
  );
}

/** What's playing and what's next; drag isn't needed: play next, remove. */
export function QueuePanel() {
  const open = usePlayer((s) => s.queueOpen);
  const setOpen = usePlayer((s) => s.setQueueOpen);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const source = usePlayer((s) => s.source);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const removeAt = usePlayer((s) => s.removeAt);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="glass fixed bottom-[calc(76px+12px)] right-3 top-3 z-50 hidden w-[360px] flex-col rounded-3xl shadow-lift lg:flex"
          aria-label="Queue"
        >
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h2 className="text-base">Queue</h2>
              {source && <p className="text-[12px] text-faint">Playing from {source}</p>}
            </div>
            <IconButton label="Close the queue" size="sm" onClick={() => setOpen(false)}>
              <LuX />
            </IconButton>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
            {queue.map((s, i) => (
              <div
                key={`${s.id}-${i}`}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl p-2 transition hover:bg-line/[0.05]',
                  i === index && 'bg-line/[0.06]',
                  i < index && 'opacity-45',
                )}
              >
                <button onClick={() => jumpTo(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Cover src={s.cover_image_url} title={s.title} className="h-10 w-10" rounded="rounded-md" />
                  <span className="min-w-0">
                    <span className={clsx('block truncate text-sm', i === index ? 'text-teal' : 'text-ink')}>{s.title}</span>
                    <span className="block truncate text-[12px] text-muted">{artistNames(s)}</span>
                  </span>
                </button>
                {i !== index && (
                  <IconButton label={`Remove ${s.title} from the queue`} size="sm" onClick={() => removeAt(i)} className="opacity-0 group-hover:opacity-100">
                    <LuX />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
