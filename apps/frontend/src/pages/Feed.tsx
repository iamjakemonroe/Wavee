import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuPause, LuPlay, LuShare2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { LikeButton, useIsCurrent } from '../components/music/Song';
import { ProgressBar } from '../components/music/Player';
import { SongMenu, shareSong } from '../components/music/SongMenu';
import { AiTag, Artists } from '../components/music/Artists';
import { Bars, Button, Cover, EmptyState, IconButton, Spinner } from '../components/ui';
import { useFeed, usePromoted } from '../hooks/data';
import { payApi } from '../lib/pay';
import { api, type Song } from '../lib/api';
import { count, duration, songGenres } from '../lib/format';
import { currentSong, usePlayer } from '../store/player';

/** One song, filling the screen. */
function FeedCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  const { isCurrent, playing, buffering } = useIsCurrent(song);
  const toggle = usePlayer((s) => s.toggle);
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-4xl">
      {song.cover_image_url && (
        <img src={song.cover_image_url} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
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
              {song.promoted && (
                <span className="mr-2 rounded-full bg-line/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                  Promoted
                </span>
              )}
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
        {/* The card is the player here: drag to go back or forward. */}
        <div className={clsx('mt-4 w-full transition-opacity duration-300', isCurrent ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          {isCurrent && <ProgressBar handle />}
          {!isCurrent && <div className="h-5" />}
        </div>
      </div>
    </div>
  );
}

/** When the player reaches the end of the feed's queue: the next songs, past everything it has.
 * It starts a few songs early, in case something was queued in between, and drops repeats. */
async function moreFeed(): Promise<Song[]> {
  const queue = usePlayer.getState().queue;
  const page = await api.feed(25, Math.max(0, queue.length - 5));
  return page.filter((s) => !queue.some((q) => q.id === s.id));
}

/** Scrolls the feed so card i fills it. */
function showCard(root: HTMLElement, i: number, smooth: boolean) {
  const card = root.querySelector(`[data-index="${i}"]`);
  if (!card) return;
  const top = root.scrollTop + card.getBoundingClientRect().top - root.getBoundingClientRect().top;
  if (Math.abs(top - root.scrollTop) < 1) return;
  root.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
}

/** The feed, a screen per song: swipe or scroll to the next. Once you
 * start listening, the song on screen plays. */
export function Feed() {
  const feed = useFeed();
  const playList = usePlayer((s) => s.playList);
  const source = usePlayer((s) => s.source);
  const queue = usePlayer((s) => s.queue);
  const nowId = usePlayer((s) => currentSong(s)?.id);
  const promoted = usePromoted().data;
  const playingFeed = source === 'Feed' && !!nowId;
  // Come back while the feed is playing and it carries on where the music is.
  const [listening, setListening] = useState(playingFeed);
  // While the feed is what's playing, its queue comes first, in the order it plays (it may have
  // played on past the pages loaded here). Pages are slices of one order, but a new upload can
  // shift it by one.
  const songs = useMemo(() => {
    const seen = new Set<string>();
    // Boosted songs join the feed at the 3rd and 9th places, marked Promoted.
    const pages = [...(feed.data?.pages.flat() ?? [])];
    (promoted ?? []).forEach((p, k) => pages.splice(Math.min(2 + k * 6, pages.length), 0, { ...p.song, promoted: p.boost_id }));
    const all = [...(source === 'Feed' ? queue : []), ...pages];
    return all.filter((s) => !seen.has(s.id) && !!seen.add(s.id));
  }, [feed.data, queue, source, promoted]);

  // A promoted song heard for ten seconds counts toward its Boost (once a visit).
  const promotedNow = usePlayer((s) => currentSong(s)?.promoted);
  const playing = usePlayer((s) => s.playing);
  const heard = useRef(new Set<string>());
  useEffect(() => {
    if (!promotedNow || !playing || heard.current.has(promotedNow)) return;
    const t = window.setTimeout(() => {
      heard.current.add(promotedNow);
      void payApi.heard(promotedNow).catch(() => undefined);
    }, 10_000);
    return () => window.clearTimeout(t);
  }, [promotedNow, playing]);
  const scroller = useRef<HTMLDivElement>(null);

  const playAt = (i: number) => {
    setListening(true);
    // The feed plays each song from its hook, like a sound on TikTok.
    playList(songs, i, 'Feed', moreFeed, true);
  };

  // A song picked from the screen is already on screen: the feed doesn't scroll to it, so it
  // never pulls against a swipe that's still settling.
  const picked = useRef<string | null>(null);
  const pick = (i: number) => {
    picked.current = songs[i]?.id ?? null;
    playAt(i);
  };

  /** The card filling the screen now. */
  const onScreen = () => {
    const root = scroller.current;
    if (!root) return 0;
    const middle = root.getBoundingClientRect().top + root.clientHeight / 2;
    for (const card of root.querySelectorAll<HTMLElement>('[data-index]')) {
      if (card.getBoundingClientRect().bottom > middle) return Number(card.dataset.index);
    }
    return 0;
  };

  // The observer outlives renders; it reads the latest of these.
  const latest = useRef({ songs, pick, feed });
  useLayoutEffect(() => {
    latest.current = { songs, pick, feed };
  });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasSongs = songs.length > 0;

  // Scroll to a song and it plays (once you've started). Only a card that fills most of the
  // screen counts: one peeking in at the edge, or one on its way out, doesn't.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !listening) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const { songs, pick, feed } = latest.current;
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.65) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          const song = songs[i];
          if (song && song.id !== currentSong(usePlayer.getState())?.id) pick(i);
          if (i >= songs.length - 3 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }
      },
      { root, threshold: 0.65 },
    );
    observerRef.current = observer;
    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
    // The list mounts with its first songs.
  }, [listening, hasSongs]);

  // New cards join the watch (watching a card twice is harmless).
  useEffect(() => {
    const root = scroller.current;
    const observer = observerRef.current;
    if (root && observer) root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
  }, [songs]);

  // The song on screen is the one playing: when the player moves on by itself, the feed follows,
  // and when you come back to it, it opens on that song straight away (before the observer
  // looks, so it can't mistake the top card for a new pick).
  const placed = useRef(false);
  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root || !listening || source !== 'Feed' || !nowId) return;
    if (nowId === picked.current) {
      picked.current = null;
      placed.current = true;
      return;
    }
    const i = songs.findIndex((s) => s.id === nowId);
    if (i < 0) return;
    showCard(root, i, placed.current);
    placed.current = true;
  }, [nowId, listening, source, songs]);

  if (feed.isLoading && !songs.length) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
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
          // The snap point is on the outer box: a card off screen isn't drawn, so one inside it
          // would only exist near where you are, and Safari would refuse to jump further.
          <div key={s.id} data-index={i} className="h-full snap-start snap-always [contain-intrinsic-size:auto_640px] [content-visibility:auto]">
            <FeedCard song={s} onPlay={() => pick(i)} />
          </div>
        ))}
        {feed.isFetchingNextPage && <Spinner className="mx-auto my-8 block h-6 w-6 text-muted" />}
      </div>
      {!listening && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <Button variant="primary" size="lg" className="pointer-events-auto shadow-glow" icon={<LuPlay className="fill-current" />} onClick={() => pick(onScreen())}>
            Start the feed
          </Button>
        </motion.div>
      )}
    </div>
  );
}
