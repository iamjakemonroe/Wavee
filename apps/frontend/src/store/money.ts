import { create } from 'zustand';
import type { Song } from '../lib/api';

/** Which money sheet is open: boosting a song, Artist Pro, or a song's stats. */
interface MoneyState {
  boosting: Song | null;
  stats: Song | null;
  pro: boolean;
  boost: (song: Song | null) => void;
  showStats: (song: Song | null) => void;
  showPro: (open: boolean) => void;
}

export const useMoney = create<MoneyState>((set) => ({
  boosting: null,
  stats: null,
  pro: false,
  boost: (song) => set({ boosting: song, pro: false, stats: null }),
  showStats: (song) => set({ stats: song, boosting: null, pro: false }),
  showPro: (open) => set({ pro: open, boosting: null, stats: null }),
}));
