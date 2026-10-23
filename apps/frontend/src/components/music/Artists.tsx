import clsx from 'clsx';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Song } from '../../lib/api';
import { artistName } from '../../lib/format';
import { Verified } from './Verified';

/** Everyone credited on a song, the uploader first, each a link to their page:
 * "Wavee, Jake, Drake". */
export function Artists({
  song,
  className,
  linkClassName = 'hover:text-ink hover:underline',
  badgeClassName = 'h-3.5 w-3.5',
}: {
  song: Song;
  className?: string;
  linkClassName?: string;
  badgeClassName?: string;
}) {
  const people = [
    { username: song.artist_username, name: artistName(song), verified: !!song.artist_verified },
    ...(song.features ?? []).map((f) => ({ username: f.username, name: f.display_name || f.username, verified: f.verified })),
  ];
  return (
    <span className={clsx('min-w-0 truncate', className)}>
      {people.map((p, i) => (
        <Fragment key={p.username}>
          {i > 0 && ', '}
          <Link to={`/u/${p.username}`} onClick={(e) => e.stopPropagation()} className={clsx('transition', linkClassName)}>
            {p.name}
          </Link>
          {p.verified && <Verified className={clsx('ml-0.5 inline align-[-0.15em]', badgeClassName)} />}
        </Fragment>
      ))}
    </span>
  );
}

/** "AI" next to a song's title when its uploader says AI tools made it. */
export function AiTag({ className }: { className?: string }) {
  return (
    <span
      title="Made with AI"
      className={clsx(
        'rounded border border-violet/40 bg-violet/10 px-1 align-middle text-[10px] font-semibold tracking-wide text-violet',
        className,
      )}
    >
      AI
    </span>
  );
}

/** The badge on Wavee's own account. */
export function OfficialTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal',
        className,
      )}
    >
      Official
    </span>
  );
}
