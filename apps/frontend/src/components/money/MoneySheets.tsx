import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LuChartColumn, LuCrown, LuFlaskConical, LuGift, LuLock, LuRocket, LuUpload, LuUsers } from 'react-icons/lu';
import { keys, payStatusQuery, shopQuery, useMyPlan } from '../../hooks/data';
import type { Song } from '../../lib/api';
import { CURRENCY, money, payApi, type Currency } from '../../lib/pay';
import { useAuth } from '../../store/auth';
import { useMoney } from '../../store/money';
import { toast } from '../../store/toast';
import { Link } from 'react-router-dom';
import { FeedbackSummaryView } from '../growth/Feedback';
import { Button, Cover, LoadError, Modal, Spinner } from '../ui';
import { plural } from '../../lib/format';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

/** Under every pay button: what the payment agrees to, opened in a new tab so the sheet stays. */
function PayTerms() {
  return (
    <p className="mt-1 text-center text-[11.5px] leading-5 text-faint">
      By paying you agree to the{' '}
      <Link to="/terms" target="_blank" className="underline decoration-line/30 underline-offset-2 hover:text-muted">
        Terms
      </Link>{' '}
      and{' '}
      <Link to="/refunds" target="_blank" className="underline decoration-line/30 underline-offset-2 hover:text-muted">
        Refund Policy
      </Link>
      .
    </p>
  );
}

/** Says so when payments are Flutterwave's test mode (no real money). */
function TestNote({ test }: { test: boolean }) {
  if (!test) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warn/25 bg-warn/[0.07] px-3.5 py-2.5 text-[12.5px] leading-5 text-warn">
      <LuFlaskConical className="mt-0.5 shrink-0" />
      Test mode: no real money. Pay with one of Flutterwave’s test cards.
    </p>
  );
}

/** What a money sheet shows comes in together: [ready] once the prices, your plan and whether
 * payments are on are all known (a check for payments that failed or ran out of time counts as
 * off), so the sheet shows at once rather than piece by piece. */
function useShelf(currency: Currency) {
  const shop = useQuery(shopQuery(currency));
  const plan = useMyPlan();
  const status = useQuery(payStatusQuery);
  const known = !!shop.data && !plan.isLoading && !status.isLoading;
  // Once it's up it stays up: a check asked again while the sheet is open (back online, say) never
  // brings the loader back.
  const [shown, setShown] = useState(known);
  if (known && !shown) setShown(true);
  return { shop, plan: plan.data, test: !!status.data?.test, ready: shown || known };
}

function Perk({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-line/[0.04] p-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal">{icon}</span>
      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="block text-[12.5px] leading-5 text-muted">{text}</span>
      </span>
    </li>
  );
}

// ── Boost ───────────────────────────────────────────────────────────────

// The song comes as a prop: a closing sheet keeps showing it after the store has moved on.
function BoostBody({ song }: { song: Song }) {
  const showPro = useMoney((s) => s.showPro);
  const close = useMoney((s) => s.boost);
  const client = useQueryClient();
  const currency = CURRENCY;
  const { shop, plan, test, ready } = useShelf(currency);
  const [going, setGoing] = useState<string | null>(null);

  const buy = async (pack: string) => {
    setGoing(pack);
    try {
      window.location.assign((await payApi.boost(song.id, pack, currency)).link);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t start the payment.', 'error');
      setGoing(null);
    }
  };

  const free = async () => {
    setGoing('free');
    try {
      await payApi.freeBoost(song.id);
      await Promise.all([client.invalidateQueries({ queryKey: keys.myPlan }), client.invalidateQueries({ queryKey: keys.myBoosts })]);
      toast(`“${song.title}” is boosted to 100 new listeners`, 'success');
      close(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t boost it.', 'error');
    } finally {
      setGoing(null);
    }
  };

  if (shop.isError && !shop.data) return <LoadError what="the prices" onRetry={() => void shop.refetch()} />;
  // One loader until all of it is known, never a price or a button that comes in after the rest.
  if (!ready) return <Spinner className="mx-auto my-24 block h-7 w-7 text-muted" />;

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-line/[0.04] p-3">
        <Cover src={song.cover_image_url} title={song.title} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{song.title}</p>
          <p className="text-[13px] text-muted">Shown as Promoted in the feed until it reaches them</p>
        </div>
      </div>
      <TestNote test={test} />
      {plan?.free_boost && (
        <button
          type="button"
          onClick={() => void free()}
          disabled={!!going}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-teal/30 bg-teal/[0.08] p-3.5 text-left transition hover:bg-teal/[0.12]"
        >
          <LuGift className="shrink-0 text-[20px] text-teal" />
          <span className="flex-1">
            <span className="block text-[14.5px] font-semibold">Use this month’s free Boost</span>
            <span className="block text-[12.5px] text-muted">100 new listeners, with Artist Pro</span>
          </span>
          {going === 'free' && <Spinner className="h-4 w-4" />}
        </button>
      )}
      <div className="space-y-2">
        {shop.data?.packs.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line/[0.07] bg-line/[0.03] p-3 pl-4">
            <LuUsers className="shrink-0 text-teal" />
            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] font-semibold">{p.listeners.toLocaleString()} new listeners</p>
              <p className="text-[12.5px] text-faint">{money(p.amount / p.listeners, p.currency)} a listener</p>
            </div>
            <Button size="sm" variant="brand" className="min-w-[96px]" loading={going === p.id} disabled={!!going} onClick={() => void buy(p.id)}>
              {money(p.amount, p.currency)}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] leading-5 text-faint">
        A listener counts once they’ve really listened. Boosted plays don’t count toward the charts, so the charts stay
        fair.
      </p>
      {!plan?.pro_until && (
        <button onClick={() => showPro(true)} className="mx-auto mt-2 block text-[13px] font-semibold text-teal hover:underline">
          Artist Pro includes a free Boost every month
        </button>
      )}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-faint">
        <LuLock /> Paid securely with Flutterwave
      </p>
      <PayTerms />
    </div>
  );
}

