import { isPro, pay, type PayEnv } from './pay';

/**
 * wavee.kaivon.app: serves the web app, takes uploads into R2, and gives
 * shared song and artist links a proper preview (title, cover) for chat
 * apps and social sites.
 *
 *   POST   /api/upload?kind=audio|video|cover|avatar|playlist|bug   → { key, url }
 *   DELETE /api/object?key=<key>                                    → { ok }
 *   POST   /api/pay/*   Boost and Artist Pro through Flutterwave (worker/pay.ts)
 *
 * Uploads need the user's Supabase access token (bugs may be anonymous).
 * Each file's first bytes are checked against its kind, so a renamed file
 * can't pass as audio.
 */

interface Env extends PayEnv {
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MEDIA_ORIGIN: string;
}

type Kind = 'audio' | 'video' | 'cover' | 'avatar' | 'playlist' | 'bug';

interface Rule {
  max: number;
  types: Record<string, { ext: string; matches: (b: Uint8Array) => boolean }>;
}

const MB = 1024 * 1024;

const at = (b: Uint8Array, offset: number, ...bytes: number[]) =>
  bytes.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, offset: number, text: string) =>
  at(b, offset, ...[...text].map((c) => c.charCodeAt(0)));

const isMp3 = (b: Uint8Array) => ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
const isMp4 = (b: Uint8Array) => ascii(b, 4, 'ftyp');
const isWav = (b: Uint8Array) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE');
const isOgg = (b: Uint8Array) => ascii(b, 0, 'OggS');
const isFlac = (b: Uint8Array) => ascii(b, 0, 'fLaC');
const isWebm = (b: Uint8Array) => at(b, 0, 0x1a, 0x45, 0xdf, 0xa3);
const isJpeg = (b: Uint8Array) => at(b, 0, 0xff, 0xd8, 0xff);
const isPng = (b: Uint8Array) => at(b, 0, 0x89, 0x50, 0x4e, 0x47);
const isWebp = (b: Uint8Array) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP');

const images = {
  'image/jpeg': { ext: 'jpg', matches: isJpeg },
  'image/png': { ext: 'png', matches: isPng },
  'image/webp': { ext: 'webp', matches: isWebp },
};

