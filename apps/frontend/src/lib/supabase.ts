import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).');
}

/** Where the session is saved: the library's own default, named here so it can't drift. */
const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;

/** The one Supabase client: sessions are kept and refreshed for us, and
 * links from emails (confirmations, password resets) sign the user in. */
export const supabase = createClient(url, key, {
  auth: {
    storageKey,
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** A play still in progress when the page closes (tab closed, app swiped away): sent with
 * keepalive so it survives the page, signed in as whoever is (the session is already loaded). */
export function recordPlayOnExit(args: Record<string, unknown>, token: string | null) {
  try {
    void fetch(`${url}/rest/v1/rpc/record_play`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: key, authorization: `Bearer ${token ?? key}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    }).catch(() => undefined);
  } catch {
    // Nothing more can be done as the page goes.
  }
}

/** The current access token, for calls to our own Worker. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** The session saved on this device, read as is. When it can't be refreshed right now (offline,
 * the server slow to answer) Supabase keeps it but reports no session; this lets the app keep the
 * person signed in until the next refresh works. */
export function savedSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Session | null;
    return saved?.refresh_token && saved.user?.id ? saved : null;
  } catch {
    return null;
  }
}
