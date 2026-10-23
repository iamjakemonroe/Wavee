import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { LuBug, LuExternalLink, LuFlag, LuShield } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { Button, EmptyState, Skeleton, Spinner } from '../components/ui';
import { api, type Report } from '../lib/api';
import { ago } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';

const REPORT_STATUSES = ['open', 'reviewing', 'actioned', 'dismissed'] as const;
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
  const account = useAuth((s) => s.account);
  const loading = useAuth((s) => s.loading);
  const [tab, setTab] = useState<'reports' | 'bugs'>('reports');
  if (loading) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
  if (!account?.is_admin) return <EmptyState icon={<LuShield />} title="Moderators only" text="This page is for the Wavee team." />;
  return (
    <div className="animate-rise">
      <h1 className="mt-2 text-3xl">Moderation</h1>
      <div className="mb-6 mt-6 flex gap-6 border-b border-line/[0.06]">
        {(
          [
            ['reports', 'Reports', <LuFlag key="f" />],
            ['bugs', 'Bug reports', <LuBug key="b" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              '-mb-px flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition',
              tab === id ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      {tab === 'reports' ? <Reports /> : <Bugs />}
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
