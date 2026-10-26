import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { LuActivity, LuBadgeCheck, LuBug, LuExternalLink, LuFlag, LuGem, LuInbox, LuListMusic, LuRadar, LuShield, LuSprout } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { OfficialTag } from '../components/music/Artists';
import { Verified } from '../components/music/Verified';
import { Avatar, Button, EmptyState, Input, Skeleton, Spinner } from '../components/ui';
import { api, type Report } from '../lib/api';
import { ago, plural } from '../lib/format';
import { Applications, CollectionsAdmin, FoundingAdmin, NewArtists, PicksAdmin, Pulse } from './AdminGrowth';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { useTitle } from '../hooks/useTitle';

const REPORT_STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'] as const;

type Tab = 'pulse' | 'applications' | 'new' | 'picks' | 'founding' | 'collections' | 'reports' | 'bugs' | 'artists';
const BUG_STATUSES = ['open', 'closed'] as const;

function Pills<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={clsx(
            'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium capitalize transition',
            value === o ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted hover:text-ink',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Admin() {
  useTitle('Team tools');
  const account = useAuth((s) => s.account);
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const [tab, setTab] = useState<Tab>('pulse');
  if (loading || (session && !account)) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
  if (!account?.is_admin) return <EmptyState icon={<LuShield />} title="Moderators only" text="This page is for the Wavee team." />;
  return (
    <div className="animate-rise">
      <h1 className="mt-2 text-3xl">The Wavee team</h1>
      <div className="mb-6 mt-6 flex gap-6 overflow-x-auto border-b border-line/[0.06] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ['pulse', 'Pulse', <LuActivity key="p" />],
            ['applications', 'Applications', <LuInbox key="a" />],
            ['new', 'New artists', <LuSprout key="n" />],
            ['picks', 'Fresh Finds', <LuRadar key="r" />],
            ['founding', 'Founding 100', <LuGem key="g" />],
            ['collections', 'Collections', <LuListMusic key="c" />],
            ['reports', 'Reports', <LuFlag key="f" />],
            ['bugs', 'Bug reports', <LuBug key="b" />],
            ['artists', 'Verify artists', <LuBadgeCheck key="v" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-medium transition',
              tab === id ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      {tab === 'pulse' && <Pulse />}
      {tab === 'applications' && <Applications />}
      {tab === 'new' && <NewArtists />}
      {tab === 'picks' && <PicksAdmin />}
      {tab === 'founding' && <FoundingAdmin />}
      {tab === 'collections' && <CollectionsAdmin />}
      {tab === 'reports' && <Reports />}
      {tab === 'bugs' && <Bugs />}
      {tab === 'artists' && <VerifyArtists />}
    </div>
  );
}

function targetLink(r: Report) {
  if (r.target_type === 'song') return `/songs/${r.target_id}`;
  if (r.target_type === 'playlist') return `/playlists/${r.target_id}`;
  return null;
}

function Reports() {
  const [status, setStatus] = useState<(typeof REPORT_STATUSES)[number]>('open');
  const reports = useQuery({ queryKey: ['admin-reports', status], queryFn: () => api.adminReports(status) });
  if (reports.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  return (
    <>
      <Pills value={status} options={REPORT_STATUSES} onChange={setStatus} />
      <div className="mt-5 space-y-3">
        {reports.data?.length ? (
          reports.data.map((r) => <ReportCard key={r.id} report={r} />)
        ) : (
          <EmptyState title={`No ${status} reports`} text="All clear." />
        )}
      </div>
    </>
  );
}

function ReportCard({ report: r }: { report: Report }) {
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const link = targetLink(r);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      void client.invalidateQueries({ queryKey: ['admin-reports'] });
      toast('Done', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const moderate = (songStatus: 'hidden' | 'removed' | 'active') =>
    act(songStatus, async () => {
      await api.moderateSong(r.target_id, songStatus, note || `Report ${r.reason}`);
      await api.resolveReport(r.id, songStatus === 'active' ? 'dismissed' : 'actioned', note);
    });

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={clsx('rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wide', r.reason === 'copyright' ? 'bg-warn/15 text-warn' : 'bg-danger/15 text-danger')}>
          {r.reason}
        </span>
        <span className="rounded-full bg-line/[0.06] px-2.5 py-0.5 capitalize text-muted">{r.target_type}</span>
        <span className="text-faint">{ago(r.created_at)}</span>
        {link && (
          <Link to={link} className="ml-auto inline-flex items-center gap-1 text-muted hover:text-ink">
            Open <LuExternalLink />
          </Link>
        )}
      </div>
      {r.details && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/85">{r.details}</p>}
      {(r.claimant_name || r.contact_email) && (
        <p className="mt-3 text-[13px] text-muted">
          {r.claimant_name && <>Claimant: {r.claimant_name} · </>}
          {r.contact_email && <a href={`mailto:${r.contact_email}`} className="link">{r.contact_email}</a>}
          {r.sworn && <> · good-faith statement given</>}
        </p>
      )}
      {r.resolution_note && <p className="mt-3 text-[13px] text-faint">Note: {r.resolution_note}</p>}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional, kept with the decision)"
        className="mt-4 h-10 w-full rounded-xl border border-line/10 bg-line/[0.03] px-3 text-sm placeholder:text-faint focus:border-violet/60 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {r.target_type === 'song' && (
          <>
            <Button size="sm" variant="danger" loading={busy === 'removed'} onClick={() => void moderate('removed')}>
              Remove song
            </Button>
            <Button size="sm" variant="secondary" loading={busy === 'hidden'} onClick={() => void moderate('hidden')}>
              Hide song
            </Button>
          </>
        )}
        {r.status === 'open' && (
          <Button size="sm" variant="ghost" loading={busy === 'reviewing'} onClick={() => void act('reviewing', () => api.resolveReport(r.id, 'reviewing', note))}>
            Mark reviewing
          </Button>
        )}
        {r.target_type !== 'song' && (
          <Button size="sm" variant="secondary" loading={busy === 'actioned'} onClick={() => void act('actioned', () => api.resolveReport(r.id, 'actioned', note))}>
            Mark actioned
          </Button>
        )}
        <Button size="sm" variant="ghost" loading={busy === 'dismissed'} onClick={() => void act('dismissed', () => api.resolveReport(r.id, 'dismissed', note))}>
          Dismiss
        </Button>
      </div>
    </article>
  );
}

function Bugs() {
  const client = useQueryClient();
  const [status, setStatus] = useState<(typeof BUG_STATUSES)[number]>('open');
  const setBug = async (id: string, next: 'open' | 'closed') => {
    try {
      await api.setBugStatus(id, next);
      void client.invalidateQueries({ queryKey: ['admin-bugs'] });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const bugs = useQuery({ queryKey: ['admin-bugs', status], queryFn: () => api.adminBugReports(status) });
  if (bugs.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  return (
    <>
      <Pills value={status} options={BUG_STATUSES} onChange={setStatus} />
      <div className="mt-5 space-y-3">
        {bugs.data?.length ? (
          bugs.data.map((b) => (
            <article key={b.id} className="card p-5">
              <div className="flex flex-wrap gap-3 text-[12px] text-faint">
                <span>{ago(b.created_at)}</span>
                {b.page && <span className="truncate">on {b.page}</span>}
                {b.contact_email && <a href={`mailto:${b.contact_email}`} className="link">{b.contact_email}</a>}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6">{b.message}</p>
              {b.screenshot_url && (
                <a href={b.screenshot_url} target="_blank" rel="noreferrer">
                  <img src={b.screenshot_url} alt="Screenshot" className="mt-3 max-h-56 rounded-xl border border-line/10" />
                </a>
              )}
              {b.user_agent && <p className="mt-3 truncate text-[11px] text-faint">{b.user_agent}</p>}
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => void setBug(b.id, b.status === 'closed' ? 'open' : 'closed')}>
                {b.status === 'closed' ? 'Reopen' : 'Close'}
              </Button>
            </article>
          ))
        ) : (
          <EmptyState title={`No ${status} bug reports`} />
        )}
      </div>
    </>
  );
}

/** Look someone up and give (or take away) the verified badge. Verify only after checking it's
 * really them: an email from their official address or management, or a post on their official
 * account mentioning their Wavee username. */
function VerifyArtists() {
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.profile(username),
    enabled: !!username,
  });
  const p = profile.data;

  const setOfficial = async (official: boolean) => {
    if (!p) return;
    setBusy(true);
    try {
      await api.setOfficial(p.id, official);
      await client.invalidateQueries({ queryKey: ['profile', username] });
      toast(official ? 'Marked as a Wavee account' : 'No longer official', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const set = async (verified: boolean) => {
    if (!p) return;
    setBusy(true);
    try {
      await api.setVerified(p.id, verified, note);
      await client.invalidateQueries({ queryKey: ['profile', username] });
      toast(verified ? `${p.display_name || p.username} is verified` : 'Badge removed', 'success');
      setNote('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="mb-5 text-sm leading-6 text-muted">
        Requests to be verified arrive in Applications, with the artist’s code to look for on their official account.
        By hand here, verify an artist only after checking it’s really them: an email from their official address or
        management, or a post on their official account that mentions their Wavee username. Write down how you checked. Mark Wavee’s own
        accounts official: their songs play in the feed but stay out of the charts and Trending.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setUsername(query.trim().replace(/^@/, '').toLowerCase());
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username"
          autoCapitalize="off"
          className="h-11 flex-1 rounded-xl border border-line/10 bg-line/[0.03] px-3.5 text-sm placeholder:text-faint focus:border-violet/60 focus:outline-none"
        />
        <Button type="submit" variant="secondary">
          Look up
        </Button>
      </form>
      {username && (
        <div className="card mt-5 p-5">
          {profile.isLoading ? (
            <Spinner className="h-6 w-6 text-muted" />
          ) : p ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} className="h-14 w-14 text-lg" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {p.display_name || p.username}
                    {p.verified && <Verified className="h-4 w-4" />}
                    {p.official && <OfficialTag className="ml-1" />}
                  </p>
                  <p className="text-[13px] text-muted">
                    @{p.username} · {p.followers_count} {plural(p.followers_count, 'follower')} · {p.songs_count} {plural(p.songs_count, 'song')}
                  </p>
                </div>
              </div>
              <Input className="mt-4" placeholder="How you checked (kept in the log)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-4 flex gap-2">
                {p.verified ? (
                  <Button variant="danger" loading={busy} onClick={() => void set(false)}>
                    Remove the badge
                  </Button>
                ) : (
                  <Button variant="brand" icon={<LuBadgeCheck />} loading={busy} disabled={!note.trim()} onClick={() => void set(true)}>
                    Verify
                  </Button>
                )}
                <Button variant="ghost" loading={busy} onClick={() => void setOfficial(!p.official)}>
                  {p.official ? 'Not official' : 'Mark official'}
                </Button>
                <Link to={`/u/${p.username}`} className="ml-auto">
                  <Button variant="ghost">Open profile</Button>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Nobody has that username.</p>
          )}
        </div>
      )}
    </div>
  );
}
