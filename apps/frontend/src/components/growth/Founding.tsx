import clsx from 'clsx';
import { LuCopy, LuGem, LuShare2, LuUserPlus } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { useInvites } from '../../hooks/data';
import type { Founding } from '../../lib/api';
import { inviteLink } from '../../lib/growth';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { PictureDialog } from '../music/ShareCard';
import { Avatar, Button, Modal } from '../ui';
import { renderFoundingCard } from './cards';

export const GOLD = 'bg-[linear-gradient(115deg,#f7d98b,#e7a33e)]';

/** "Founding artist #7": the badge the first hundred keep for good. */
export function FoundingBadge({ founding, className }: { founding: Founding; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-[#1a1206] shadow-[0_8px_24px_-10px_rgba(231,163,62,0.8)]',
        GOLD,
        className,
      )}
      title="One of the first 100 people on Wavee"
    >
      <LuGem className="text-[13px]" />
      Founding {founding.role} #{founding.number}
    </span>
  );
}

/** The founding badge as a story picture, for WhatsApp Status and Instagram. */
export function FoundingCardDialog({ founding, open, onClose }: { founding: Founding; open: boolean; onClose: () => void }) {
  const account = useAuth((s) => s.account);
  if (!account) return null;
  const name = account.display_name || account.username;
  return (
    <PictureDialog
      open={open}
      onClose={onClose}
      title="Share your founding badge"
      hint="Post it and add your link: everyone who joins from it counts as someone you brought."
      make={() => renderFoundingCard({ founding, name, username: account.username, avatar_url: account.avatar_url })}
      name={`wavee-founding-${founding.number}`}
      text={`I’m Founding ${founding.role === 'artist' ? 'Artist' : 'Listener'} #${founding.number} on Wavee. Join us:`}
      link={inviteLink(account.username)}
      alt={`Founding ${founding.role} #${founding.number} on Wavee`}
    />
  );
}

/** Your link, and who it's brought so far. */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAuth((s) => s.account);
  const invites = useInvites(open);
  if (!account) return null;
  const link = inviteLink(account.username);
  const n = invites.data?.count ?? 0;

  const share = async () => {
    const text = 'Come hear new music first on Wavee (and if you make music, put yours on it):';
    try {
      if (navigator.share) await navigator.share({ title: 'Wavee', text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        toast('Copied: paste it anywhere');
      }
    } catch {
      // Share sheet closed.
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    } catch {
      toast(link);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bring someone to Wavee">
      <p className="text-[14px] leading-6 text-muted">
        Know an artist who deserves new ears, or a friend who always finds songs first? Send them your link. When they
        join, they show up here.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line/10 bg-line/[0.04] p-2 pl-4">
        <span className="min-w-0 flex-1 truncate text-[13.5px]">{link}</span>
        <Button size="sm" variant="secondary" icon={<LuCopy />} onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <Button variant="brand" className="mt-3 w-full" icon={<LuShare2 />} onClick={() => void share()}>
        Share your link
      </Button>
      <div className="mt-6">
        <p className="label mb-3 flex items-center gap-1.5">
          <LuUserPlus className="text-[14px]" />
          {n ? `You’ve brought ${n} ${n === 1 ? 'person' : 'people'}${invites.data?.artists ? `, ${invites.data.artists} making music` : ''}` : 'Nobody yet'}
        </p>
        {n > 0 && (
          <div className="flex flex-wrap gap-3">
            {invites.data!.people.slice(0, 12).map((p) => (
              <Link key={p.username} to={`/u/${p.username}`} onClick={onClose} className="w-16 text-center">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} className="mx-auto h-12 w-12" />
                <span className="mt-1 block truncate text-[11px] text-muted">@{p.username}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
