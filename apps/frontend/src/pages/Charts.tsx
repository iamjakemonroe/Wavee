import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { LuArrowDown, LuArrowUp, LuEar, LuInfo, LuMinus, LuPlay, LuShare2, LuTrophy } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router-dom';
import { ShareCardDialog } from '../components/music/ShareCard';
import { SongRow } from '../components/music/Song';
import { Avatar, Button, EmptyState, Skeleton } from '../components/ui';
import { useChart, useTastemakers } from '../hooks/data';
import type { ChartEntry, ChartKind, Song } from '../lib/api';
import { count, GENRES } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';

const TABS = [
  { id: 'top', label: 'Top 50', text: 'The most-played songs on Wavee in the last seven days.' },
  { id: 'rising', label: 'Rising', text: 'The songs gaining the most listeners on last week.' },
  { id: 'fresh', label: 'Fresh', text: 'The best of what came out in the last two weeks.' },
  { id: 'tastemakers', label: 'Tastemakers', text: 'The listeners who find hits first.' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const CHART_NAME: Record<ChartKind, string> = { top: 'Top 50', rising: 'Rising', fresh: 'Fresh' };

function Movement({ entry }: { entry: ChartEntry }) {
  if (entry.last_rank === null) {
    return <span className="text-[10px] font-bold uppercase tracking-wide text-teal">New</span>;
  }
  const diff = entry.last_rank - entry.rank;
  if (diff === 0) return <LuMinus className="text-faint" aria-label="Same as last week" />;
  return diff > 0 ? (
    <span className="inline-flex items-center text-[11px] font-semibold text-teal" aria-label={`Up ${diff}`}>
      <LuArrowUp />
      {diff}
    </span>
  ) : (
    <span className="inline-flex items-center text-[11px] font-semibold text-danger" aria-label={`Down ${-diff}`}>
      <LuArrowDown />
      {-diff}
    </span>
  );
}

export function Charts() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'top') as Tab;
  const genre = params.get('genre');
  const set = (next: { tab?: Tab; genre?: string | null }) => {
    const p = new URLSearchParams(params);
    if (next.tab) p.set('tab', next.tab);
    if (next.genre !== undefined) {
      if (next.genre) p.set('genre', next.genre);
      else p.delete('genre');
    }
    setParams(p, { replace: true });
  };

  useEffect(() => {
    document.title = 'Charts · Wavee';
    return () => {
      document.title = 'Wavee';
    };
  }, []);

  const info = TABS.find((t) => t.id === tab)!;

  return (
    <div className="animate-rise">
      <section className="relative -mx-4 mb-6 overflow-hidden px-4 pb-8 pt-8 sm:-mx-6 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_0%_0%,rgb(var(--teal)/0.18),transparent_60%),radial-gradient(50%_80%_at_100%_10%,rgb(var(--violet)/0.22),transparent_60%)]" />
        <div className="relative">
          <p className="label flex items-center gap-2">
            <LuTrophy /> Wavee Charts
          </p>
          <h1 className="mt-3 text-[34px] leading-tight sm:text-5xl">{info.label}</h1>
          <p className="mt-2 max-w-xl text-muted">{info.text}</p>
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => set({ tab: t.id })}
                className={clsx(
                  'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition',
                  tab === t.id ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted hover:bg-line/[0.1] hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === 'tastemakers' ? <Tastemakers /> : <SongChart kind={tab} genre={genre} onGenre={(g) => set({ genre: g })} />}

      <p className="mt-10 flex items-start gap-2 text-[12px] leading-5 text-faint">
        <LuInfo className="mt-0.5 shrink-0" />
        Charts count real listens only: 30 seconds or half the song, at most one per listener every 30 seconds, never the
        artist’s own, and never paid promotion. They update every hour.
      </p>
    </div>
  );
}

