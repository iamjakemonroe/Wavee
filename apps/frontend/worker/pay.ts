// Wavee's payments, through Flutterwave: Boost (one-off) and Artist Pro
// (monthly, on a Flutterwave payment plan that charges the card again until
// it's cancelled). What Flutterwave answers over its API is the truth: a
// redirect or a webhook only says which payment to look up. The database does
// the rest (supabase/migrations/20261024120000_wavee_money.sql).
//
//   POST /api/pay/status                         → { on, test }
//   POST /api/pay/boost     { song, pack, currency }  → { link }
//   POST /api/pay/subscribe { plan, currency }        → { link }
//   POST /api/pay/confirm   { ref, transaction_id }   → { status, kind, ... }
//   POST /api/pay/cancel                              → { status, until }
//   POST /api/pay/hook      (Flutterwave's webhook, checked by its secret hash;
//                            Utopia's webhook forwards Wavee's events here,
//                            since a Flutterwave account has one webhook URL)
//
// Secrets: FLW_SECRET_KEY (FLWSECK_TEST-... for test payments), FLW_WEBHOOK_HASH,
// SUPABASE_SERVICE_ROLE_KEY. Locally they go in .dev.vars (npm run dev:api).

export interface PayEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  FLW_SECRET_KEY?: string;
  FLW_WEBHOOK_HASH?: string;
  /** Where checkout comes back to (defaults to the request's own origin). */
  PUBLIC_URL?: string;
}

const FLW = 'https://api.flutterwave.com/v3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

class Off extends Error {}

const sandbox = (env: PayEnv) => (env.FLW_SECRET_KEY ?? '').includes('_TEST');

