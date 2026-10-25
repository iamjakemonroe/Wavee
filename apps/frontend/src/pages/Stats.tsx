import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { LuChartColumn, LuCompass, LuEar, LuFlame, LuHeadphones, LuLock, LuMusic, LuSparkles, LuUserPlus } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router-dom';
import { FeedbackSummaryView } from '../components/growth/Feedback';
import { BarList, ChartCard, Columns, SplitBar, StatTile, TrendChart } from '../components/stats/Charts';
import { Avatar, Button, Cover, EmptyState, Skeleton } from '../components/ui';
import { useInsights, useListening, useUserSongs } from '../hooks/data';
import type { Insights, Listening, PlaySource } from '../lib/api';
import { count } from '../lib/format';
import { useAuth, withAccount } from '../store/auth';
import { useMoney } from '../store/money';

const RANGES = [
  [7, '7 days'],
  [28, '28 days'],
  [90, '90 days'],
  [365, '12 months'],
] as const;

const SOURCES: Record<PlaySource, string> = {
  feed: 'The feed',
  new: 'First listens',
  boost: 'Boosts',
  home: 'Home',
  search: 'Search',
  profile: 'Your profile',
  playlist: 'Playlists',
  charts: 'Charts',
  picks: 'Fresh Finds',
  library: 'Libraries',
  song: 'Song pages',
  link: 'Shared links',
  other: 'Other',
};

/** The next round number to aim for. */
const MILESTONES = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const nextMilestone = (n: number) => MILESTONES.find((m) => m > n) ?? Math.ceil((n + 1) / 1_000_000) * 1_000_000;

const regions = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' });
  } catch {
    return null;
  }
})();
const flag = (code: string) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
const countryName = (code: string) => regions?.of(code) ?? code;

