import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { LuPlus, LuSearch, LuX } from 'react-icons/lu';
import { api, type Credit } from '../../lib/api';
import { Avatar, Spinner } from '../ui';
import { Verified } from './Verified';

export type Person = Credit['user'];
const MAX = 10;

const STATUS: Record<Credit['status'], { label: string; tone: string }> = {
  pending: { label: 'Asked', tone: 'text-warn' },
  accepted: { label: 'Accepted', tone: 'text-teal' },
  declined: { label: 'Declined', tone: 'text-danger' },
};

/** Pick the Wavee artists featured on a song, in credit order. Each is asked, and shows on the
 * song once they accept. */
export function FeaturePicker({
  value,
  onChange,
  exclude,
  statuses,
}: {
  value: Person[];
  onChange: (people: Person[]) => void;
  /** Never offered (the uploader). */
  exclude?: string;
  /** Where each already-asked artist stands (editing a song). */
  statuses?: Record<string, Credit['status']>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      api
        .searchUsers(q, 8)
        .then((users) => {
          if (!alive) return;
          setResults(
            users
              .filter((u) => u.id !== exclude && !value.some((v) => v.id === u.id))
              .map((u) => ({ id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url, verified: false })),
          );
        })
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [query, exclude, value]);

  const add = (p: Person) => {
    if (value.length >= MAX) return;
    onChange([...value, p]);
    setQuery('');
    setResults([]);
  };

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((p) => {
            const st = statuses?.[p.id];
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-full border border-line/10 bg-line/[0.04] py-1 pl-1 pr-2 text-[13px]">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} className="h-6 w-6 text-[10px]" />
                <span className="font-medium">{p.display_name || p.username}</span>
                {p.verified && <Verified className="h-3.5 w-3.5" />}
                {st && <span className={clsx('text-[11px]', STATUS[st].tone)}>{STATUS[st].label}</span>}
                <button
                  type="button"
                  aria-label={`Remove ${p.display_name || p.username}`}
                  onClick={() => onChange(value.filter((v) => v.id !== p.id))}
                  className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-line/[0.08] hover:text-ink"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {value.length < MAX && (
        <div className="relative">
          <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Wavee for an artist"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-line/10 bg-line/[0.03] pl-10 pr-10 text-[15px] text-ink placeholder:text-faint focus:border-violet/60 focus:outline-none"
          />
          {searching && <Spinner className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line/10 bg-raised shadow-lift">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => add(u)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-line/[0.06]"
                  >
                    <Avatar src={u.avatar_url} name={u.display_name || u.username} className="h-8 w-8 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.display_name || u.username}</span>
                      <span className="block truncate text-[12px] text-faint">@{u.username}</span>
                    </span>
                    <LuPlus className="text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-[12px] leading-5 text-faint">
        Each artist is asked first. Their name shows on the song, and the song on their page, once they accept.
      </p>
    </div>
  );
}
