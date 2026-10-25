import clsx from 'clsx';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { LuArrowDownRight, LuArrowUpRight, LuTable } from 'react-icons/lu';
import { count } from '../../lib/format';

// Chart colours (validated for this dark surface with the dataviz palette checks): one series
// wears the brand teal; two-part charts use a deeper teal next to the violet.
const SERIES = '#18e2b0';
const PAIR = ['#10a882', '#8466ff'] as const;
const GRID = 'rgba(255,255,255,0.07)';
const SURFACE = 'rgb(22 25 33)';

/** The width of an element, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A round top for the axis: 0, 25, 50, 75, 100 rather than 0, 23, 46… */
function niceMax(max: number, ticks: number) {
  if (max <= 0) return ticks;
  const raw = max / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * power).find((s) => s >= raw) ?? raw;
  return Math.max(step * ticks, ticks);
}

const dayLabel = (date: string, unit: 'day' | 'week') =>
  (unit === 'week' ? 'Week of ' : '') +
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A stat with how it moved since the period before ("+24% vs the 28 days before"). */
export function StatTile({
  label,
  value,
  before,
  format = count,
  hint,
}: {
  label: string;
  value: number | null;
  before?: number | null;
  format?: (n: number) => string;
  hint?: string;
}) {
  const change = before == null || value == null ? null : value - before;
  const pct = change != null && before ? Math.round((change / before) * 100) : null;
  return (
    <div className="rounded-2xl bg-line/[0.04] p-4" title={hint}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold leading-none tracking-tight">{value == null ? '–' : format(value)}</p>
      <p className="mt-2 h-4 text-[12px]">
        {change != null && change !== 0 && (
          <span className={clsx('inline-flex items-center gap-0.5 font-semibold', change > 0 ? 'text-teal' : 'text-faint')}>
            {change > 0 ? <LuArrowUpRight /> : <LuArrowDownRight />}
            {pct != null ? `${Math.abs(pct)}%` : format(Math.abs(change))}
          </span>
        )}
        {change === 0 && <span className="text-faint">No change</span>}
      </p>
    </div>
  );
}

/** A card with a title, the chart, and a table of the same numbers a tap away. */
export function ChartCard({
  title,
  subtitle,
  action,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** The same numbers as rows: [label, value] (the chart's accessible twin). */
  table?: [string, string][];
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action && <div className="max-sm:hidden">{action}</div>}
          {table && (
            <button
              type="button"
              onClick={() => setAsTable((t) => !t)}
              aria-pressed={asTable}
              className={clsx(
                'grid h-8 w-8 place-items-center rounded-full text-[15px] transition',
                asTable ? 'bg-ink text-bg' : 'text-muted hover:bg-line/[0.06] hover:text-ink',
              )}
              title={asTable ? 'Show the chart' : 'Show as a table'}
              aria-label={asTable ? 'Show the chart' : 'Show as a table'}
            >
              <LuTable />
            </button>
          )}
        </div>
      </div>
      {action && <div className="-mt-1 mb-3 sm:hidden">{action}</div>}
      {asTable && table ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {table.map(([label, value]) => (
                <tr key={label} className="border-b border-line/[0.06] last:border-0">
                  <td className="py-2 text-muted">{label}</td>
                  <td className="py-2 text-right tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** One series over time: a 2px line over a soft wash, with a crosshair that snaps to the nearest
 * day (pointer or arrow keys). */
export function TrendChart({
  points,
  unit,
  name,
  format = count,
  height = 200,
}: {
  points: { date: string; value: number }[];
  unit: 'day' | 'week';
  /** What's plotted, for the tooltip and screen readers: "streams". */
  name: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const gradient = useId();
  const left = 36;
  const right = 8;
  const top = 10;
  const axis = 26;
  const plotW = Math.max(0, width - left - right);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)), 4);
  const n = points.length;
  const x = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => top + height - (v / max) * height;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : '';
  const ticks = [0, 1, 2, 3, 4].map((k) => (max / 4) * k);
  const labels = n ? [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])] : [];
  const total = points.reduce((s, p) => s + p.value, 0);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left - left) / Math.max(1, plotW);
    setAt(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  };
  const keys = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setAt((i) => Math.min(n - 1, Math.max(0, (i ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
    }
  };
  const shown = at ?? null;
  const tipLeft = shown == null ? 0 : Math.min(Math.max(x(shown) - 70, 0), Math.max(0, width - 140));

  return (
    <div ref={ref} className="relative select-none">
      {width > 0 && (
        <svg
          width={width}
          height={top + height + axis}
          role="img"
          aria-label={`${name}: ${format(total)} in total. Use the arrow keys to read each ${unit}.`}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-violet/60"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setAt(null)}
          onFocus={() => setAt(n - 1)}
          onBlur={() => setAt(null)}
          onKeyDown={keys}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={SERIES} stopOpacity="0.16" />
              <stop offset="1" stopColor={SERIES} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10.5px] tabular-nums">
                {format(Math.round(t))}
              </text>
            </g>
          ))}
          {labels.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={top + height + 18}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="fill-faint text-[10.5px]"
            >
              {dayLabel(points[i].date, 'day')}
            </text>
          ))}
          <path d={area} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {n > 0 && shown == null && (
            <circle cx={x(n - 1)} cy={y(points[n - 1].value)} r="4" fill={SERIES} stroke={SURFACE} strokeWidth="2" />
          )}
          {shown != null && (
            <g pointerEvents="none">
              <line x1={x(shown)} x2={x(shown)} y1={top} y2={top + height} stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
              <circle cx={x(shown)} cy={y(points[shown].value)} r="4.5" fill={SERIES} stroke={SURFACE} strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {shown != null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 w-[140px] rounded-xl border border-line/10 bg-bg/95 px-3 py-2 shadow-lift"
          style={{ left: tipLeft }}
        >
          <p className="text-[15px] font-bold tabular-nums">{format(points[shown].value)}</p>
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="inline-block h-[2px] w-3 rounded-full" style={{ background: SERIES }} />
            {name} · {dayLabel(points[shown].date, unit)}
          </p>
        </div>
      )}
      {width === 0 && <div style={{ height: top + height + axis }} />}
    </div>
  );
}

