import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  LuChartColumn,
  LuChevronRight,
  LuCrown,
  LuDownload,
  LuGem,
  LuLifeBuoy,
  LuLogOut,
  LuSettings,
  LuShield,
  LuUpload,
  LuUser,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';
import { Link, useLocation } from 'react-router-dom';
import { useFeatureInvites, useFounding, useMyPlan, useProfile } from '../../hooks/data';
import { useAuth } from '../../store/auth';
import { installWay, useInstall } from '../../store/install';
import { useMoney } from '../../store/money';
import { SignOutConfirm } from '../auth/SignOutConfirm';
import { FoundingBadge, InviteDialog } from '../growth/Founding';
import { Verified } from '../music/Verified';
import { Avatar } from '../ui';

interface Row {
  key: string;
  label: string;
  icon: ReactNode;
  /** A short note on the right: "#12", "3 spots left", a count… */
  note?: ReactNode;
  to?: string;
  onSelect?: () => void;
  tone?: 'brand' | 'danger';
}

/** The signed-in person's avatar in the top bar, and everything about their account behind it:
 * profile, stats, upload, Artist Pro, the Founding 100, invites, settings and signing out. */
export function AccountMenu() {
  const account = useAuth((s) => s.account);
  const location = useLocation();
  // Open for one page only: moving to another page (a link in the menu, Back) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === location.key;
  const [signingOut, setSigningOut] = useState(false);
  const [inviting, setInviting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const viaKeyboard = useRef(false);

  const invites = useFeatureInvites().data?.length ?? 0;
  const plan = useMyPlan().data;
  const founding = useFounding().data;
  const profile = useProfile(open && account ? account.username : '').data;
  const installed = useInstall((s) => s.installed);
  const offer = useInstall((s) => s.offer);
  const showInstall = useInstall((s) => s.show);
  const showPro = useMoney((s) => s.showPro);

  const close = (focusTrigger = false) => {
    setOpenOn(null);
    if (focusTrigger) trigger.current?.focus();
  };

  // A tap or click anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Opened from the keyboard: the first item takes focus, as in any menu.
  useEffect(() => {
    if (!open || !viaKeyboard.current) return;
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!account) return null;
  const name = account.display_name || account.username;
  const way = installWay();
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const canInstall = !installed && (offer !== null || way === 'mac-safari' || (touch && way !== 'none'));
  const spotsLeft = founding?.open
    ? Math.max(0, founding.artists.cap - founding.artists.taken) + Math.max(0, founding.listeners.cap - founding.listeners.taken)
    : 0;
  const pro = !!plan?.pro_until;

  const groups: Row[][] = [
    [
      { key: 'profile', label: 'Your profile', icon: <LuUser />, to: `/u/${account.username}` },
      { key: 'stats', label: 'Your stats', icon: <LuChartColumn />, to: '/stats' },
      { key: 'upload', label: 'Upload music', icon: <LuUpload />, to: '/upload' },
      ...(invites > 0
        ? [{ key: 'invites', label: 'Feature invites', icon: <LuUsers />, to: '/library?tab=credits', note: <Count n={invites} /> }]
        : []),
    ],
    [
      {
        key: 'pro',
        label: 'Wavee Artist Pro',
        icon: <LuCrown />,
        tone: 'brand',
        note: <span className="text-[12px] text-muted">{pro ? 'Active' : 'See plans'}</span>,
        onSelect: () => showPro(true),
      },
      ...(founding?.me
        ? [{ key: 'founding', label: 'Founding 100', icon: <LuGem />, to: '/founding', note: <span className="text-[12px] text-muted">#{founding.me.number}</span> }]
        : spotsLeft > 0
          ? [{ key: 'founding', label: 'Founding 100', icon: <LuGem />, to: '/founding', note: <span className="text-[12px] text-[#f0c060]">{spotsLeft} spots left</span> }]
          : []),
      { key: 'invite', label: 'Invite friends', icon: <LuUserPlus />, onSelect: () => setInviting(true) },
    ],
    [
      { key: 'settings', label: 'Settings', icon: <LuSettings />, to: '/settings' },
      ...(canInstall ? [{ key: 'install', label: 'Get the app', icon: <LuDownload />, onSelect: () => showInstall() }] : []),
      ...(account.is_admin ? [{ key: 'admin', label: 'Team tools', icon: <LuShield />, to: '/admin' }] : []),
      { key: 'help', label: 'Help and feedback', icon: <LuLifeBuoy />, to: `/report-a-bug?from=${encodeURIComponent(location.pathname)}` },
    ],
    [{ key: 'signout', label: 'Sign out', icon: <LuLogOut />, tone: 'danger', onSelect: () => setSigningOut(true) }],
  ];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at < 0 ? items.length - 1 : at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') close();
    else return;
    e.preventDefault();
  };

  const item = (row: Row) => {
    const body = (
      <>
        <span
          className={clsx(
            'grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[16px]',
            row.tone === 'brand' ? 'bg-brand text-bg' : row.tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-line/[0.06] text-ink/85',
          )}
        >
          {row.icon}
        </span>
        <span className={clsx('flex-1 truncate', row.tone === 'danger' && 'text-danger')}>{row.label}</span>
        {row.note}
        {row.to && !row.note && <LuChevronRight className="text-[15px] text-faint" />}
      </>
    );
    const style =
      'flex h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-[14px] font-medium outline-none transition hover:bg-line/[0.06] focus-visible:bg-line/[0.08]';
    return row.to ? (
      <Link key={row.key} to={row.to} role="menuitem" tabIndex={-1} className={style} onClick={() => close()}>
        {body}
      </Link>
    ) : (
      <button
        key={row.key}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={style}
        onClick={() => {
          close();
          row.onSelect?.();
        }}
      >
        {body}
      </button>
    );
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your account${invites ? `, ${invites} feature invites` : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') viaKeyboard.current = true;
        }}
        onPointerDown={() => (viaKeyboard.current = false)}
        onClick={() => setOpenOn(open ? null : location.key)}
        className={clsx(
          'relative block rounded-full p-[2px] outline-none transition focus-visible:ring-2 focus-visible:ring-violet/70',
          open ? 'bg-brand' : 'bg-line/[0.08] hover:bg-line/[0.16]',
        )}
      >
        <Avatar src={account.avatar_url} name={name} className="h-9 w-9 text-sm ring-2 ring-bg" />
        {invites > 0 && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-bg" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panel}
            role="menu"
            aria-label="Your account"
            onKeyDown={onKey}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.7, 0.1, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-line/10 bg-raised/95 shadow-lift backdrop-blur-xl"
          >
            <Link
              to={`/u/${account.username}`}
              role="menuitem"
              tabIndex={-1}
              onClick={() => close()}
              className="relative flex items-center gap-3.5 overflow-hidden p-4 outline-none transition hover:bg-line/[0.04] focus-visible:bg-line/[0.06]"
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgb(var(--teal)/0.14),transparent_60%),radial-gradient(70%_120%_at_100%_0%,rgb(var(--violet)/0.16),transparent_60%)]" />
              <Avatar src={account.avatar_url} name={name} className="relative h-12 w-12 text-lg ring-2 ring-line/10" />
              <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                  <span className="truncate">{name}</span>
                  {profile?.verified && <Verified className="h-4 w-4" />}
                </span>
                <span className="block truncate text-[12.5px] text-muted">@{account.username}</span>
                {(profile?.founding || pro) && (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile?.founding && <FoundingBadge founding={profile.founding} className="!px-2 !py-0.5 !text-[10.5px]" />}
                    {pro && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold text-bg">
                        <LuCrown /> Artist Pro
                      </span>
                    )}
                  </span>
                )}
              </span>
            </Link>
            <div className="max-h-[calc(100svh-var(--top-h)-180px)] overflow-y-auto overscroll-contain px-2 pb-2">
              {groups.map((rows, i) => (
                <div key={i} className={clsx('py-1.5', i > 0 && 'border-t border-line/[0.06]')}>
                  {rows.map(item)}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SignOutConfirm open={signingOut} onClose={() => setSigningOut(false)} />
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="grid h-5 min-w-5 place-items-center rounded-full bg-teal px-1.5 text-[11px] font-bold text-bg">{n}</span>;
}
