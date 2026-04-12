import { create } from "zustand";
import type { Song } from "@/types/entities";
import { audioManager } from "@/lib/audioManager";

interface PlayerState {
  queue: Song[];
  currentSongId: string | null;
  isPlaying: boolean;
  userPaused: boolean;
  progress: number;
  duration: number;
  volume: number;
  /** `<audio>` has fired `playing` (not stalled before first frame). */
  audioElementPlaying: boolean;
  /** `<audio>` fired `waiting` (rebuffering). */
  audioBuffering: boolean;
  /** Fullscreen now-playing sheet open (from mini player). */
  nowPlayingExpanded: boolean;

  setQueue: (songs: Song[]) => void;
  playSong: (song: Song) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setProgress: (t: number) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  seek: (t: number) => void;
  reset: () => void;
  setAudioPlaybackFlags: (flags: {
    audioElementPlaying?: boolean;
    audioBuffering?: boolean;
  }) => void;
  /** Pause audio + sync store (e.g. PWA hidden / page unload). Keeps queue & current track. */
  pauseFromLifecycle: () => void;
  /** Align `isPlaying` / `userPaused` with the real audio element (OS media controls, notifications). */
  syncPlaybackFromMediaElement: () => void;
  setNowPlayingExpanded: (open: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentSongId: null,
  isPlaying: false,
  userPaused: false,
  progress: 0,
  duration: 0,
  volume: 1,
  audioElementPlaying: false,
  audioBuffering: false,
  nowPlayingExpanded: false,

  setQueue: (songs) => set({ queue: songs }),

  playSong: (song) => {
    const state = get();

    if (state.currentSongId === song.id) {
      if (!state.isPlaying) {
        set({ isPlaying: true, userPaused: false });
        if (audioManager.paused) {
          audioManager.resume();
        }
      }
      return;
    }

    const exists = state.queue.some((s) => s.id === song.id);
    set({
      queue: exists ? state.queue : [song, ...state.queue],
      currentSongId: song.id,
      isPlaying: true,
      userPaused: false,
      progress: 0,
      duration: 0,
    });
    audioManager.play(song.audio_url);

    const queue = get().queue;
    const idx = queue.findIndex((s) => s.id === song.id);
    const nextSong = queue[idx + 1];
    if (nextSong) audioManager.preloadNext(nextSong.audio_url);
  },

  setPlaying: (playing) => set({ isPlaying: playing }),

  togglePlay: () => {
    if (!get().currentSongId) return;
    const willPlay = !get().isPlaying;
    const actuallyPaused = audioManager.paused;

    if (willPlay && !actuallyPaused) {
      set({ isPlaying: true, userPaused: false });
      return;
    }
    if (!willPlay && actuallyPaused) {
      set({ isPlaying: false, userPaused: true });
      return;
    }

    set({ isPlaying: willPlay, userPaused: !willPlay });
    if (willPlay) {
      audioManager.resume();
    } else {
      audioManager.pause();
    }
  },

  next: () => {
    const { currentSongId, queue } = get();
    if (!currentSongId || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSongId);
    const nextIdx = idx >= 0 ? (idx + 1) % queue.length : 0;
    const nextSong = queue[nextIdx];
    if (nextSong) {
      set({ currentSongId: nextSong.id, isPlaying: true, userPaused: false, progress: 0, duration: 0 });
      audioManager.play(nextSong.audio_url);
    }
  },

  previous: () => {
    const { currentSongId, queue } = get();
    if (!currentSongId || queue.length === 0) return;

    if (audioManager.time > 3) {
      audioManager.seek(0);
      set({ progress: 0 });
      return;
    }

    const idx = queue.findIndex((s) => s.id === currentSongId);
    const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
    const prevSong = queue[prevIdx];
    if (prevSong) {
      set({ currentSongId: prevSong.id, isPlaying: true, userPaused: false, progress: 0, duration: 0 });
      audioManager.play(prevSong.audio_url);
    }
  },

  setProgress: (t) => set({ progress: t }),
  setDuration: (d) => set({ duration: d }),

  setVolume: (v) => {
    audioManager.setVolume(v);
    set({ volume: v });
  },

  seek: (t) => {
    audioManager.seek(t);
    set({ progress: t });
  },

  reset: () => {
    audioManager.stop();
    set({
      queue: [],
      currentSongId: null,
      isPlaying: false,
      userPaused: false,
      progress: 0,
      duration: 0,
      audioElementPlaying: false,
      audioBuffering: false,
      nowPlayingExpanded: false,
    });
  },

  setNowPlayingExpanded: (open) => set({ nowPlayingExpanded: open }),

  setAudioPlaybackFlags: (flags) => set(flags),

  pauseFromLifecycle: () => {
    const { currentSongId, isPlaying } = get();
    if (!currentSongId || !isPlaying) return;
    audioManager.pause();
    set({ isPlaying: false, userPaused: true });
  },

  syncPlaybackFromMediaElement: () => {
    const { currentSongId } = get();
    if (!currentSongId) return;
    const paused = audioManager.paused;
    set({
      isPlaying: !paused,
      userPaused: paused,
    });
  },
}));
