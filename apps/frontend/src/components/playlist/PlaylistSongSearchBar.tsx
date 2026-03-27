import { FiSearch } from "react-icons/fi";

interface PlaylistSongSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Shown when non-empty, e.g. "3 in this playlist" */
  hint?: string;
}

export function PlaylistSongSearchBar({ value, onChange, disabled, hint }: PlaylistSongSearchBarProps) {
  return (
    <div className="relative mb-4">
      <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus-within:border-wavee-primary/35 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_1px_rgba(0,209,160,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
          aria-hidden
        >
          <div className="absolute -left-1/4 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-wavee-primary/40 to-transparent blur-sm" />
        </div>
        <FiSearch
          className="absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-wavee-muted transition-colors group-focus-within:text-wavee-primary/80"
          size={17}
        />
        <input
          type="search"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search this playlist…"
          autoComplete="off"
          className="relative z-[1] w-full rounded-2xl border-0 bg-transparent py-3 pl-10 pr-3 text-sm text-wavee-text outline-none ring-0 placeholder:text-wavee-muted/45 disabled:opacity-50 md:text-[13px]"
        />
      </div>
      {hint ? (
        <p className="mt-2 px-1 text-xs font-medium tracking-wide text-wavee-muted">{hint}</p>
      ) : null}
    </div>
  );
}