function SongChart({ kind, genre, onGenre }: { kind: ChartKind; genre: string | null; onGenre: (g: string | null) => void }) {
  const chart = useChart(kind, genre);
  const playList = usePlayer((s) => s.playList);
  const me = useAuth((s) => s.session?.user.id);
  const [sharing, setSharing] = useState<{ song: Song; badge: string } | null>(null);
  const entries = chart.data ?? [];
  const songs = useMemo(() => entries.map((e) => e.song), [entries]);
  const name = `${CHART_NAME[kind]}${genre ? ` ${genre}` : ''}`;

  return (
    <>
      <div className="scroll-row mb-6 gap-2">
        {[null, ...GENRES].map((g) => (
          <button
            key={g ?? 'all'}
            onClick={() => onGenre(g)}
            className={clsx(
              'h-8 shrink-0 snap-start rounded-full border px-3.5 text-[13px] transition',
              genre === g ? 'border-teal/60 bg-teal/10 text-ink' : 'border-line/10 text-muted hover:border-line/25 hover:text-ink',
            )}
          >
            {g ?? 'All genres'}
          </button>
        ))}
      </div>

      {chart.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length ? (
        <>
          <Button variant="primary" size="sm" className="mb-4" icon={<LuPlay className="fill-current" />} onClick={() => playList(songs, 0, `Wavee ${name}`)}>
            Play the chart
          </Button>
          <ol>
            {entries.map((e, i) => (
              <li key={e.song.id} className="flex items-center gap-1 sm:gap-2">
                <div className="flex w-10 shrink-0 flex-col items-center sm:w-12">
                  <span className={clsx('font-semibold tabular-nums', e.rank <= 3 ? 'text-brand text-2xl' : 'text-lg text-ink/80')}>{e.rank}</span>
                  {kind === 'top' && <Movement entry={e} />}
                </div>
                <div className="min-w-0 flex-1">
                  <SongRow
                    song={e.song}
                    list={songs}
                    index={i}
                    source={`Wavee ${name}`}
                    showNumber={false}
                    extraMenu={[
                      {
                        label: me === e.song.artist_id ? 'Share your chart spot' : 'Share its chart spot',
                        icon: <LuShare2 />,
                        onClick: () => setSharing({ song: e.song, badge: `#${e.rank} on Wavee ${name}` }),
                      },
                    ]}
                  />
                </div>
                <span className="hidden w-24 shrink-0 text-right text-[12px] tabular-nums text-faint lg:block">
                  {count(e.plays)} this week
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <EmptyState
          icon={<LuTrophy />}
          title={genre ? `No ${genre} songs on this chart yet` : 'The chart fills up as people listen'}
          text="Share a song you love: every real listen counts toward next hour’s chart."
          action={
            <Link to="/feed">
              <Button variant="brand">Find music</Button>
            </Link>
          }
        />
      )}
      {sharing && <ShareCardDialog song={sharing.song} badge={sharing.badge} open onClose={() => setSharing(null)} />}
    </>
  );
}

function Tastemakers() {
  const board = useTastemakers();
  return (
    <>
      <div className="card mb-6 flex gap-4 p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal/10 text-xl text-teal">
          <LuEar />
        </div>
        <div className="text-sm leading-6 text-muted">
          <p className="font-medium text-ink">How to become a tastemaker</p>
          Listen to new songs and like the ones you really love. A like counts as an early find when you’ve listened properly
          and the song has fewer than 50 plays. When one of your finds passes 250 plays, it’s a hit, and you climb this board.
        </div>
      </div>
      {board.isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : board.data?.length ? (
        <ol className="space-y-1">
          {board.data.map((t) => (
            <li key={t.user.id}>
              <Link to={`/u/${t.user.username}`} className="flex items-center gap-4 rounded-xl px-3 py-2.5 transition hover:bg-line/[0.05]">
                <span className={clsx('w-8 text-center font-semibold tabular-nums', t.rank <= 3 ? 'text-brand text-2xl' : 'text-lg text-ink/80')}>
                  {t.rank}
                </span>
                <Avatar src={t.user.avatar_url} name={t.user.display_name || t.user.username} className="h-11 w-11 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.user.display_name || t.user.username}</span>
                  <span className="block truncate text-[13px] text-muted">@{t.user.username}</span>
                </span>
                <span className="text-right text-[13px]">
                  <span className="block font-semibold text-teal">
                    {count(t.hits)} {t.hits === 1 ? 'hit' : 'hits'}
                  </span>
                  <span className="block text-faint">{count(t.early_likes)} early finds</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState icon={<LuEar />} title="No tastemakers yet" text="Be the first: find a song in the feed before anyone else does." />
      )}
    </>
  );
}