/** Magnitudes side by side, largest first: one hue, the value at the tip. */
export function BarList({
  items,
  format = count,
  total,
}: {
  items: { key: string; label: ReactNode; value: number }[];
  format?: (n: number) => string;
  /** Shows each as a share of this too. */
  total?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <b className="font-semibold text-ink">{format(i.value)}</b>
              {total ? <span className="ml-1.5">{Math.round((i.value / total) * 100)}%</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(1.5, (i.value / max) * 100)}%`, background: SERIES }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A whole split in two (new and returning listeners), with a legend that carries the numbers. */
export function SplitBar({ parts, format = count }: { parts: [{ label: string; value: number }, { label: string; value: number }]; format?: (n: number) => string }) {
  const total = parts[0].value + parts[1].value;
  return (
    <div>
      <div className="flex h-3.5 gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label}: ${format(p.value)}`).join(', ')}>
        {total === 0 ? (
          <div className="h-full w-full rounded-[4px] bg-line/10" />
        ) : (
          parts.map((p, i) =>
            p.value ? (
              <div
                key={p.label}
                className={clsx('h-full', i === 0 ? 'rounded-l-[4px]' : 'rounded-r-[4px]', !parts[1 - i].value && 'rounded-[4px]')}
                style={{ width: `${(p.value / total) * 100}%`, background: PAIR[i] }}
              />
            ) : null,
          )
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PAIR[i] }} />
            <span className="text-muted">{p.label}</span>
            <b className="font-semibold">{format(p.value)}</b>
            {total > 0 && <span className="text-faint">{Math.round((p.value / total) * 100)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ten columns: how much of the song people heard (0–10%, 10–20% … 90–100%). */
export function Columns({ values, label }: { values: number[]; label: (i: number) => string }) {
  const max = Math.max(1, ...values);
  const [at, setAt] = useState<number | null>(null);
  return (
    <div className="relative">
      <div className="flex h-36 items-end gap-[2px]" onPointerLeave={() => setAt(null)}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className="group flex h-full flex-1 items-end justify-center outline-none"
            onPointerEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            onBlur={() => setAt(null)}
            aria-label={`${label(i)}: ${count(v)} plays`}
          >
            <span
              className={clsx('block w-full max-w-[24px] rounded-t-[4px] transition', at === i && 'brightness-125')}
              style={{ height: `${Math.max(v ? 3 : 1, (v / max) * 100)}%`, background: v ? SERIES : 'rgba(255,255,255,0.08)' }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-faint">
        <span>0%</span>
        <span>half</span>
        <span>all of it</span>
      </div>
      {at != null && (
        <div
          className="pointer-events-none absolute -top-2 rounded-xl border border-line/10 bg-bg/95 px-3 py-2 text-[12px] shadow-lift"
          style={{ left: `clamp(0px, calc(${((at + 0.5) / values.length) * 100}% - 70px), calc(100% - 140px))`, width: 140 }}
        >
          <p className="text-[15px] font-bold tabular-nums">{count(values[at])} plays</p>
          <p className="text-muted">{label(at)}</p>
        </div>
      )}
    </div>
  );
}
