import { create } from "zustand";
import type { Song } from "@/types/entities";
import { audioManager } from "@/lib/audioManager";

interface PlayerState {
  queue: Song[];
  currentSongId: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;

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
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentSongId: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 1,

  setQueue: (songs) => set({ queue: songs }),

  playSong: (song) => {
    const state = get();
    if (state.currentSongId === song.id && state.isPlaying) return;

    const exists = state.queue.some((s) => s.id === song.id);
    set({
      queue: exists ? state.queue : [song, ...state.queue],
      currentSongId: song.id,
      isPlaying: true,
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
    set({ isPlaying: willPlay });
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
      set({ currentSongId: nextSong.id, isPlaying: true, progress: 0, duration: 0 });
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
      set({ currentSongId: prevSong.id, isPlaying: true, progress: 0, duration: 0 });
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
}));
