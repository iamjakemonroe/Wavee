import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { api, type Account } from '../lib/api';
import { claimReferrer } from '../lib/growth';
import { queryClient } from '../lib/queryClient';
import { backUp, forgetBackup, hasBackup, restoreSession } from '../lib/session';
import { savedSession, supabase } from '../lib/supabase';

/** The signed-in person's account, remembered on this device so the app opens already showing
 * them (offline too), then checked with the server. Goes when they sign out. */
const ACCOUNT_KEY = 'wavee.account';

function rememberedAccount(userId: string): Account | null {
  try {
    const account = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as Account | null;
    return account?.id === userId ? account : null;
  } catch {
    return null;
  }
}

function rememberAccount(account: Account | null) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Private mode or full storage: it's only a head start.
  }
}

interface AuthState {
  session: Session | null;
  account: Account | null;
  /** Still finding out whether someone is signed in. */
  loading: boolean;
  /** Signed in, but their account couldn't be loaded (offline, usually). */
  accountFailed: boolean;
  /** Something needs an account: the sign-in prompt is open. */
  prompt: string | null;
  refreshAccount: () => Promise<void>;
  /** This device only: the person stays signed in on their phone, laptop… */
  signOut: () => Promise<void>;
  /** Every device but this one, for a lost phone or a shared computer. */
  signOutOthers: () => Promise<void>;
  askToSignIn: (reason: string) => void;
  closePrompt: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  account: null,
  loading: true,
  accountFailed: false,
  prompt: null,

  async refreshAccount() {
    if (!get().session) {
      set({ account: null });
      return;
    }
    try {
      const account = await api.myAccount();
      set({ account, accountFailed: false });
      rememberAccount(account);
      if (account) void claimReferrer(account.username);
    } catch {
      // Keep what we had; it refreshes on the next sign-in event (or Try again).
      set({ accountFailed: true });
    }
  },

  async signOut() {
    await forgetBackup();
    await supabase.auth.signOut({ scope: 'local' });
    rememberAccount(null);
    set({ session: null, account: null });
  },

  async signOutOthers() {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) throw error;
  },

  askToSignIn: (reason) => set({ prompt: reason }),
  closePrompt: () => set({ prompt: null }),
}));

/** Where this device's sign-in stands when the app opens. People stay signed in until they sign
 * out: offline, the saved session still counts (it refreshes once the connection's back), and if
 * the browser cleared its storage, the copy our server kept signs them back in. */
async function firstSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) return data.session;
  if (error && isAuthRetryableFetchError(error)) return savedSession();
  if (error) return null;
  return restoreSession();
}

/** Keeps the store in step with Supabase's session. When the signed-in person changes (or signs
 * out), everything cached for the last one goes: their likes, library and plans. */
export function startAuth() {
  let who: string | null | undefined;
  const signedInAs = (id: string | null) => {
    if (who !== undefined && who !== id) queryClient.clear();
    who = id;
  };
  // Open already signed in, from what this device saved; the checks below correct it if needed.
  const saved = savedSession();
  if (saved) {
    signedInAs(saved.user.id);
    useAuth.setState({ session: saved, account: rememberedAccount(saved.user.id) });
  }
  void firstSession().then(async (session) => {
    signedInAs(session?.user.id ?? null);
    useAuth.setState({ session });
    await useAuth.getState().refreshAccount();
    useAuth.setState({ loading: false });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    // Every new token is copied (the same one never twice); on opening, only if there's no copy yet.
    if (session && !(event === 'INITIAL_SESSION' && hasBackup())) backUp(session);
    if (event === 'SIGNED_OUT') {
      void forgetBackup();
      rememberAccount(null);
    }
    // The first session is firstSession's to set: offline, this one says no one is signed in.
    if (event === 'INITIAL_SESSION') return;
    signedInAs(session?.user.id ?? null);
    useAuth.setState({ session });
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
      // Outside the callback, as Supabase asks.
      window.setTimeout(() => void useAuth.getState().refreshAccount(), 0);
    }
    if (event === 'SIGNED_OUT') useAuth.setState({ account: null });
  });
  // Back online after opening offline: refresh now rather than on the next half-minute tick.
  window.addEventListener('online', () => void supabase.auth.getSession());
}

/** Runs [action] if someone's signed in; otherwise asks them to sign in. */
export function withAccount(reason: string, action: () => void) {
  if (useAuth.getState().session) action();
  else useAuth.getState().askToSignIn(reason);
}
