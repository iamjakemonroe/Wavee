import clsx from 'clsx';
import { LuCrown, LuRocket } from 'react-icons/lu';
import { useMyBoosts, useMyPlan } from '../../hooks/data';
import { useMoney } from '../../store/money';
import { Button, Cover, EmptyState, Skeleton } from '../ui';

const STATUS: Record<string, string> = { active: 'Live', done: 'Done', stopped: 'Stopped' };

/** The artist's Boosts and how far each has got, with Artist Pro above them. */
export function Boosts() {
  const boosts = useMyBoosts();
  const plan = useMyPlan().data;
  const showPro = useMoney((s) => s.showPro);
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => showPro(true)}
        className="card flex w-full items-center gap-4 p-4 text-left transition hover:bg-raised"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-[22px] text-bg">
          <LuCrown />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{plan?.pro_until ? 'You’re Artist Pro' : 'Wavee Artist Pro'}</span>
          <span className="block text-[13px] text-muted">
            {plan?.pro_until
              ? plan.free_boost
                ? 'This month’s free Boost is ready: boost a song from its menu.'
                : 'Stats, bigger uploads and a free Boost every month.'
              : 'A free Boost every month, song stats and bigger uploads.'}
          </span>
        </span>
      </button>

      {boosts.isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : boosts.data?.length ? (
        <div className="space-y-2">
          {boosts.data.map((b) => {
            const pct = Math.min(100, Math.round((b.reached / b.listeners) * 100));
            return (
              <div key={b.id} className="card flex items-center gap-3.5 p-3.5">
                <Cover src={b.cover} title={b.title} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{b.title}</p>
                    <span
                      className={clsx(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        b.status === 'active' ? 'bg-teal/15 text-teal' : 'bg-line/10 text-muted',
                      )}
                    >
                      {STATUS[b.status] ?? b.status}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/10">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {b.reached.toLocaleString()} of {b.listeners.toLocaleString()} new listeners
                    {b.source === 'pro' ? ' · free with Pro' : b.source === 'welcome' ? ' · First listens, free for new artists' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<LuRocket />}
          title="No Boosts yet"
          text="Boost a song from its menu (•••) to put it in front of new listeners in the feed."
          action={
            plan?.pro_until ? undefined : (
              <Button variant="secondary" onClick={() => showPro(true)}>
                See Artist Pro
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
