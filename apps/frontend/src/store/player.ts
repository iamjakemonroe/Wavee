import { create } from 'zustand';
import { api, type Song } from '../lib/api';
import { audio, sessionId } from '../lib/audio';
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

  const report = (song: Song | null, ended: boolean) => {
    if (!song || listened < 1) return;
    const length = audio.duration || song.duration_seconds || listened;
    const skipped = !ended && listened < Math.min(30, length * 0.5);
    void api.recordPlay(song.id, listened, length, skipped, sessionId()).catch(() => undefined);
    listened = 0;
  };

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
  });
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
    window.setTimeout(() => void get().next(false), 900);
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

    playList(songs, startIndex = 0, source, more = null, fromHook = false) {
      if (!songs.length) return;
      const now = currentSong(get());
      const target = songs[startIndex];
      // Pressing play on the song that's already playing pauses or resumes it.
      if (now && target && now.id === target.id && get().queue === songs) {
        get().toggle();
        return;
      }
      set({ queue: songs, source: source ?? null, more, fromHook });
      start(startIndex);
    },

    playSong(song, source) {
      const now = currentSong(get());
      if (now?.id === song.id) {
        get().toggle();
        return;
      }
      set({ queue: [song], source: source ?? null, more: null, fromHook: false });
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
        try {
          const extra = (await more()).filter((s) => !queue.some((q) => q.id === s.id));
          if (extra.length) {
            set({ queue: [...queue, ...extra] });
            start(index + 1);
            return;
          }
        } catch {
          // Fall through: end of the queue.
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
