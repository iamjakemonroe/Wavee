import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { LuArrowRight, LuChartColumn, LuCompass, LuFlame, LuGem, LuImage, LuRadar, LuSparkles, LuUserPlus } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { useChallenge, useCollections, useFounding, useMyWeek } from '../../hooks/data';
import { count, plural } from '../../lib/format';
import { decisionSeen } from '../../lib/growth';
import { useMoney } from '../../store/money';
import { ShareCardDialog } from '../music/ShareCard';
import { Avatar, Button, Cover } from '../ui';
import { GOLD, InviteDialog } from './Founding';

/** A number with how it moved since the week before. */
function Stat({ label, value, before }: { label: string; value: number; before?: number }) {
  const change = before == null ? 0 : value - before;
  return (
    <div className="rounded-2xl bg-line/[0.04] p-3.5">
      <p className="text-[22px] font-bold leading-none tabular-nums">{count(value)}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
        {label}
        {before != null && change !== 0 && (
          <span className={clsx('font-semibold', change > 0 ? 'text-teal' : 'text-faint')}>
            {change > 0 ? '+' : '−'}
            {count(Math.abs(change))}
          </span>
        )}
      </p>
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('relative overflow-hidden rounded-4xl border border-line/10 bg-raised/60 p-5 sm:p-6', className)}>{children}</section>;
}