function Range({ days, full, onPick }: { days: number; full: boolean; onPick: (d: number) => void }) {
  const showPro = useMoney((s) => s.showPro);
  return (
    <div className="flex gap-1 rounded-full bg-line/[0.05] p-1" role="radiogroup" aria-label="Period">
      {RANGES.map(([d, label]) => {
        const locked = !full && d > 28;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => (locked ? showPro(true) : onPick(d))}
            className={clsx(
              'inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition',
              days === d ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
            )}
          >
            {label}
            {locked && <LuLock className="text-[11px]" aria-label="With Artist Pro" />}
          </button>
        );
      })}
    </div>
  );
}

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={clsx(
            'h-8 rounded-full px-3 text-[12.5px] font-medium transition',
            value === v ? 'bg-line/[0.1] text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const periodName = (days: number) => (days === 365 ? 'the 12 months before' : `the ${days} days before`);

/** All-time listeners and the next round number. */
function Milestone({ all }: { all: Insights['all_time'] }) {
  const next = nextMilestone(all.listeners);
  const prev = [...MILESTONES].reverse().find((m) => m <= all.listeners) ?? 0;
  const pct = ((all.listeners - prev) / Math.max(1, next - prev)) * 100;
  return (
    <section className="relative overflow-hidden rounded-4xl border border-line/10 bg-raised/60 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_0%_0%,rgb(var(--teal)/0.14),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(var(--violet)/0.18),transparent_60%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[13px] text-muted">Listeners, all time</p>
          <p className="mt-1 text-[52px] font-bold leading-none tracking-tight">{all.listeners.toLocaleString()}</p>
        </div>
        <div className="flex gap-8 text-[13px]">
          <div>
            <p className="text-muted">Streams</p>
            <p className="mt-0.5 text-xl font-semibold">{all.streams.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted">Followers</p>
            <p className="mt-0.5 text-xl font-semibold">{all.followers.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-teal/15" role="meter" aria-valuemin={prev} aria-valuemax={next} aria-valuenow={all.listeners}>
          <div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {(next - all.listeners).toLocaleString()} more to reach <b className="text-ink">{next.toLocaleString()} listeners</b>
        </p>
      </div>
    </section>
  );
}

/** What Artist Pro adds, without pretending to show it. */
function ProTeaser() {
  const showPro = useMoney((s) => s.showPro);
  return (
    <section className="card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_100%_at_100%_0%,rgb(var(--violet)/0.18),transparent_60%)]" />
      <div className="relative">
        <p className="label flex items-center gap-1.5">
          <LuLock className="text-[12px]" /> Artist Pro
        </p>
        <h2 className="mt-2 text-xl">Know your audience</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[14px] text-muted sm:grid-cols-2">
          <li>• The countries your listeners are in</li>
          <li>• New listeners and the ones who come back</li>
          <li>• Your superfans: 5 or more streams</li>
          <li>• How much of each song people hear</li>
          <li>• 90 days and 12 months of history</li>
          <li>• A free Boost every month</li>
        </ul>
        <Button variant="brand" className="mt-5" onClick={() => showPro(true)}>
          See Artist Pro
        </Button>
      </div>
    </section>
  );
}

function MusicStats({ days, song, user, setParam }: { days: number; song: string | null; user: string | null; setParam: (k: string, v: string | null) => void }) {
  const query = useInsights(days, song, user);
  const [metric, setMetric] = useState<'streams' | 'listeners' | 'followers'>('streams');
  const i = query.data;
  if (query.isLoading || !i) {
    return query.isError ? (
      <EmptyState icon={<LuChartColumn />} title="Stats aren’t ready yet" text="We couldn’t load your stats. Please try again in a moment." />
    ) : (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-4xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }
  if (!i.songs.length) {
    return (
      <EmptyState
        icon={<LuMusic />}
        title="Your stats start with your first song"
        text="Upload a song: your first listens begin straight away, and every stream shows up here."
        action={
          <Link to="/upload">
            <Button variant="brand">Upload a song</Button>
          </Link>
        }
      />
    );
  }
  const t = i.totals;
  const p = i.prev;
  const metricShown = song && metric === 'followers' ? 'streams' : metric;
  const points = i.series.map((d) => ({ date: d.date, value: d[metricShown] ?? 0 }));
  const sources = (Object.entries(i.sources) as [PlaySource, number][]).sort((a, b) => b[1] - a[1]);
  const sourceTotal = sources.reduce((s, [, n]) => s + n, 0);
  const m = i.more;
  const heardHalf = m ? m.completion.slice(5).reduce((s, n) => s + n, 0) : 0;
  const completionTotal = m ? m.completion.reduce((s, n) => s + n, 0) : 0;

  return (
    <div className={clsx('space-y-5 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
      {!song && <Milestone all={i.all_time} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={song ?? ''}
          onChange={(e) => setParam('song', e.target.value || null)}
          className="h-9 max-w-full rounded-full border border-line/10 bg-line/[0.04] px-3.5 text-[13px] focus:border-violet/60 focus:outline-none"
          aria-label="Song"
        >
          <option value="">All songs</option>
          {i.songs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <p className="text-[12.5px] text-faint">Compared with {periodName(i.days)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Streams" value={t.streams} before={p.streams} hint="Plays of 30 seconds or more (or half a short song)" />
        <StatTile label="Listeners" value={t.listeners} before={p.listeners} hint="Different people who streamed" />
        <StatTile label="New followers" value={t.followers} before={p.followers} />
        <StatTile label="Likes" value={t.likes} before={p.likes} />
        <StatTile label="Playlist adds" value={t.playlist_adds} before={p.playlist_adds} />
        <StatTile
          label="Heard on average"
          value={t.avg_heard}
          before={p.avg_heard}
          format={(n) => `${n}%`}
          hint="How much of a song people hear, on average"
        />
      </div>

      {t.streams === 0 && (
        <p className="rounded-2xl border border-teal/25 bg-teal/[0.06] p-4 text-[14px] leading-6 text-ink/85">
          No streams in these days yet. Post your song’s story card and put your Wavee link in your bio: every share brings new
          ears, and you’ll see where they came from below.
        </p>
      )}

      <ChartCard
        title={metricShown === 'streams' ? 'Streams' : metricShown === 'listeners' ? 'Listeners' : 'New followers'}
        subtitle={i.unit === 'week' ? 'Week by week' : 'Day by day'}
        action={
          <Tabs
            value={metricShown}
            onChange={setMetric}
            options={[['streams', 'Streams'], ['listeners', 'Listeners'], ...(song ? [] : ([['followers', 'Followers']] as [typeof metric, string][]))]}
          />
        }
        table={points.map((d) => [new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), d.value.toLocaleString()])}
      >
        <TrendChart points={points} unit={i.unit} name={metricShown === 'followers' ? 'new followers' : metricShown} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {!song && (
          <section className="card p-5">
            <h2 className="text-[17px] font-semibold">Top songs</h2>
            <p className="mt-0.5 text-[13px] text-muted">By streams in these days</p>
            <ol className="mt-4 space-y-1">
              {i.top.map((s, n) => {
                const change = s.streams - s.streams_before;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setParam('song', s.id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-line/[0.05]"
                    >
                      <span className="w-4 text-center text-[13px] tabular-nums text-faint">{n + 1}</span>
                      <Cover src={s.cover_image_url} title={s.title} className="h-11 w-11" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block text-[12px] text-muted">
                          {count(s.listeners)} {s.listeners === 1 ? 'listener' : 'listeners'}
                          {s.avg_heard != null ? ` · ${s.avg_heard}% heard` : ''}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{count(s.streams)}</span>
                        <span className={clsx('block text-[11.5px] tabular-nums', change > 0 ? 'text-teal' : 'text-faint')}>
                          {change > 0 ? `+${count(change)}` : change < 0 ? `−${count(-change)}` : '–'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <ChartCard
          title="Where streams come from"
          subtitle="The page someone pressed play on"
          table={sources.map(([k, n]) => [SOURCES[k] ?? k, `${n.toLocaleString()} (${Math.round((n / Math.max(1, sourceTotal)) * 100)}%)`])}
        >
          {sources.length ? (
            <BarList items={sources.map(([k, n]) => ({ key: k, label: SOURCES[k] ?? k, value: n }))} total={sourceTotal} />
          ) : (
            <p className="text-[14px] text-muted">Once people stream your music, you’ll see whether they found it in the feed, on your profile or from a link you shared.</p>
          )}
        </ChartCard>
      </div>

      {m ? (
        <>
          <h2 className="pt-4 text-xl">Your audience</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="New and returning listeners" subtitle="Returning listeners had streamed your music before these days">
              <SplitBar parts={[{ label: 'New', value: m.audience.new }, { label: 'Returning', value: m.audience.returning }]} />
            </ChartCard>
            <section className="card p-5">
              <h2 className="text-[17px] font-semibold">How often they listen</h2>
              <p className="mt-0.5 text-[13px] text-muted">Superfans streamed 5 or more times in these days, regulars 2 to 4</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile label="Superfans" value={m.segments.super} />
                <StatTile label="Regulars" value={m.segments.regular} />
                <StatTile label="Once" value={m.segments.light} />
              </div>
            </section>
            <ChartCard
              title="Where your listeners are"
              subtitle="Countries with 5 or more listeners, so nobody can be picked out"
              table={[
                ...m.countries.shown.map((c) => [countryName(c.country), c.listeners.toLocaleString()] as [string, string]),
                ...(m.countries.other ? ([['Other countries', m.countries.other.toLocaleString()]] as [string, string][]) : []),
              ]}
            >
              {m.countries.shown.length || m.countries.other ? (
                <BarList
                  items={[
                    ...m.countries.shown.map((c) => ({
                      key: c.country,
                      label: (
                        <>
                          <span className="mr-2">{flag(c.country)}</span>
                          {countryName(c.country)}
                        </>
                      ),
                      value: c.listeners,
                    })),
                    ...(m.countries.other ? [{ key: 'other', label: 'Other countries', value: m.countries.other }] : []),
                  ]}
                />
              ) : (
                <p className="text-[14px] text-muted">Countries appear here as listeners come in.</p>
              )}
            </ChartCard>
            <ChartCard
              title="How much of the song people hear"
              subtitle={completionTotal ? `${Math.round((heardHalf / completionTotal) * 100)}% of plays heard at least half` : 'Every play, by how much was heard'}
              table={m.completion.map((n, k) => [`${k * 10}–${k * 10 + 10}%`, n.toLocaleString()])}
            >
              <Columns values={m.completion} label={(k) => `Heard ${k * 10}–${k * 10 + 10}%`} />
            </ChartCard>
          </div>
        </>
      ) : (
        <ProTeaser />
      )}

      {song && <FeedbackSummaryView songId={song} />}

      <p className="pt-2 text-[12.5px] leading-6 text-faint">
        How we count: a stream is a play of 30 seconds or more (or half of a shorter song). Your own plays never count. Days
        follow your time zone. Plays from before October 2026 don’t say where they came from, so they show as Other.
      </p>
    </div>
  );
}

function ListeningStats({ days }: { days: number }) {
  const query = useListening(days);
  const [metric, setMetric] = useState<'minutes' | 'discovered'>('minutes');
  const l: Listening | undefined = query.data;
  if (query.isLoading || !l) {
    return query.isError ? (
      <EmptyState icon={<LuHeadphones />} title="Couldn’t load your listening" text="Please try again in a moment." />
    ) : (
      <Skeleton className="h-72 rounded-3xl" />
    );
  }
  const t = l.totals;
  const p = l.prev;
  return (
    <div className={clsx('space-y-5 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Minutes listened" value={t.minutes} before={p.minutes} />
        <StatTile label="Artists heard" value={t.artists} before={p.artists} />
        <StatTile label="New artists found" value={t.discovered} before={p.discovered} />
        <StatTile label="Songs liked" value={t.likes} before={p.likes} />
      </div>
      <ChartCard
        title={metric === 'minutes' ? 'Minutes listened' : 'New artists found'}
        subtitle={l.unit === 'week' ? 'Week by week' : 'Day by day'}
        action={<Tabs value={metric} onChange={setMetric} options={[['minutes', 'Minutes'], ['discovered', 'New artists']]} />}
        table={l.series.map((d) => [d.date, String(d[metric])])}
      >
        <TrendChart points={l.series.map((d) => ({ date: d.date, value: d[metric] }))} unit={l.unit} name={metric === 'minutes' ? 'minutes' : 'new artists'} />
      </ChartCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-[17px] font-semibold">Your top artists</h2>
          <p className="mt-0.5 text-[13px] text-muted">By streams in these days</p>
          {l.top_artists.length ? (
            <ol className="mt-4 space-y-1">
              {l.top_artists.map((a, n) => (
                <li key={a.id}>
                  <Link to={`/u/${a.username}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-line/[0.05]">
                    <span className="w-4 text-center text-[13px] tabular-nums text-faint">{n + 1}</span>
                    <Avatar src={a.avatar_url} name={a.display_name || a.username} className="h-10 w-10" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.display_name || a.username}</span>
                    <span className="text-[13px] tabular-nums text-muted">{count(a.streams)} streams</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-[14px] text-muted">Start the feed and your favourites will show up here.</p>
          )}
        </section>
        <section className="card p-5">
          <h2 className="text-[17px] font-semibold">Your ear</h2>
          <p className="mt-0.5 text-[13px] text-muted">All time on Wavee</p>
          <ul className="mt-4 space-y-3 text-[14px]">
            <Badge icon={<LuFlame />} title={l.streak ? `${l.streak}-week explorer streak` : 'No explorer streak yet'}>
              Find 3 new artists in a week to keep it going.
            </Badge>
            <Badge icon={<LuEar />} title={`${l.ear.early_likes} early ${l.ear.early_likes === 1 ? 'find' : 'finds'}, ${l.ear.hits} ${l.ear.hits === 1 ? 'hit' : 'hits'}`}>
              Songs you liked early, and how many took off.
            </Badge>
            <Badge icon={<LuCompass />} title={`${l.all_time.discovered.toLocaleString()} artists discovered`}>
              {l.all_time.minutes.toLocaleString()} minutes of music on Wavee.
            </Badge>
            <Badge icon={<LuUserPlus />} title={`${l.invited} ${l.invited === 1 ? 'person' : 'people'} you brought`}>
              Everyone who joined from your link.
            </Badge>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Badge({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-line/[0.06] text-teal">{icon}</span>
      <span>
        <b className="block font-semibold">{title}</b>
        <span className="text-[13px] text-muted">{children}</span>
      </span>
    </li>
  );
}

/** Stats: how your music is growing (artists), and your own listening (everyone). */
export function Stats() {
  const [params, setParams] = useSearchParams();
  const session = useAuth((s) => s.session);
  const account = useAuth((s) => s.account);
  const loading = useAuth((s) => s.loading);
  const mine = useUserSongs(account?.id).data;
  const user = account?.is_admin ? params.get('user') : null;
  const name = params.get('name');
  const artist = !!user || !!account?.is_artist || !!mine?.length;
  const tab = params.get('tab') === 'listening' || !artist ? 'listening' : 'music';
  const asked = Number(params.get('days'));
  const days = RANGES.some(([d]) => d === asked) ? asked : 28;
  const song = params.get('song');
  const shown = useInsights(days, song, user, tab === 'music').data;
  const full = shown?.full ?? false;
  // Without Pro, a longer period asked for in the address shows 28 days.
  const period = tab === 'music' ? (shown?.days ?? days) : days;

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value == null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  if (loading) return <Skeleton className="mt-8 h-72 rounded-3xl" />;
  if (!session) {
    return (
      <EmptyState
        icon={<LuChartColumn />}
        title="Your stats live here"
        text="Sign in to see how your music is growing, and your own listening."
        action={
          <Button variant="brand" onClick={() => withAccount('Sign in to see your stats.', () => undefined)}>
            Sign in
          </Button>
        }
      />
    );
  }

  return (
    <div className="animate-rise pb-6">
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">{user ? `Stats for ${name ? `@${name}` : 'an artist'}` : 'Your stats'}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {tab === 'music' ? 'How your music is growing. Real listens only: never your own.' : 'Your listening on Wavee.'}
          </p>
        </div>
        {artist && !user && (
          <div className="flex gap-1 rounded-full bg-line/[0.05] p-1">
            {(
              [
                ['music', 'Your music', <LuSparkles key="m" />],
                ['listening', 'Your listening', <LuHeadphones key="l" />],
              ] as const
            ).map(([t, label, icon]) => (
              <button
                key={t}
                type="button"
                onClick={() => setParam('tab', t === 'music' ? null : t)}
                aria-pressed={tab === t}
                className={clsx(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition',
                  tab === t ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5">
        <Range days={period} full={tab === 'listening' || full} onPick={(d) => setParam('days', d === 28 ? null : String(d))} />
      </div>

      {tab === 'music' ? <MusicStats days={days} song={song} user={user} setParam={setParam} /> : <ListeningStats days={days} />}
    </div>
  );
}
