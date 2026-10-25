import clsx from 'clsx';
import { useState } from 'react';
import { LuArrowRight, LuMessageSquareHeart, LuPlay, LuQuote } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { usePicks } from '../../hooks/data';
import type { Picks, Song } from '../../lib/api';
import { weekLabel } from '../../lib/growth';
import { usePlayer } from '../../store/player';
import { withAccount } from '../../store/auth';
import { Artists } from '../music/Artists';
import { LikeButton, PlayToggle, useIsCurrent } from '../music/Song';
import { Bars, Button, Cover } from '../ui';
import { FeedbackDialog } from './Feedback';

/** One pick: the song, and the team's line on why. */
export function PickCard({ pick, list, index, source }: { pick: Picks['picks'][number]; list: Song[]; index: number; source: string }) {
  const song = pick.song;
  const { isCurrent, playing } = useIsCurrent(song);
  const [feedback, setFeedback] = useState(false);
  return (
    <article className={clsx('card flex gap-4 p-4 transition sm:p-5', isCurrent && 'ring-1 ring-teal/40')}>
      <div className="relative shrink-0 self-start">
        <Link to={`/songs/${song.id}`} aria-label={song.title} className="block">
          <Cover src={song.cover_image_url} title={song.title} className="h-24 w-24 sm:h-28 sm:w-28" rounded="rounded-2xl" />
        </Link>
        <PlayToggle song={song} list={list} index={index} source={source} className="absolute -bottom-2 -right-2 h-10 w-10 text-base" />
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/songs/${song.id}`} className="flex items-center gap-2 truncate text-[17px] font-semibold hover:underline">
          {playing && <Bars playing className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{song.title}</span>
        </Link>
        <span className="mt-0.5 block truncate text-[13.5px] text-muted">
          <Artists song={song} />
        </span>
        {pick.note && (
          <p className="mt-2.5 flex gap-2 text-[14px] leading-6 text-ink/85">
            <LuQuote className="mt-1 shrink-0 text-[13px] text-teal" />
            {pick.note}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1">
          <LikeButton song={song} />
          <Button
            size="sm"
            variant="ghost"
            icon={<LuMessageSquareHeart />}
            onClick={() => withAccount('Sign in to send the artist feedback.', () => setFeedback(true))}
          >
            Feedback
          </Button>
        </div>
      </div>
      {feedback && <FeedbackDialog song={song} open={feedback} onClose={() => setFeedback(false)} />}
    </article>
  );
}

/** Home's Fresh Finds: this week's picks, a tap from playing. */
export function FreshFinds() {
  const picks = usePicks().data;
  const playList = usePlayer((s) => s.playList);
  if (!picks?.picks?.length) return null;
  const list = picks.picks.map((p) => p.song);
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="label">{picks.this_week ? 'This week' : weekLabel(picks.week)}</p>
          <h2 className="mt-1 text-xl sm:text-[22px]">Fresh Finds</h2>
          <p className="mt-1 text-sm text-muted">New songs the Wavee team can’t stop playing, and why.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button size="sm" icon={<LuPlay className="fill-current" />} onClick={() => playList(list, 0, 'Fresh Finds')}>
            Play
          </Button>
          <Link to="/picks" className="hidden items-center gap-1.5 text-sm text-muted hover:text-ink sm:inline-flex">
            All picks <LuArrowRight />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {picks.picks.slice(0, 4).map((p, i) => (
          <PickCard key={p.song.id} pick={p} list={list} index={i} source="Fresh Finds" />
        ))}
      </div>
      {picks.picks.length > 4 && (
        <Link to="/picks" className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          {picks.picks.length - 4} more this week <LuArrowRight />
        </Link>
      )}
    </section>
  );
}
