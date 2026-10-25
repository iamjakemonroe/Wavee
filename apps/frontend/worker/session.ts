// Keeps people signed in when their browser clears the site's storage: Safari wipes it after 7
// days without a visit (apps added to the home screen are exempt), and some phones clear it to
// save space. The app keeps its sign-in in the browser as usual; this keeps a copy of the newest
// refresh token in a cookie only this server can read, and trades it for a fresh session when the
// browser's own copy is gone. Supabase accepts the parent of the newest token too, so a copy one
// refresh behind still works.
//
//   POST /api/session          { refresh_token }  → 204, after every sign-in and refresh
//   POST /api/session/restore                     → the new session, or 204 when there is none
//   POST /api/session/clear                       → 204, signing out
//
// Only the page itself can call these: the Origin must be this site's, and saving needs a JSON
// body, which another site can't send without asking first.

export interface SessionEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

/** The token: HttpOnly, sent only to /api/session. */
const TOKEN = '__Secure-wv_session';
/** "There's a copy to restore", readable by the app so signed-out visitors never ask. */
const HINT = 'wv_signed_in';
/** As long as browsers allow (Chrome caps cookies at 400 days); every refresh renews it. */
const MAX_AGE = 400 * 24 * 60 * 60;

const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
};

const keep = (token: string) => [
  `${TOKEN}=${token}; Path=/api/session; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
  `${HINT}=1; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`,
];
const forget = [
  `${TOKEN}=; Path=/api/session; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  `${HINT}=; Path=/; Max-Age=0; Secure; SameSite=Lax`,
];

const TOKEN_SHAPE = /^[A-Za-z0-9_.-]{8,512}$/;

function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}

export async function session(request: Request, env: SessionEnv, action: string): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Not found.' }, 404);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Not allowed.' }, 403);

  if (action === '') {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
    const body = (await request.json().catch(() => null)) as { refresh_token?: unknown } | null;
    const token = body?.refresh_token;
    if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return json({ error: 'No session.' }, 400);
    return json(null, 204, keep(token));
  }

  if (action === 'clear') return json(null, 204, forget);

  if (action === 'restore') {
    const token = cookie(request, TOKEN);
    if (!token || !TOKEN_SHAPE.test(token)) return json(null, 204, forget);
    let res: Response;
    try {
      res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: token }),
      });
    } catch {
      return json({ error: 'Try again soon.' }, 503);
    }
    // Supabase is down or busy: keep the copy and try on the next visit.
    if (res.status === 429 || res.status >= 500) return json({ error: 'Try again soon.' }, 503);
    // Signed out elsewhere, password changed, account gone: the copy is no good any more.
    if (!res.ok) return json(null, 204, forget);
    const fresh = (await res.json()) as { refresh_token?: string };
    if (!fresh.refresh_token || !TOKEN_SHAPE.test(fresh.refresh_token)) return json(null, 204, forget);
    return json(fresh, 200, keep(fresh.refresh_token));
  }

  return json({ error: 'Not found.' }, 404);
}
