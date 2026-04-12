import { create } from "zustand";

interface LoginPromptState {
  open: boolean;
  message: string | null;
  openPrompt: (message?: string) => void;
  close: () => void;
}

export const useLoginPromptStore = create<LoginPromptState>((set) => ({
  open: false,
  message: null,
  openPrompt: (message) => set({ open: true, message: message ?? null }),
  close: () => set({ open: false, message: null }),
}));
