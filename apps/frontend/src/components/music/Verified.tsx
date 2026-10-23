import clsx from 'clsx';
import { LuBadgeCheck } from 'react-icons/lu';

/** The badge moderators give real artists, so fans can tell them from impostors. */
export function Verified({ className }: { className?: string }) {
  return (
    <LuBadgeCheck
      role="img"
      aria-label="Verified artist"
      className={clsx('inline-block shrink-0 fill-teal/20 text-teal', className ?? 'h-[1em] w-[1em]')}
    >
      <title>Verified artist</title>
    </LuBadgeCheck>
  );
}
