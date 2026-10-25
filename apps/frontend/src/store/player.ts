import { create } from 'zustand';
import { api, type Song } from '../lib/api';
import { audio, sessionId } from '../lib/audio';
import { country } from '../lib/geo';
import { recordPlayOnExit } from '../lib/supabase';
import { useAuth } from './auth';
import { originHere, type Origin } from '../lib/origin';
import { artistNames } from '../lib/format';
import { toast } from './toast';

type Repeat = 'off' | 'all' | 'one';

interface PlayerState {
  /** The songs in play order, and which is playing. The player owns this:
   * browsing never replaces it, only pressing play on something does. */
  queue: Song[];
  index: number;
  /** Where the queue came from ("Trending", a playlist...). */
  source: string | null;
  playing: boolean;
  buffering: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  nowPlayingOpen: boolean;
  queueOpen: boolean;
  /** When the queue runs out, more from where it came from (the feed). */
  more: (() => Promise<Song[]>) | null;
  /** Songs start at their hook (the feed), not the beginning. */
  fromHook: boolean;
  /** Where the queue was started, for the artist's stats. */
  origin: Origin;
}

interface PlayerActions {
  playList: (
    songs: Song[],
    start?: number,
    source?: string,
    more?: (() => Promise<Song[]>) | null,
    fromHook?: boolean,
  ) => void;
  playSong: (song: Song, source?: string) => void;
  toggle: () => void;
  next: (skipped?: boolean) => Promise<void>;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  removeAt: (index: number) => void;
  jumpTo: (index: number) => void;
  updateSong: (id: string, changes: Partial<Song>) => void;
  /** Seconds of [id] heard so far, if it's the song playing now (its play is only
   * recorded when it ends). */
  listenedTo: (id: string) => number;
  setNowPlayingOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
}

/** The song playing now, if any. */
export const currentSong = (s: PlayerState) => s.queue[s.index] ?? null;

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('wavee.player') ?? '{}') as { volume?: number; muted?: boolean };
  } catch {
    return {};
  }
})();

