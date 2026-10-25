import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { api, type Account } from '../lib/api';
import { claimReferrer } from '../lib/growth';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  account: Account | null;
  /** Still finding out whether someone is signed in. */
  loading: boolean;
  /** Something needs an account: the sign-in prompt is open. */
  prompt: string | null;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  askToSignIn: (reason: string) => void;
  closePrompt: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  account: null,
  loading: true,
  prompt: null,

  async refreshAccount() {
    if (!get().session) {
      set({ account: null });
      return;
    }
    try {
      const account = await api.myAccount();
      set({ account });
      if (account) void claimReferrer(account.username);
    } catch {
      // Keep what we had; it refreshes on the next sign-in event.
    }
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, account: null });
  },

  askToSignIn: (reason) => set({ prompt: reason }),
  closePrompt: () => set({ prompt: null }),
}));

/** Keeps the store in step with Supabase's session. */
export function startAuth() {
  void supabase.auth.getSession().then(async ({ data }) => {
    useAuth.setState({ session: data.session });
    await useAuth.getState().refreshAccount();
    useAuth.setState({ loading: false });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    useAuth.setState({ session });
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      // Outside the callback, as Supabase asks.
      window.setTimeout(() => void useAuth.getState().refreshAccount(), 0);
    }
    if (event === 'SIGNED_OUT') useAuth.setState({ account: null });
  });
}

/** Runs [action] if someone's signed in; otherwise asks them to sign in. */
export function withAccount(reason: string, action: () => void) {
  if (useAuth.getState().session) action();
  else useAuth.getState().askToSignIn(reason);
}
