import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LuCompass,
  LuHouse,
  LuLibrary,
  LuLogIn,
  LuLogOut,
  LuPlus,
  LuSearch,
  LuSettings,
  LuShield,
  LuTrophy,
  LuUpload,
} from 'react-icons/lu';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useFeatureInvites, useMyPlaylists } from '../../hooks/data';
import { useAuth } from '../../store/auth';
import { usePlayer } from '../../store/player';
import { useToasts } from '../../store/toast';
import { SignOutConfirm } from '../auth/SignOutConfirm';
import { NowPlaying, PlayerBar, QueuePanel } from '../music/Player';
import { Avatar, Button, Cover, Logo, Modal } from '../ui';

const nav = [
  { to: '/', label: 'Home', icon: <LuHouse />, end: true },
  { to: '/feed', label: 'Feed', icon: <LuCompass /> },
  { to: '/charts', label: 'Charts', icon: <LuTrophy /> },
  { to: '/search', label: 'Search', icon: <LuSearch /> },
  { to: '/library', label: 'Library', icon: <LuLibrary /> },
];

function Sidebar() {
  const account = useAuth((s) => s.account);
  const playlists = useMyPlaylists();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line/[0.06] bg-bg px-4 pb-[calc(var(--player-h)+16px)] pt-6 lg:flex">
      <Link to="/" className="mb-8 px-2">
        <Logo />
      </Link>
      <nav className="space-y-1" aria-label="Main">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              clsx(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition',
                isActive ? 'bg-line/[0.07] text-ink' : 'text-muted hover:bg-line/[0.04] hover:text-ink',
              )
            }
          >
            <span className="text-[19px]">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <Link to="/upload" className="mt-6">
        <Button variant="brand" className="w-full" icon={<LuUpload />}>
          Upload music
        </Button>
      </Link>
      {account && (
        <div className="mt-8 min-h-0 flex-1">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="label">Your playlists</span>
            <Link to="/library?tab=playlists" aria-label="New playlist" className="rounded-lg p-1 text-muted transition hover:bg-line/[0.06] hover:text-ink">
              <LuPlus />
            </Link>
          </div>
          <div className="max-h-full space-y-0.5 overflow-y-auto">
            {playlists.data?.map((p) => (
              <NavLink
                key={p.id}
                to={`/playlists/${p.id}`}
                className={({ isActive }) =>
                  clsx('flex items-center gap-3 rounded-lg p-1.5 transition', isActive ? 'bg-line/[0.07]' : 'hover:bg-line/[0.04]')
                }
              >
                <Cover src={p.cover_image_url} title={p.name} className="h-9 w-9" rounded="rounded-md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block text-[11px] text-faint">{p.songs_count ?? 0} songs</span>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <FooterLinks className="mt-auto px-2 pt-6" />
    </aside>
  );
}

/** Policies, bug reports and who makes Wavee: in the sidebar on wide
 * screens, under every page on phones. */
function FooterLinks({ className }: { className?: string }) {
  const { pathname } = useLocation();
  return (
    <div className={clsx('flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-faint', className)}>
      <Link to="/terms" className="hover:text-muted">Terms</Link>
      <Link to="/privacy" className="hover:text-muted">Privacy</Link>
      <Link to="/copyright" className="hover:text-muted">Copyright</Link>
      <Link to="/guidelines" className="hover:text-muted">Guidelines</Link>
      <Link to={`/report-a-bug?from=${encodeURIComponent(pathname)}`} className="hover:text-muted">Report a bug</Link>
      <a href="https://kaivon.app" className="hover:text-muted">A Kaivon product</a>
    </div>
  );
}

function TopBar() {
  const account = useAuth((s) => s.account);
  const session = useAuth((s) => s.session);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <header className="sticky top-0 z-20 box-content flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line/[0.06] bg-bg px-4 pt-[var(--sat)] sm:px-6">
      <Link to="/" className="lg:hidden">
        <Logo />
      </Link>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2">
        {session ? (
          <>
            <Link
              to="/upload"
              aria-label="Upload music"
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink lg:hidden"
            >
              <LuUpload />
            </Link>
            {account?.is_admin && (
              <Link to="/admin" aria-label="Moderation" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink">
                <LuShield />
              </Link>
            )}
            <Link to="/settings" aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink">
              <LuSettings />
            </Link>
            <button
              onClick={() => setSigningOut(true)}
              aria-label="Sign out"
              title="Sign out"
              className="hidden h-9 w-9 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink sm:grid"
            >
              <LuLogOut />
            </button>
            {account && (
              <Link to={`/u/${account.username}`} aria-label="Your profile">
                <Avatar src={account.avatar_url} name={account.display_name || account.username} className="h-9 w-9 text-sm" />
              </Link>
            )}
          </>
        ) : (
          <>
            <Link to="/signin">
              <Button size="sm" variant="ghost" icon={<LuLogIn />}>
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" variant="primary" className="!shadow-none">
                Join free
              </Button>
            </Link>
          </>
        )}
      </div>
      <SignOutConfirm open={signingOut} onClose={() => setSigningOut(false)} />
    </header>
  );
}

function MobileNav() {
  const invites = useFeatureInvites().data?.length ?? 0;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--nav-h)] grid-cols-5 border-t border-line/[0.06] bg-bg pb-[var(--nav-pad)] pl-[var(--sal)] pr-[var(--sar)] lg:hidden"
    >
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            clsx('flex flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-medium transition', isActive ? 'text-ink' : 'text-faint')
          }
        >
          <span className="relative text-[22px]">
            {n.icon}
            {n.to === '/library' && invites > 0 && (
              <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-teal ring-2 ring-bg" aria-label={`${invites} requests`} />
            )}
          </span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--player-h)+var(--nav-h)+16px)] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-[calc(var(--player-h)+20px)]"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            onClick={() => dismiss(t.id)}
            className={clsx(
              'pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-left text-sm shadow-lift backdrop-blur-xl',
              t.tone === 'error' && 'border-danger/30 bg-[#2a1018]/95 text-[#ffd6de]',
              t.tone === 'success' && 'border-teal/30 bg-[#0c2620]/95 text-[#c7fff0]',
              t.tone === 'info' && 'border-line/10 bg-raised/95 text-ink',
            )}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SignInPrompt() {
  const prompt = useAuth((s) => s.prompt);
  const close = useAuth((s) => s.closePrompt);
  const location = useLocation();
  const from = location.pathname + location.search;
  return (
    <Modal open={!!prompt} onClose={close}>
      <div className="text-center">
        <Logo compact className="mb-4 justify-center" />
        <h2 className="text-xl">Join Wavee</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{prompt}</p>
        <div className="mt-6 grid gap-2">
          <Link to="/signup" state={{ from }} onClick={close}>
            <Button variant="primary" className="w-full">
              Create a free account
            </Button>
          </Link>
          <Link to="/signin" state={{ from }} onClick={close}>
            <Button variant="ghost" className="w-full">
              I have an account
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/** Space plays and pauses, arrows seek (not while typing). */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], [role="slider"], button')) return;
      const p = usePlayer.getState();
      if (!p.queue.length) return;
      if (e.code === 'Space') {
        e.preventDefault();
        p.toggle();
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        void p.next();
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        p.previous();
      } else if (e.key.toLowerCase() === 'm') {
        p.toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Every page sits in this: sidebar (wide) or tabs (phones), the player,
 * toasts and the sign-in prompt. */
export function Shell({ children }: { children?: ReactNode }) {
  useShortcuts();
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);
  const feed = pathname === '/feed';
  // On phones the app is a column the height of the screen: the top bar, the page (the only
  // thing that scrolls) and the tabs. The page itself never scrolls, so an installed iPhone
  // app can't bounce or slide the bars. Wide screens scroll the window as usual.
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-svh lg:overflow-visible">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col lg:block lg:pl-[248px]">
        <TopBar />
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain lg:overflow-visible">
          <main
            className={clsx(
              'mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 lg:pb-[calc(var(--player-h)+40px)]',
              // Room under the last thing on the page for the tabs, the home bar and the player.
              feed ? 'pb-0' : 'pb-[calc(var(--player-h)+var(--nav-h)+32px)]',
            )}
          >
            {children ?? <Outlet />}
            {!feed && <FooterLinks className="mt-16 justify-center border-t border-line/[0.05] pt-6 lg:hidden" />}
          </main>
        </div>
      </div>
      <MobileNav />
      <PlayerBar />
      <QueuePanel />
      <NowPlaying />
      <Toasts />
      <SignInPrompt />
    </div>
  );
}

/** For pages without the app around them (sign in, legal): just toasts. */
export function Bare({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toasts />
    </>
  );
}
