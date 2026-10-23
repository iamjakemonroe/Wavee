import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPause, LuPlay, LuShare2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { LikeButton, useIsCurrent } from '../components/music/Song';
import { SongMenu, shareSong } from '../components/music/SongMenu';
import { AiTag, Artists } from '../components/music/Artists';
import { Bars, Button, Cover, EmptyState, IconButton, Spinner } from '../components/ui';
import { useFeed } from '../hooks/data';
import { api, type Song } from '../lib/api';
import { count, duration, songGenres } from '../lib/format';
import { currentSong, usePlayer } from '../store/player';

/** One song, filling the screen. */
function FeedCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  const { isCurrent, playing, buffering } = useIsCurrent(song);
  const toggle = usePlayer((s) => s.toggle);
  return (
    <div className="relative flex h-full snap-start snap-always items-center justify-center overflow-hidden rounded-4xl">
      {song.cover_image_url && (
        <img src={song.cover_image_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/40 to-bg/90" />
      <div className="relative flex w-full max-w-md flex-col items-center px-6">
        <button onClick={() => (isCurrent ? toggle() : onPlay())} className="group relative w-full max-w-[340px]" aria-label={playing ? 'Pause' : 'Play'}>
          <Cover src={song.cover_image_url} title={song.title} className="aspect-square w-full shadow-[0_50px_100px_-30px_rgba(0,0,0,0.95)]" rounded="rounded-[28px]" />
          <span
            className={clsx(
              'absolute inset-0 grid place-items-center rounded-[28px] bg-black/30 text-5xl text-white transition duration-300',
              playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100',
            )}
          >
            {buffering ? <Spinner className="h-10 w-10" /> : playing ? <LuPause className="fill-current" /> : <LuPlay className="ml-1 fill-current" />}
          </span>
        </button>
        <div className="mt-8 flex w-full items-end justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/songs/${song.id}`} className="block truncate text-2xl font-semibold tracking-tight hover:underline">
              {song.title}
            </Link>
            <span className="mt-1 flex items-center gap-2 text-muted">
              {playing && <Bars playing className="h-3.5 w-3.5 shrink-0" />}
              <Artists song={song} badgeClassName="h-4 w-4" />
              {song.made_with_ai && <AiTag />}
            </span>
            <p className="mt-2 text-[13px] text-faint">
              {songGenres(song).join(', ')} · {count(song.plays_count)} plays
              {song.hook_start ? <> · from the hook at {duration(song.hook_start)}</> : null}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <LikeButton song={song} size="lg" />
            <span className="text-[11px] text-faint">{count(song.likes_count)}</span>
            <IconButton label="Share" size="lg" onClick={() => void shareSong(song)}>
              <LuShare2 />
            </IconButton>
            <SongMenu song={song} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The feed, a screen per song: swipe or scroll to the next. Once you
 * start listening, the song on screen plays. */
export function Feed() {
  const feed = useFeed();
  // Pages are slices of one order, but a new upload can shift it by one.
  const songs = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages.flat() ?? []).filter((s) => !seen.has(s.id) && !!seen.add(s.id));
  }, [feed.data]);
  const playList = usePlayer((s) => s.playList);
  const source = usePlayer((s) => s.source);
  const nowId = usePlayer((s) => currentSong(s)?.id);
  const [listening, setListening] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const more = async () => {
    const r = await feed.fetchNextPage();
    const all = r.data?.pages.flat() ?? [];
    const queue = usePlayer.getState().queue;
    return all.filter((s) => !queue.some((q) => q.id === s.id));
  };

  const playAt = (i: number) => {
    setListening(true);
    // The feed plays each song from its hook, like a sound on TikTok.
    playList(
      songs,
      i,
      'Feed',
      async () => {
        const extra = await more();
        return extra.length ? extra : api.feed(20, songs.length);
      },
      true,
    );
  };

  // Scroll to a song and it plays (once you've started).
  useEffect(() => {
    const root = scroller.current;
    if (!root || !listening) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          const song = songs[i];
          if (song && song.id !== usePlayer.getState().queue[usePlayer.getState().index]?.id) {
            playAt(i);
          }
          if (i >= songs.length - 3 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }
      },
      { root, threshold: 0.65 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, listening]);

  // When the player moves on by itself, follow it.
  useEffect(() => {
    if (!listening || source !== 'Feed' || !nowId) return;
    const i = songs.findIndex((s) => s.id === nowId);
    const el = scroller.current?.querySelector(`[data-index="${i}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [nowId, listening, source, songs]);

  if (feed.isLoading) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
  if (!songs.length) {
    return <EmptyState title="The feed is warming up" text="New songs appear here as artists upload them. Check back soon." />;
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="-mx-4 h-[calc(100dvh-var(--top-h)-var(--player-h)-var(--nav-h)-24px)] snap-y snap-mandatory space-y-4 overflow-y-auto px-2 sm:-mx-6 sm:px-4 lg:h-[calc(100svh-64px-var(--player-h)-32px)]"
      >
        {songs.map((s, i) => (
          <div key={s.id} data-index={i} className="h-full">
            <FeedCard song={s} onPlay={() => playAt(i)} />
          </div>
        ))}
        {feed.isFetchingNextPage && <Spinner className="mx-auto my-8 block h-6 w-6 text-muted" />}
      </div>
      {!listening && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <Button variant="primary" size="lg" className="pointer-events-auto shadow-glow" icon={<LuPlay className="fill-current" />} onClick={() => playAt(0)}>
            Start the feed
          </Button>
        </motion.div>
      )}
    </div>
  );
}
