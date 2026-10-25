import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// A copy of the sign-in kept by our server in a cookie the page can't read, for when the browser
// clears the site's storage (Safari does after 7 days without a visit). See worker/session.ts.

const HINT = 'wv_signed_in';
let backedUp: string | null = null;

export const hasBackup = () => document.cookie.split(/;\s*/).includes(`${HINT}=1`);

/** After every sign-in and refresh, so the copy is never more than one refresh behind. */
export function backUp(session: Session) {
  if (session.refresh_token === backedUp) return;
  backedUp = session.refresh_token;
  void fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  }).catch(() => {
    backedUp = null;
  });
}

/** Signing out: the copy goes too. The hint is dropped here as well, so even if the server can't be
 * reached, this browser won't sign itself back in. */
export async function forgetBackup() {
  backedUp = null;
  document.cookie = `${HINT}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
  await fetch('/api/session/clear', { method: 'POST' }).catch(() => undefined);
}

/** The browser lost its sign-in but our server kept a copy: sign back in with it. */
export async function restoreSession(): Promise<Session | null> {
  if (!hasBackup()) return null;
  try {
    const res = await fetch('/api/session/restore', { method: 'POST' });
    if (res.status !== 200) return null;
    const fresh = (await res.json()) as { access_token: string; refresh_token: string };
    backedUp = fresh.refresh_token;
    const { data, error } = await supabase.auth.setSession(fresh);
    return error ? null : data.session;
  } catch {
    return null;
  }
}
