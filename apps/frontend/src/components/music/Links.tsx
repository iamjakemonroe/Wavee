import clsx from 'clsx';
import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { checkLink, PLATFORMS, presentLinks, tidyLink, type Links, type Platform } from '../../lib/platforms';

/** A field per platform. Links are tidied (https:// added) and checked as they're typed, with
 * the same rules the database uses. */
export function LinksEditor({
  platforms,
  value,
  onChange,
  collapsedAfter,
}: {
  platforms: Platform[];
  value: Links;
  onChange: (links: Links) => void;
  /** Show only the first few until "More" is pressed (filled ones always show). */
  collapsedAfter?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<Platform, string>>>({});
  const shown = platforms.filter(
    (p, i) => open || collapsedAfter === undefined || i < collapsedAfter || !!value[p],
  );

  const set = (p: Platform, raw: string) => {
    setDraft((d) => ({ ...d, [p]: raw }));
    const next = { ...value };
    const url = tidyLink(raw);
    if (url) next[p] = url;
    else delete next[p];
    onChange(next);
  };

  return (
    <div className="space-y-2.5">
      {shown.map((p) => {
        const info = PLATFORMS[p];
        const text = draft[p] ?? value[p] ?? '';
        const error = text ? checkLink(p, tidyLink(text)) : null;
        return (
          <div key={p}>
            <label className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line/10 bg-line/[0.03] text-lg" style={{ color: info.color }}>
                {info.icon}
              </span>
              <span className="sr-only">{info.label}</span>
              <input
                value={text}
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`${info.label}: ${info.example}`}
                onChange={(e) => set(p, e.target.value)}
                onBlur={() => setDraft((d) => ({ ...d, [p]: value[p] ?? '' }))}
                className={clsx(
                  'h-11 w-full min-w-0 rounded-xl border bg-line/[0.03] px-3.5 text-[14px] text-ink placeholder:text-faint focus:outline-none',
                  error ? 'border-danger/60' : 'border-line/10 focus:border-violet/60',
                )}
              />
            </label>
            {error && <p className="ml-14 mt-1 text-[12px] text-danger">{error}</p>}
          </div>
        );
      })}
      {collapsedAfter !== undefined && !open && shown.length < platforms.length && (
        <button type="button" onClick={() => setOpen(true)} className="ml-14 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          More platforms <LuChevronDown />
        </button>
      )}
    </div>
  );
}

/** True when every link in [links] passes for its platform. */
export function linksValid(links: Links): boolean {
  return Object.entries(links).every(([p, url]) => !url || !checkLink(p as Platform, url));
}

/** Buttons out to the other platforms, in their colours. */
export function LinkPills({
  links,
  order,
  className,
  compact,
}: {
  links: Links | null | undefined;
  order: Platform[];
  className?: string;
  compact?: boolean;
}) {
  const list = presentLinks(links, order);
  if (!list.length) return null;
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {list.map(([p, url]) => {
        const info = PLATFORMS[p];
        return (
          <a
            key={p}
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            aria-label={info.label}
            title={info.label}
            className={clsx(
              'group inline-flex items-center gap-2 rounded-full border border-line/10 bg-line/[0.04] text-[13px] font-medium text-ink/90 transition duration-300 hover:-translate-y-0.5 hover:border-line/25 hover:bg-line/[0.08]',
              compact ? 'h-9 w-9 justify-center' : 'h-9 px-3.5',
            )}
          >
            <span className="text-[15px] transition group-hover:scale-110" style={{ color: info.color }}>
              {info.icon}
            </span>
            {!compact && info.label}
          </a>
        );
      })}
    </div>
  );
}