const RULES: Record<Kind, Rule> = {
  audio: {
    max: 50 * MB,
    types: {
      'audio/mpeg': { ext: 'mp3', matches: isMp3 },
      'audio/mp4': { ext: 'm4a', matches: isMp4 },
      'audio/x-m4a': { ext: 'm4a', matches: isMp4 },
      'audio/aac': { ext: 'm4a', matches: isMp4 },
      'audio/wav': { ext: 'wav', matches: isWav },
      'audio/x-wav': { ext: 'wav', matches: isWav },
      'audio/ogg': { ext: 'ogg', matches: isOgg },
      'audio/flac': { ext: 'flac', matches: isFlac },
      'audio/x-flac': { ext: 'flac', matches: isFlac },
    },
  },
  video: {
    max: 100 * MB,
    types: {
      'video/mp4': { ext: 'mp4', matches: isMp4 },
      'video/webm': { ext: 'webm', matches: isWebm },
    },
  },
  cover: { max: 8 * MB, types: images },
  avatar: { max: 5 * MB, types: images },
  playlist: { max: 5 * MB, types: images },
  bug: { max: 5 * MB, types: images },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** The signed-in user's id, checked with Supabase, or null. */
async function userId(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: auth, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function upload(request: Request, env: Env): Promise<Response> {
  const kind = new URL(request.url).searchParams.get('kind') as Kind | null;
  const rule = kind ? RULES[kind] : undefined;
  if (!kind || !rule) return json({ error: 'Unknown upload kind.' }, 400);

  const uid = await userId(request, env);
  if (!uid && kind !== 'bug') return json({ error: 'Please sign in to upload.' }, 401);

  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const spec = rule.types[type];
  if (!spec) return json({ error: 'That file type isn’t supported here.' }, 415);

  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) return json({ error: 'Empty upload.' }, 411);
  // Artist Pro uploads three times bigger audio and video (lossless masters, longer videos).
  const proMax = kind === 'audio' || kind === 'video' ? rule.max * 3 : rule.max;
  if (length > rule.max && !(length <= proMax && uid && (await isPro(env, request.headers.get('authorization')!)))) {
    return json(
      { error: `That file is too big (the limit is ${rule.max / MB} MB${proMax > rule.max ? `, ${proMax / MB} MB with Artist Pro` : ''}).` },
      413,
    );
  }
  if (!request.body) return json({ error: 'Empty upload.' }, 400);

  // Read the first bytes to check what the file really is, then send them
  // and the rest on to R2 without holding the whole file.
  const reader = request.body.getReader();
  const head: Uint8Array[] = [];
  let seen = 0;
  while (seen < 16) {
    const { value, done } = await reader.read();
    if (done) break;
    head.push(value);
    seen += value.byteLength;
  }
  const start = new Uint8Array(seen);
  let offset = 0;
  for (const chunk of head) {
    start.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!spec.matches(start)) {
    await reader.cancel();
    return json({ error: 'That file doesn’t look like what it says it is.' }, 415);
  }

  const stream = new FixedLengthStream(length);
  const writer = stream.writable.getWriter();
  const pump = (async () => {
    await writer.write(start);
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.close();
  })();

  const key = `${kind}/${uid ?? 'anon'}/${crypto.randomUUID()}.${spec.ext}`;
  try {
    await Promise.all([
      env.MEDIA.put(key, stream.readable, {
        httpMetadata: {
          contentType: type.startsWith('audio/x-') ? type.replace('x-', '') : type,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: { owner: uid ?? 'anon' },
      }),
      pump,
    ]);
  } catch {
    return json({ error: 'The upload didn’t finish. Please try again.' }, 500);
  }
  return json({ key, url: `${env.MEDIA_ORIGIN}/${key}` });
}

async function remove(request: Request, env: Env): Promise<Response> {
  const uid = await userId(request, env);
  if (!uid) return json({ error: 'Please sign in.' }, 401);
  const key = new URL(request.url).searchParams.get('key') ?? '';
  const [kind, owner] = key.split('/');
  if (!(kind in RULES) || kind === 'bug' || owner !== uid) {
    return json({ error: 'You can only delete your own files.' }, 403);
  }
  await env.MEDIA.delete(key);
  return json({ ok: true });
}

/** Deletes every file the caller uploaded (before their account goes). */
async function removeAll(request: Request, env: Env): Promise<Response> {
  const uid = await userId(request, env);
  if (!uid) return json({ error: 'Please sign in.' }, 401);
  let deleted = 0;
  for (const kind of Object.keys(RULES)) {
    if (kind === 'bug') continue;
    let cursor: string | undefined;
    do {
      const page = await env.MEDIA.list({ prefix: `${kind}/${uid}/`, cursor, limit: 1000 });
      if (page.objects.length) {
        await env.MEDIA.delete(page.objects.map((o) => o.key));
        deleted += page.objects.length;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return json({ ok: true, deleted });
}

/** The app's page, with the song's or artist's own title and picture in
 * its preview tags. */
async function withPreview(request: Request, env: Env, path: string): Promise<Response> {
  const page = await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
  let meta: { title: string; description: string; image?: string } | null = null;
  try {
    const rpc = async (fn: string, args: Record<string, string>) => {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as unknown;
      return Array.isArray(rows) ? rows[0] : rows;
    };
    const song = path.match(/^\/songs\/([0-9a-f-]{36})$/i);
    const user = path.match(/^\/u\/([a-z0-9_.]{3,30})$/i);
    const origin = new URL(request.url).origin;
    if (path === '/founding') {
      const s = (await rpc('founding_status', {})) as
        | { artists: { taken: number; cap: number }; listeners: { taken: number; cap: number } }
        | null;
      const left = s ? Math.max(0, s.artists.cap - s.artists.taken) + Math.max(0, s.listeners.cap - s.listeners.taken) : null;
      meta = {
        title: 'Wavee Founding 100: build Wavee from day one',
        description: `${s ? s.artists.cap : 30} artists and ${s ? s.listeners.cap : 70} listeners shaping Wavee from the start, numbered for good.${left ? ` ${left} spots left.` : ''} Hear it first.`,
        image: `${origin}/og-founding.png`,
      };
    } else if (path === '/picks') {
      meta = {
        title: 'Fresh Finds on Wavee',
        description: 'New songs the Wavee team can’t stop playing this week, and why. Hear them first.',
        image: `${origin}/og-picks.png`,
      };
    } else if (song) {
      const s = (await rpc('get_song', { p_id: song[1] })) as
        | (Record<string, string> & { features?: { username: string; display_name: string | null }[] })
        | null;
      if (s?.title) {
        const by = [s.artist_display_name || s.artist_username, ...(s.features ?? []).map((f) => f.display_name || f.username)].join(', ');
        meta = {
          title: `${s.title} · ${by} · Wavee`,
          description: `Listen to ${s.title} by ${by} on Wavee.`,
          image: s.cover_image_url || undefined,
        };
      }
    } else if (user) {
      const u = (await rpc('get_profile', { p_username: user[1] })) as Record<string, string> | null;
      if (u?.username) {
        meta = {
          title: `${u.display_name || u.username} · Wavee`,
          description: u.bio || `Music by ${u.display_name || u.username} on Wavee.`,
          image: u.avatar_url || undefined,
        };
      }
    }
  } catch {
    meta = null;
  }
  if (!meta) return page;
  const found = meta;
  return new HTMLRewriter()
    .on('title', { element: (e) => { e.setInnerContent(found.title); } })
    .on('meta[property="og:title"]', { element: (e) => { e.setAttribute('content', found.title); } })
    .on('meta[name="twitter:title"]', { element: (e) => { e.setAttribute('content', found.title); } })
    .on('meta[name="description"]', { element: (e) => { e.setAttribute('content', found.description); } })
    .on('meta[property="og:description"]', {
      element: (e) => {
        e.setAttribute('content', found.description);
      },
    })
    .on('meta[property="og:image"]', {
      element: (e) => {
        if (found.image) e.setAttribute('content', found.image);
      },
    })
    .transform(page);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/upload' && request.method === 'POST') return upload(request, env);
    if (url.pathname === '/api/object' && request.method === 'DELETE') return remove(request, env);
    if (url.pathname === '/api/media/mine' && request.method === 'DELETE') return removeAll(request, env);
    if (url.pathname.startsWith('/api/pay/')) return pay(request, env, url.pathname.slice('/api/pay/'.length));
    if (url.pathname === '/api/geo') {
      // The listener's country, from Cloudflare, for artists' stats (never stored with anything else).
      const country = (request.cf as { country?: string } | undefined)?.country ?? null;
      return json({ country });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    if (request.method === 'GET' && (/^\/(songs|u)\//.test(url.pathname) || url.pathname === '/founding' || url.pathname === '/picks')) {
      return withPreview(request, env, url.pathname);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
