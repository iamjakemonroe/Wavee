import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let next = 1;

/** A short note at the bottom of the screen that goes away by itself. */
export function toast(message: string, tone: Toast['tone'] = 'info') {
  const id = next++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
  window.setTimeout(() => useToasts.getState().dismiss(id), tone === 'error' ? 5000 : 3200);
}