/** An artist's last seven days: real listens, what came of them, and what to do next. */
export function YourWeek() {
  const week = useMyWeek(true).data;
  const showStats = useMoney((s) => s.showStats);
  const [card, setCard] = useState(false);
  const [inviting, setInviting] = useState(false);
  if (!week || !week.songs) return null;
  const top = week.top_song;
  const fl = week.first_listens;
  return (
    <Card className="mt-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgb(var(--violet)/0.16),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">The last 7 days</p>
            <h2 className="mt-1 text-xl">Your week on Wavee</h2>
          </div>
          <Link to="/stats" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted hover:text-ink">
            All stats <LuArrowRight />
          </Link>
        </div>

        {week.picked && (
          <p className="mt-4 flex items-center gap-2.5 rounded-2xl border border-teal/30 bg-teal/[0.08] px-3.5 py-2.5 text-[13.5px] leading-5">
            <LuRadar className="shrink-0 text-[16px] text-teal" />
            <span>
              Your song is in this week’s{' '}
              <Link to="/picks" className="font-semibold underline">
                Fresh Finds
              </Link>
              . Share it!
            </span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Plays" value={week.plays} before={week.plays_before} />
          <Stat label="Listeners" value={week.listeners} before={week.listeners_before} />
          <Stat label="New followers" value={week.followers} />
          <Stat label="Likes" value={week.likes} />
          <Stat label="Feedback" value={week.feedback} />
        </div>

        {fl && fl.reached < fl.listeners && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <LuSparkles className="text-teal" /> First listens: Wavee is playing your music to new listeners in the feed
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/10">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((fl.reached / fl.listeners) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-faint">
              {fl.reached} of {fl.listeners} heard so far
            </p>
          </div>
        )}

        {top ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
            <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
              <Cover src={top.cover_image_url} title={top.title} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="text-[12px] text-faint">Played most</p>
                <p className="truncate font-semibold">{top.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={<LuChartColumn />} onClick={() => showStats(top)}>
                Stats
              </Button>
              <Button size="sm" variant="secondary" icon={<LuImage />} onClick={() => setCard(true)}>
                Share
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[14px] leading-6 text-muted">
            No listens yet this week. Post your song’s story card and put your Wavee link in your bio: every share brings
            new ears.
          </p>
        )}
        <button type="button" onClick={() => setInviting(true)} className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <LuUserPlus /> Bring another artist to Wavee
        </button>
      </div>
      {top && card && <ShareCardDialog song={top} open={card} onClose={() => setCard(false)} />}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </Card>
  );
}

/** The weekly discovery challenge: hear three artists you'd never heard before. */
export function Challenge() {
  const ch = useChallenge().data;
  const [now] = useState(Date.now);
  if (!ch) return null;
  const done = ch.found >= ch.goal;
  const days = Math.max(1, Math.ceil((new Date(ch.ends_at).getTime() - now) / 86_400_000));
  return (
    <Card className="mt-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_0%_0%,rgb(var(--teal)/0.14),transparent_60%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="label flex items-center gap-1.5">
            <LuCompass className="text-[13px]" /> This week’s challenge
            {ch.streak > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-warn">
                <LuFlame /> {ch.streak}-week streak
              </span>
            )}
          </p>
          <h2 className="mt-1 text-xl">
            {done ? 'Done: you found new artists this week' : `Find ${ch.goal} artists you’ve never heard`}
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            {done
              ? 'Keep going, or come back Monday for the next one.'
              : `Listen for 30 seconds and they count. ${days} ${days === 1 ? 'day' : 'days'} left.`}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: ch.goal }).map((_, i) => {
              const a = ch.artists[i];
              return a ? (
                <Link key={a.id} to={`/u/${a.username}`} title={a.display_name || a.username}>
                  <Avatar src={a.avatar_url} name={a.display_name || a.username} className="h-11 w-11 ring-2 ring-teal" />
                </Link>
              ) : (
                <span key={i} className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-line/20 text-[13px] text-faint">
                  {i + 1}
                </span>
              );
            })}
            {ch.artists.length > ch.goal && <span className="text-[12px] text-muted">+{ch.artists.length - ch.goal}</span>}
          </div>
        </div>
        {!done && (
          <Link to="/feed" className="shrink-0">
            <Button variant="brand" icon={<LuCompass />}>
              Find one in the feed
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

/** The team's answer to a founding application until it's been seen; otherwise, while founding
 * spots are left, the way in. */
export function FoundingBanner() {
  const s = useFounding().data;
  const app = s?.application;
  if (s && app && app.status !== 'pending' && !decisionSeen(app.decided_at)) {
    const yes = app.status === 'approved' && s.me?.role === 'artist';
    return (
      <Link to={yes ? '/founding' : '/founding/apply'} className="group mt-8 block">
        <Card className="border-[#e7a33e]/30 transition group-hover:border-[#e7a33e]/50">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_0%_0%,rgba(231,163,62,0.24),transparent_60%)]" />
          <div className="relative flex items-center gap-4">
            <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px] text-[#1a1206]', GOLD)}>
              <LuGem />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{yes ? `You’re Founding Artist #${s.me!.number}` : 'The team replied to your application'}</p>
              <p className="mt-0.5 text-[13.5px] leading-5 text-muted">
                {yes ? 'The Wavee team chose you. Your number is yours for good: share your badge.' : 'Read what they said, and what would make it a yes.'}
              </p>
            </div>
            <LuArrowRight className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </div>
        </Card>
      </Link>
    );
  }
  if (!s || !s.open || s.me || app?.status === 'pending') return null;
  const left = Math.max(0, s.artists.cap - s.artists.taken) + Math.max(0, s.listeners.cap - s.listeners.taken);
  if (!left) return null;
  return (
    <Link to="/founding" className="group mt-8 block">
      <Card className="transition group-hover:border-[#e7a33e]/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_0%_0%,rgba(231,163,62,0.18),transparent_60%)]" />
        <div className="relative flex items-center gap-4">
          <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[22px] text-[#1a1206]', GOLD)}>
            <LuGem />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {s.artists.taken + s.listeners.taken < 10
                ? `Be #${s.artists.taken + s.listeners.taken + 1} of Wavee’s first ${s.artists.cap + s.listeners.cap}`
                : `The Founding ${s.artists.cap + s.listeners.cap}: ${left} ${left === 1 ? 'spot' : 'spots'} left`}
            </p>
            <p className="mt-0.5 text-[13.5px] leading-5 text-muted">
              {s.review
                ? `Listeners take a spot; artists apply, and ${s.artists.cap} are chosen. Your number is yours for good.`
                : 'Be one of the first artists and listeners building Wavee. Your number is yours for good.'}
            </p>
          </div>
          <LuArrowRight className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Card>
    </Link>
  );
}

/** Playlists the team puts together: Hidden Gems, New Artists to Watch… */
export function Collections() {
  const lists = useCollections().data;
  if (!lists?.length) return null;
  return (
    <section className="mt-12">
      <div className="mb-5">
        <h2 className="text-xl sm:text-[22px]">Collections</h2>
        <p className="mt-1 text-sm text-muted">Put together by the Wavee team.</p>
      </div>
      <div className="scroll-row">
        {lists.map((c) => (
          <Link key={c.id} to={`/playlists/${c.id}`} className="group w-[156px] shrink-0 snap-start sm:w-[176px]">
            {c.cover_image_url || c.covers.length < 4 ? (
              <Cover
                src={c.cover_image_url ?? c.covers[0] ?? null}
                title={c.name}
                className="aspect-square w-full shadow-lift transition duration-500 group-hover:-translate-y-1"
                rounded="rounded-2xl"
              />
            ) : (
              <div className="grid aspect-square w-full grid-cols-2 overflow-hidden rounded-2xl shadow-lift transition duration-500 group-hover:-translate-y-1">
                {c.covers.slice(0, 4).map((src, i) => (
                  <img key={i} src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                ))}
              </div>
            )}
            <p className="mt-3 truncate text-sm font-medium">{c.name}</p>
            <p className="truncate text-[12px] text-faint">{c.songs_count} {plural(c.songs_count, 'song')}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
