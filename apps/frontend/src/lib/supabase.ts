import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).');
}

/** The one Supabase client: sessions are kept and refreshed for us, and
 * links from emails (confirmations, password resets) sign the user in. */
export const supabase = createClient(url, key, {
  auth: {
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