// ── Artist Pro ──────────────────────────────────────────────────────────

function ProBody() {
  const client = useQueryClient();
  const currency = CURRENCY;
  const { shop, plan, test, ready } = useShelf(currency);
  const price = shop.data?.plans[0];
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      window.location.assign((await payApi.subscribe(currency)).link);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t start the payment.', 'error');
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const r = await payApi.cancel();
      await client.invalidateQueries({ queryKey: keys.myPlan });
      toast(r.until ? `Cancelled. Artist Pro lasts until ${day(r.until)}.` : 'Cancelled.', 'success');
      setConfirming(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t cancel just now.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (shop.isError && !shop.data) return <LoadError what="the prices" onRetry={() => void shop.refetch()} />;
  // One loader until all of it is known, never a price or a button that comes in after the rest.
  if (!ready) return <Spinner className="mx-auto my-24 block h-7 w-7 text-muted" />;

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-brand text-[28px] text-bg shadow-glow-teal">
          <LuCrown />
        </span>
        <h2 className="mt-4 text-[22px]">Wavee Artist Pro</h2>
        <p className="mt-1.5 max-w-xs text-[14px] leading-5 text-muted">
          {plan?.pro_until ? `You’re Pro until ${day(plan.pro_until)}.` : 'For artists who take it seriously.'}
        </p>
      </div>
      <ul className="mt-5 space-y-2.5">
        <Perk icon={<LuRocket />} title="A free Boost every month" text="100 new listeners for a song of your choice." />
        <Perk
          icon={<LuChartColumn />}
          title="Full stats"
          text="12 months of history, where your listeners are, your superfans, and how much of each song people hear."
        />
        <Perk icon={<LuUpload />} title="Bigger uploads" text="Lossless masters (WAV, FLAC) up to 95 MB." />
      </ul>
      <div className="mt-5">
        {plan?.pro_until ? (
          confirming ? (
            <div className="rounded-2xl bg-danger/10 p-3.5">
              <p className="text-[13.5px] leading-5 text-ink/90">
                Cancel Artist Pro? Nothing more is charged, and you keep it until {day(plan.pro_until)}.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                  Keep Pro
                </Button>
                <Button size="sm" variant="danger" className="flex-1" loading={busy} onClick={() => void cancel()}>
                  Cancel plan
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="w-full" onClick={() => setConfirming(true)}>
              Cancel my plan
            </Button>
          )
        ) : (
          <>
            <TestNote test={test} />
                  <Button variant="brand" size="lg" className="w-full" loading={busy} disabled={!price} onClick={() => void join()}>
              {price ? `Go Pro for ${money(price.amount, price.currency)} a month` : 'Go Pro'}
            </Button>
            <p className="mt-3 text-center text-[12px] leading-5 text-faint">Renews every month until you cancel, any time, right here.</p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-faint">
              <LuLock /> Paid securely with Flutterwave (card)
            </p>
            <PayTerms />
          </>
        )}
      </div>
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────

function StatsBody({ song }: { song: Song }) {
  const showPro = useMoney((s) => s.showPro);
  const stats = useQuery({ queryKey: ['song-stats', song.id], queryFn: () => payApi.stats(song.id) });
  const s = stats.data;
  const top = Math.max(1, ...(s?.days ?? []).map((d) => d.plays));
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Cover src={song.cover_image_url} title={song.title} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{song.title}</p>
          <p className="text-[13px] text-muted">The last 30 days</p>
        </div>
      </div>
      {!s ? (
        <Spinner className="mx-auto my-10 block h-6 w-6 text-muted" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Plays', s.plays],
              ['Listeners', s.listeners],
              ['Heard on average', `${s.heard_pct}%`],
              ['Likes', s.likes],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-line/[0.04] p-4">
                <p className="text-[22px] font-bold leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                <p className="mt-1.5 text-[12.5px] text-muted">{label}</p>
              </div>
            ))}
          </div>
          {s.days ? (
            <div className="mt-5">
              <p className="label mb-3">Plays a day</p>
              <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Plays each day for the last 30 days">
                {s.days.map((d) => (
                  <span
                    key={d.day}
                    title={`${new Date(d.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${d.plays} ${plural(d.plays, 'play')}`}
                    className="flex-1 rounded-t-sm bg-brand"
                    style={{ height: `${Math.max(3, (d.plays / top) * 100)}%`, opacity: d.plays ? 1 : 0.25 }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => showPro(true)}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-teal/30 bg-teal/[0.08] p-3.5 text-left"
            >
              <LuChartColumn className="shrink-0 text-[20px] text-teal" />
              <span className="flex-1 text-[13.5px] leading-5">
                <span className="font-semibold">See every day with Artist Pro</span>, plus a free Boost each month.
              </span>
            </button>
          )}
          <FeedbackSummaryView songId={song.id} />
          <Link to={`/stats?song=${song.id}`} onClick={() => useMoney.getState().showStats(null)} className="mt-5 block">
            <Button variant="secondary" className="w-full" icon={<LuChartColumn />}>
              All stats for this song
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}

/** Boost, Artist Pro and stats sheets, opened from anywhere (useMoney). */
export function MoneySheets() {
  const boosting = useMoney((s) => s.boosting);
  const pro = useMoney((s) => s.pro);
  const stats = useMoney((s) => s.stats);
  const boost = useMoney((s) => s.boost);
  const showPro = useMoney((s) => s.showPro);
  const showStats = useMoney((s) => s.showStats);
  const user = useAuth((s) => s.session?.user.id);
  const client = useQueryClient();

  // What the Boost and Artist Pro sheets show is fetched as the app opens, so they open with all of it.
  useEffect(() => {
    if (!user) return;
    void client.prefetchQuery(payStatusQuery);
    void client.prefetchQuery(shopQuery(CURRENCY));
  }, [user, client]);

  return (
    <>
      <Modal open={!!boosting} onClose={() => boost(null)} title="Boost this song">
        {boosting && <BoostBody song={boosting} />}
      </Modal>
      <Modal open={pro} onClose={() => showPro(false)}>
        {pro && <ProBody />}
      </Modal>
      <Modal open={!!stats} onClose={() => showStats(null)} title="Stats">
        {stats && <StatsBody song={stats} />}
      </Modal>
    </>
  );
}

/** Back from Flutterwave's checkout (?status=…&tx_ref=wavee-…&transaction_id=…): asks whether it
 * went through, says so, and tidies the address. Waits for the sign-in to be restored first. */
export function PaymentReturn() {
  const session = useAuth((s) => s.session);
  const ready = !useAuth((s) => s.loading);
  const client = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('tx_ref');
    if (!ref?.startsWith('wavee-') || done.current || !ready) return;
    done.current = true;
    const tidy = () => {
      ['status', 'tx_ref', 'transaction_id'].forEach((k) => params.delete(k));
      const rest = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    };
    const id = params.get('transaction_id');
    if (params.get('status') === 'cancelled' || !id) {
      tidy();
      toast('Payment cancelled. No money was taken.');
      return;
    }
    if (!session) {
      tidy();
      toast('Sign in to see your payment.');
      return;
    }
    toast('Checking your payment…');
    void payApi
      .confirm(ref, id)
      .then(async (r) => {
        tidy();
        if (r.status === 'paid') {
          await Promise.all([
            client.invalidateQueries({ queryKey: keys.myPlan }),
            client.invalidateQueries({ queryKey: keys.myBoosts }),
          ]);
          toast(r.kind === 'pro' ? 'Welcome to Artist Pro!' : 'Your Boost is live. New listeners are on their way.', 'success');
        } else if (r.status === 'pending') {
          toast('Your payment is still going through. It’ll show up as soon as it does.');
        } else {
          toast('That payment didn’t go through. No money was taken.', 'error');
        }
      })
      .catch((e) => {
        tidy();
        toast(e instanceof Error ? e.message : 'Couldn’t check that payment.', 'error');
      });
  }, [ready, session, client]);

  return null;
}
