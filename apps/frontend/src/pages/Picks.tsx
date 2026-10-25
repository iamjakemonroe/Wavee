import clsx from 'clsx';
import { useState } from 'react';
import { LuImage, LuPlay, LuRadar } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { renderPicksCard } from '../components/growth/cards';
import { PickCard } from '../components/growth/Picks';
import { PictureDialog } from '../components/music/ShareCard';
import { Button, EmptyState, Skeleton } from '../components/ui';
import { usePicks } from '../hooks/data';
import { weekLabel } from '../lib/growth';
import { usePlayer } from '../store/player';
import { useTitle } from '../hooks/useTitle';

/** Fresh Finds: the songs the team picked each week, with why. Come back every week. */
export function Picks() {
  useTitle('Fresh Finds');
  const [week, setWeek] = useState<string | null>(null);
  const picks = usePicks(week);
  const latest = usePicks(null).data;
  const playList = usePlayer((s) => s.playList);
  const [card, setCard] = useState(false);
  const p = picks.data;
  const list = p?.picks.map((x) => x.song) ?? [];
  const weeks = latest?.weeks ?? [];

  return (
    <div className="animate-rise">
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-8 pt-12 sm:-mx-6 sm:px-6 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_10%_0%,rgb(var(--teal)/0.2),transparent_60%),radial-gradient(55%_75%_at_95%_20%,rgb(var(--violet)/0.26),transparent_62%)]" />
        <div className="relative">
          <p className="label">{p ? (p.this_week ? `This week · ${weekLabel(p.week)}` : weekLabel(p.week)) : ' '}</p>
          <h1 className="mt-2 text-[40px] leading-[1.05] sm:text-[56px]">
            Fresh <span className="text-brand">Finds</span>
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-muted">
            Every week the Wavee team picks new songs we can’t stop playing, and says why. Hear them first, then tell the
            artists what you think.
          </p>
          {list.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" icon={<LuPlay className="fill-current" />} onClick={() => playList(list, 0, 'Fresh Finds')}>
                Play all
              </Button>
              <Button variant="secondary" icon={<LuImage />} onClick={() => setCard(true)}>
                Story card
              </Button>
            </div>
          )}
        </div>
      </section>

      {weeks.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeek(w === weeks[0] ? null : w)}
              className={clsx(
                'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition',
                (p?.week ?? weeks[0]) === w ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted hover:text-ink',
              )}
            >
              {new Date(`${w}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
            </button>
          ))}
        </div>
      )}

      {picks.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : p?.picks.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {p.picks.map((x, i) => (
            <PickCard key={x.song.id} pick={x} list={list} index={i} source="Fresh Finds" />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<LuRadar />}
          title="This week’s picks are on their way"
          text="The team is listening to everything new, and the picks land on Wednesday. Until then, find your own."
          action={
            <Link to="/feed">
              <Button variant="brand" icon={<LuPlay className="fill-current" />}>
                Start the feed
              </Button>
            </Link>
          }
        />
      )}

      {p && card && (
        <PictureDialog
          open={card}
          onClose={() => setCard(false)}
          make={() => renderPicksCard(p)}
          name={`wavee-fresh-finds-${p.week}`}
          text="This week’s Fresh Finds on Wavee:"
          link={`${window.location.origin}/picks`}
          alt={`Fresh Finds, ${weekLabel(p.week)}`}
        />
      )}
    </div>
  );
}