async function flw(env: PayEnv, path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  if (!env.FLW_SECRET_KEY) throw new Off();
  const res = await fetch(`${FLW}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.FLW_SECRET_KEY}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string; data?: unknown };
  if (!res.ok || body.status !== 'success') throw new Error(`flutterwave ${path} ${res.status}: ${body.message ?? 'no answer'}`);
  return body.data as Record<string, unknown>;
}

interface Txn {
  id: string;
  ref: string;
  status: string;
  amount: number;
  currency: string;
  plan: string | null;
  email: string | null;
}

async function lookUp(env: PayEnv, id: string): Promise<Txn> {
  const d = await flw(env, `/transactions/${encodeURIComponent(id)}/verify`);
  const customer = (d.customer ?? {}) as Record<string, unknown>;
  const plan = d.plan ?? d.payment_plan;
  return {
    id: String(d.id),
    ref: String(d.tx_ref),
    status: String(d.status),
    amount: Number(d.amount),
    currency: String(d.currency),
    plan: plan == null || plan === '' ? null : String(plan),
    email: typeof customer.email === 'string' ? customer.email : null,
  };
}

/** Calls a database function as the user ([auth]: their bearer) or as the server. */
async function rpc(env: PayEnv, name: string, args: Record<string, unknown>, auth: string | 'service') {
  const key = auth === 'service' ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (auth === 'service' && !key) throw new Off();
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key!,
      authorization: auth === 'service' ? `Bearer ${key}` : auth,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new DbError(String((body as { message?: string } | null)?.message ?? res.status));
  return body as Record<string, unknown>;
}

class DbError extends Error {}

async function checkout(
  env: PayEnv,
  p: { ref: string; amount: number; currency: string; email: string; name?: string; title: string; description: string; back: string; plan?: string },
) {
  const d = await flw(env, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      tx_ref: p.ref,
      amount: p.amount,
      currency: p.currency,
      redirect_url: p.back,
      customer: { email: p.email, ...(p.name ? { name: p.name } : {}) },
      customizations: { title: p.title, description: p.description, logo: 'https://wavee.kaivon.app/icon-192.png' },
      ...(p.plan ? { payment_plan: p.plan, payment_options: 'card' } : {}),
    }),
  });
  return String(d.link);
}

/** A confirmed, successful payment, paid out once: a Boost, a Pro month or a renewal. */
async function credit(env: PayEnv, t: Txn) {
  if (t.ref.startsWith('wavee-boost-') || t.ref.startsWith('wavee-sub-')) {
    return rpc(env, 'wavee_credit', { p_ref: t.ref, p_provider_id: t.id, p_amount: t.amount, p_currency: t.currency, p_environment: sandbox(env) ? 'sandbox' : 'production' }, 'service');
  }
  return rpc(env, 'wavee_renew', { p_flw_plan_id: t.plan, p_email: t.email, p_provider_id: t.id, p_amount: t.amount, p_currency: t.currency, p_environment: sandbox(env) ? 'sandbox' : 'production' }, 'service');
}

function sameSecret(given: string | null, hash: string | undefined) {
  if (!given || !hash) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(hash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hook(request: Request, env: PayEnv): Promise<Response> {
  if (!sameSecret(request.headers.get('verif-hash'), env.FLW_WEBHOOK_HASH)) return new Response('Unauthorized', { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { event?: string; data?: Record<string, unknown> };
  const data = body.data ?? {};
  try {
    if (body.event === 'subscription.cancelled') {
      const customer = (data.customer ?? {}) as Record<string, unknown>;
      const plan = (data.plan ?? {}) as Record<string, unknown>;
      const planId = plan.id ?? data.plan_id ?? data.payment_plan;
      if (planId != null && typeof customer.email === 'string') {
        await rpc(env, 'wavee_end', { p_flw_plan_id: String(planId), p_email: customer.email }, 'service');
      }
      return new Response('ok');
    }
    if (body.event !== 'charge.completed' || data.id == null) return new Response('ignored');
    const t = await lookUp(env, String(data.id));
    if (t.status === 'successful' && (t.ref.startsWith('wavee-') || (t.plan && t.email))) await credit(env, t);
    return new Response('ok');
  } catch (e) {
    if (e instanceof Off) return new Response('off', { status: 503 });
    console.error('pay hook', e);
    return new Response('error', { status: 500 });
  }
}

export async function pay(request: Request, env: PayEnv, path: string): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (path === 'hook') return hook(request, env);
  if (path === 'status') return json({ on: !!env.FLW_SECRET_KEY && !!env.SUPABASE_SERVICE_ROLE_KEY, test: sandbox(env) });

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Please sign in.' }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const base = (env.PUBLIC_URL || new URL(request.url).origin).replace(/\/$/, '');

  try {
    if (path === 'boost') {
      let start: Record<string, unknown>;
      try {
        start = await rpc(env, 'boost_start', { p_song: String(body.song ?? ''), p_pack: String(body.pack ?? ''), p_currency: String(body.currency ?? 'USD') }, auth);
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        return json({ error: m.includes('not live') ? 'That song isn’t live.' : m.includes('not your song') ? 'You can only boost your own songs.' : 'Couldn’t start that Boost.' }, 400);
      }
      if (!env.FLW_SECRET_KEY) throw new Off();
      const listeners = Number(start.listeners).toLocaleString('en-US');
      const link = await checkout(env, {
        ref: String(start.ref),
        amount: Number(start.amount),
        currency: String(start.currency),
        email: String(start.email),
        name: typeof start.name === 'string' ? start.name : undefined,
        title: 'Wavee Boost',
        description: `“${start.title}” in front of ${listeners} new listeners`,
        back: `${base}/library?tab=boosts`,
      });
      return json({ link });
    }

    if (path === 'subscribe') {
      let start: Record<string, unknown>;
      try {
        start = await rpc(env, 'wavee_subscribe_start', { p_plan: String(body.plan ?? 'wavee.pro.monthly'), p_currency: String(body.currency ?? 'USD') }, auth);
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        return json({ error: m.includes('already a member') ? 'You’re already Artist Pro.' : 'Couldn’t start that.' }, 400);
      }
      const currency = String(start.currency);
      const amount = Number(start.amount);
      let plan = start.flw_plan_id ? String(start.flw_plan_id) : '';
      if (!plan) {
        const made = await flw(env, '/payment-plans', {
          method: 'POST',
          body: JSON.stringify({ name: `${start.title} ${currency} ${amount}`, amount, currency, interval: start.period === 'weekly' ? 'weekly' : 'monthly' }),
        });
        plan = String(made.id);
        await rpc(env, 'wavee_plan_flw', { p_plan: String(start.plan), p_currency: currency, p_flw_plan_id: plan, p_ref: String(start.ref) }, 'service');
      }
      const link = await checkout(env, {
        ref: String(start.ref),
        amount,
        currency,
        email: String(start.email),
        name: typeof start.name === 'string' ? start.name : undefined,
        title: String(start.title),
        description: 'Renews every month until you cancel',
        back: `${base}/library?tab=boosts`,
        plan,
      });
      return json({ link });
    }

    if (path === 'confirm') {
      const id = String(body.transaction_id ?? '');
      if (!/^\d+$/.test(id)) return json({ status: 'unknown' });
      const t = await lookUp(env, id);
      if (t.ref !== body.ref) return json({ status: 'unknown' });
      if (t.status !== 'successful') return json({ status: t.status });
      const paid = await credit(env, t);
      return json({ status: 'paid', ...paid });
    }

    if (path === 'cancel') {
      const mine = (await rpc(env, 'wavee_subscription_mine', {}, auth)) as Record<string, unknown> | null;
      if (!mine?.flw_plan_id) return json({ status: 'none' });
      const email = String(mine.email);
      const subs = await fetch(`${FLW}/subscriptions?email=${encodeURIComponent(email)}&plan=${encodeURIComponent(String(mine.flw_plan_id))}&status=active`, {
        headers: { authorization: `Bearer ${env.FLW_SECRET_KEY}` },
      }).then((r) => r.json() as Promise<{ data?: { id: number | string }[] }>);
      for (const s of subs.data ?? []) await flw(env, `/subscriptions/${encodeURIComponent(String(s.id))}/cancel`, { method: 'PUT' });
      const ended = await rpc(env, 'wavee_end', { p_flw_plan_id: String(mine.flw_plan_id), p_email: email }, 'service');
      return json({ status: 'cancelled', until: ended.until ?? mine.until });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof Off) return json({ error: 'Payments aren’t switched on yet.' }, 503);
    console.error('pay', path, e);
    return json({ error: 'Couldn’t reach the payment service. Try again.' }, 502);
  }
}

/** Whether the uploader is Artist Pro (bigger uploads). */
export async function isPro(env: PayEnv, auth: string): Promise<boolean> {
  try {
    const plan = await rpc(env, 'wavee_my_plan', {}, auth);
    return !!plan?.pro_until;
  } catch {
    return false;
  }
}