export const usePlayer = create<PlayerState & PlayerActions>((set, get) => {
  /** Listening on the song playing now, to count it fairly. */
  let listened = 0;
  let lastTime = 0;
  let failures = 0;
  let loadingMore = false;

  const report = (song: Song | null, ended: boolean) => {
    if (!song || listened < 1) return;
    const length = audio.duration || song.duration_seconds || listened;
    const skipped = !ended && listened < Math.min(30, length * 0.5);
    // A song in the feed as a Boost or a new artist's first listens says so; the rest came from
    // wherever their queue was started.
    const source = song.promoted ? (song.promoted_kind === 'new' ? 'new' : 'boost') : get().origin;
    const heard = listened;
    void country()
      .then((c) => api.recordPlay(song.id, heard, length, skipped, sessionId(), source, c))
      .catch(() => undefined);
    listened = 0;
  };

  // Closing the page mid-song: count what was heard so far (the song only reports when it ends).
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      const song = currentSong(get());
      if (!song || listened < 1) return;
      const length = audio.duration || song.duration_seconds || listened;
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem('wavee.country');
      } catch {
        // No country then.
      }
      recordPlayOnExit(
        {
          p_song: song.id,
          p_listened: Math.round(listened),
          p_duration: Math.max(1, Math.round(length)),
          p_skipped: listened < Math.min(30, length * 0.5),
          p_session: sessionId(),
          p_source: song.promoted ? (song.promoted_kind === 'new' ? 'new' : 'boost') : get().origin,
          p_country: saved && saved !== '-' ? saved : null,
        },
        useAuth.getState().session?.access_token ?? null,
      );
      listened = 0;
    });
  }

  const start = (index: number, autoplay = true) => {
    const { queue } = get();
    const song = queue[index];
    if (!song) return;
    report(currentSong(get()), false);
    set({ index, buffering: true });
    const at = get().fromHook && song.hook_start ? song.hook_start : 0;
    lastTime = at;
    audio.load(song.audio_url, autoplay, at);
    updateSession(song);
  };

  // ── The audio element tells us what happened ──────────────────────

  audio.on('playing', () => {
    failures = 0;
    set({ playing: true, buffering: false });
    warmNext();
  });

  /** The start of the song after this one, fetched quietly so skipping (or swiping the feed)
   * starts at once: it warms the nearby Cloudflare cache and the phone's. Not on data saver. */
  const warmed = new Set<string>();
  const warmNext = () => {
    const { queue, index, shuffle } = get();
    const next = shuffle ? null : queue[index + 1];
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!next || conn?.saveData || warmed.has(next.audio_url)) return;
    warmed.add(next.audio_url);
    // Only the first 256 KB: a no-cors request would drop the Range header and fetch the whole song.
    void fetch(next.audio_url, { mode: 'cors', credentials: 'omit', headers: { Range: 'bytes=0-262143' } }).catch(() => undefined);
    if (next.cover_image_url) {
      const img = new Image();
      img.decoding = 'async';
      img.src = next.cover_image_url;
    }
  };
  audio.on('play', () => set({ playing: true }));
  audio.on('pause', () => set({ playing: false }));
  if ('mediaSession' in navigator) {
    audio.on('play', () => (navigator.mediaSession.playbackState = 'playing'));
    audio.on('pause', () => (navigator.mediaSession.playbackState = 'paused'));
  }
  audio.on('waiting', () => set({ buffering: true }));
  audio.on('blocked', () => set({ playing: false, buffering: false }));
  audio.on('time', () => {
    const t = audio.time;
    const step = t - lastTime;
    if (step > 0 && step < 2) listened += step;
    lastTime = t;
  });
  audio.on('ended', () => {
    const { repeat } = get();
    report(currentSong(get()), true);
    if (repeat === 'one') {
      audio.seek(0);
      audio.play();
      return;
    }
    void get().next(false);
  });
  audio.on('error', () => {
    const song = currentSong(get());
    failures += 1;
    set({ buffering: false, playing: false });
    if (failures >= 3) {
      toast('We couldn’t play these songs. Check your connection and try again.', 'error');
      return;
    }
    toast(song ? `Couldn’t play “${song.title}”. Skipping it.` : 'Couldn’t play that song.', 'error');
    // Skip only if that song is still the one up: if they've picked another meanwhile, leave it.
    window.setTimeout(() => {
      if (song && currentSong(get())?.id === song.id) void get().next(false);
    }, 900);
  });

  return {
    queue: [],
    index: 0,
    source: null,
    playing: false,
    buffering: false,
    volume: saved.volume ?? 0.9,
    muted: saved.muted ?? false,
    shuffle: false,
    repeat: 'off',
    nowPlayingOpen: false,
    queueOpen: false,
    more: null,
    fromHook: false,
    origin: 'other',

    playList(songs, startIndex = 0, source, more = null, fromHook = false) {
      if (!songs.length) return;
      const now = currentSong(get());
      const target = songs[startIndex];
      // Pressing play on the song that's already playing pauses or resumes it.
      if (now && target && now.id === target.id && get().queue === songs) {
        get().toggle();
        return;
      }
      // The song being left is counted first, while its own queue is still in place.
      report(now, false);
      set({ queue: songs, source: source ?? null, more, fromHook, origin: originHere() });
      start(startIndex);
    },

    playSong(song, source) {
      const now = currentSong(get());
      if (now?.id === song.id) {
        get().toggle();
        return;
      }
      report(now, false);
      set({ queue: [song], source: source ?? null, more: null, fromHook: false, origin: originHere() });
      start(0);
    },

    toggle() {
      const song = currentSong(get());
      if (!song) return;
      if (!audio.src) {
        start(get().index);
      } else if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    },

    async next(skipped = true) {
      const { queue, index, repeat, shuffle, more } = get();
      if (skipped) report(currentSong(get()), false);
      if (shuffle && queue.length > 1) {
        let pick = index;
        while (pick === index) pick = Math.floor(Math.random() * queue.length);
        start(pick);
        return;
      }
      if (index < queue.length - 1) {
        start(index + 1);
        return;
      }
      if (more) {
        // Two quick Nexts at the end of the queue: one fetch, then both move on through it.
        if (loadingMore) return;
        loadingMore = true;
        try {
          const latest = get().queue;
          const extra = (await more()).filter((s) => !latest.some((q) => q.id === s.id));
          if (extra.length) {
            set({ queue: [...latest, ...extra] });
            start(get().index + 1);
            return;
          }
        } catch {
          // Fall through: end of the queue.
        } finally {
          loadingMore = false;
        }
      }
      if (repeat === 'all' && queue.length) {
        start(0);
        return;
      }
      audio.pause();
      audio.seek(0);
    },

    previous() {
      // Past the first few seconds, "previous" restarts the song.
      if (audio.time > 4 || get().index === 0) {
        audio.seek(0);
        return;
      }
      start(get().index - 1);
    },

    seek(seconds) {
      audio.seek(seconds);
      lastTime = audio.time;
    },

    setVolume(v) {
      audio.setVolume(v);
      set({ volume: v, muted: v === 0 ? get().muted : false });
      audio.setMuted(v === 0 ? get().muted : false);
      persist();
    },

    toggleMute() {
      const muted = !get().muted;
      audio.setMuted(muted);
      set({ muted });
      persist();
    },

    toggleShuffle: () => set({ shuffle: !get().shuffle }),
    cycleRepeat: () =>
      set({ repeat: get().repeat === 'off' ? 'all' : get().repeat === 'all' ? 'one' : 'off' }),

    playNext(song) {
      const { queue, index } = get();
      if (!queue.length) {
        get().playSong(song);
        return;
      }
      const rest = queue.filter((s, i) => i <= index || s.id !== song.id);
      rest.splice(index + 1, 0, song);
      set({ queue: rest });
      toast(`“${song.title}” plays next`);
    },

    addToQueue(song) {
      const { queue } = get();
      if (!queue.length) {
        get().playSong(song);
        return;
      }
      set({ queue: [...queue, song] });
      toast(`Added “${song.title}” to the queue`);
    },

    removeAt(at) {
      const { queue, index } = get();
      if (at === index) return;
      set({ queue: queue.filter((_, i) => i !== at), index: at < index ? index - 1 : index });
    },

    jumpTo(at) {
      start(at);
    },

    updateSong(id, changes) {
      set({ queue: get().queue.map((s) => (s.id === id ? { ...s, ...changes } : s)) });
    },

    listenedTo: (id) => (currentSong(get())?.id === id ? listened : 0),

    setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),
    setQueueOpen: (open) => set({ queueOpen: open }),
  };

  function persist() {
    try {
      localStorage.setItem('wavee.player', JSON.stringify({ volume: get().volume, muted: get().muted }));
    } catch {
      // Private mode: fine.
    }
  }

  /** The lock screen, headphones and keyboard media keys. */
  function updateSession(song: Song) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: artistNames(song),
      album: 'Wavee',
      artwork: song.cover_image_url
        ? [{ src: song.cover_image_url, sizes: '512x512' }]
        : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  }
});

// Volume as it was last time.
audio.setVolume(usePlayer.getState().volume);
audio.setMuted(usePlayer.getState().muted);

if ('mediaSession' in navigator) {
  const s = () => usePlayer.getState();
  navigator.mediaSession.setActionHandler('play', () => {
    if (!s().playing) s().toggle();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    if (s().playing) s().toggle();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => void s().next());
  navigator.mediaSession.setActionHandler('previoustrack', () => s().previous());
  navigator.mediaSession.setActionHandler('seekto', (d) => {
    if (d.seekTime != null) s().seek(d.seekTime);
  });
}
