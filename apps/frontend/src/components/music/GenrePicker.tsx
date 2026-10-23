import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { LuPlus, LuSearch, LuX } from 'react-icons/lu';
import { GENRES, POPULAR_GENRES } from '../../lib/format';

const MAX = 3;

/** Up to three genres, in order: the first is the song's main genre (tap another to make it
 * main). Search the list, or add a genre that isn't on it. */
export function GenrePicker({ value, onChange }: { value: string[]; onChange: (genres: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const q = query.trim();
  const full = value.length >= MAX;
  const has = (g: string) => value.some((v) => v.toLowerCase() === g.toLowerCase());

  const options = useMemo(() => {
    const list: readonly string[] = q ? GENRES : all ? GENRES : POPULAR_GENRES;
    const needle = q.toLowerCase();
    return list.filter((g) => !has(g) && (!needle || g.toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, all, value]);
  const custom = q.length >= 2 && q.length <= 40 && !GENRES.some((g) => g.toLowerCase() === q.toLowerCase()) && !has(q);

  const add = (g: string) => {
    if (full || has(g)) return;
    onChange([...value, g]);
    setQuery('');
  };

  return (
    <div>
      <div className="mb-3 flex min-h-[36px] flex-wrap items-center gap-2">
        {value.length === 0 && <span className="text-[13px] text-faint">Pick up to three. The first is the main one.</span>}
        {value.map((g, i) => (
          <span
            key={g}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-[13px] font-medium',
              i === 0 ? 'border-teal/60 bg-teal/10 text-ink' : 'border-line/15 bg-line/[0.04] text-ink/90',
            )}
          >
            <button
              type="button"
              title={i === 0 ? 'Main genre' : 'Make this the main genre'}
              onClick={() => i > 0 && onChange([g, ...value.filter((v) => v !== g)])}
              className={clsx(i > 0 && 'hover:underline')}
            >
              {g}
            </button>
            {i === 0 && value.length > 1 && <span className="text-[10px] uppercase tracking-wider text-teal">Main</span>}
            <button
              type="button"
              aria-label={`Remove ${g}`}
              onClick={() => onChange(value.filter((v) => v !== g))}
              className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-line/[0.08] hover:text-ink"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {!full && (
        <>
          <div className="relative mb-3">
            <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (options[0]) add(options[0]);
                  else if (custom) add(q);
                }
              }}
              placeholder="Search genres"
              maxLength={40}
              className="h-11 w-full rounded-xl border border-line/10 bg-line/[0.03] pl-10 pr-3 text-[15px] text-ink placeholder:text-faint focus:border-violet/60 focus:outline-none"
            />
          </div>
          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
            {options.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => add(g)}
                className="h-8 rounded-full border border-line/10 px-3 text-[13px] text-muted transition hover:border-line/25 hover:text-ink"
              >
                {g}
              </button>
            ))}
            {custom && (
              <button
                type="button"
                onClick={() => add(q)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-teal/50 px-3 text-[13px] text-teal hover:bg-teal/10"
              >
                <LuPlus /> Add “{q}”
              </button>
            )}
            {!q && !all && (
              <button type="button" onClick={() => setAll(true)} className="h-8 px-2 text-[13px] font-medium text-ink/80 hover:text-ink">
                All genres…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
