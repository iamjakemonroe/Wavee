import { supabase, accessToken } from './supabase';
import type { Song } from './api';

/** Wavee's money: Boost and Artist Pro, paid on Flutterwave's checkout (the Worker's /api/pay). */

/** Everything is priced and charged in US dollars: Flutterwave converts for cards in other
 * currencies. */
export type Currency = 'USD';
export const CURRENCY: Currency = 'USD';

export interface Pack {
  id: string;
  listeners: number;
  currency: string;
  amount: number;
}

export interface PlanPrice {
  id: string;
  title: string;
  period: 'weekly' | 'monthly';
  currency: string;
  amount: number;
}

/** Whether payments are switched on, and whether it's Flutterwave's test mode (no real money). */
export interface PayStatus {
  on: boolean;
  test: boolean;
}

/** The longest the check for whether payments are on takes: no answer by then counts as off, so a
 * money sheet never waits on it for long. */
export const PAY_WAIT = 4500;

export interface MyPlan {
  pro_until: string | null;
  free_boost: boolean;
}

export interface Boost {
  id: string;
  song_id: string;
  title: string;
  cover: string | null;
  listeners: number;
  reached: number;
  status: 'active' | 'done' | 'stopped';
  /** 'welcome': a new artist's first listens, free. */
  source: 'paid' | 'pro' | 'welcome';
  created_at: string;
}

export interface Promoted {
  boost_id: string;
  /** 'new' for a new artist's first listens. */
  kind: 'promoted' | 'new';
  song: Song;
}

export interface Stats {
  pro: boolean;
  plays: number;
  listeners: number;
  heard_pct: number;
  likes: number;
  days: { day: string; plays: number; listeners: number }[] | null;
}

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: amount % 1 ? 2 : 0,
  }).format(amount);

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

function friendly(message: string): string {
  if (/no free boost/.test(message)) return 'This month’s free Boost is used.';
  if (/not live/.test(message)) return 'That song isn’t live.';
  if (/not your song/.test(message)) return 'That’s not your song.';
  return 'Something went wrong. Please try again.';
}

/** [promise], or a failure once [ms] have passed without its answer. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No answer in time.')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Calls the Worker's /api/pay/[path] as the signed-in user. */
async function pay<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`/api/pay/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Couldn’t reach the payment service. Try again.');
  return data;
}

export const payApi = {
  /** Fails, rather than guessing, when the Worker can't be reached or takes longer than PAY_WAIT,
   * so a failed check isn't kept (payStatusQuery). */
  status: () => within(pay<PayStatus>('status'), PAY_WAIT),
  shop: (currency: Currency) => rpc<{ packs: Pack[]; plans: PlanPrice[] }>('wavee_shop', { p_currency: currency }),
  myPlan: () => rpc<MyPlan>('wavee_my_plan'),
  myBoosts: () => rpc<Boost[]>('my_boosts'),
  promoted: (limit = 2) => rpc<Promoted[]>('get_promoted', { p_limit: limit }),
  heard: (boost: string) => rpc<{ counted: boolean }>('boost_heard', { p_boost: boost }),
  freeBoost: (song: string) => rpc<{ id: string; listeners: number }>('boost_free', { p_song: song }),
  stats: (song: string) => rpc<Stats>('song_stats', { p_song: song }),
  boost: (song: string, pack: string, currency: Currency) => pay<{ link: string }>('boost', { song, pack, currency }),
  subscribe: (currency: Currency) => pay<{ link: string }>('subscribe', { plan: 'wavee.pro.monthly', currency }),
  confirm: (ref: string, transactionId: string) =>
    pay<{ status: string; kind?: 'boost' | 'pro'; listeners?: number; until?: string }>('confirm', { ref, transaction_id: transactionId }),
  cancel: () => pay<{ status: string; until: string | null }>('cancel'),
};
