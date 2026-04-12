import { useRef, useCallback } from "react";
import clsx from "clsx";

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  /** Buffering / loading before playback or while stalled */
  indeterminate?: boolean;
}

export function ProgressBar({
  progress,
  duration,
  onSeek,
  className,
  indeterminate = false,
}: ProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const safeMax = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const pct = Math.min((progress / safeMax) * 100, 100);

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (indeterminate || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * safeMax);
    },
    [indeterminate, safeMax, onSeek],
  );

  return (
    <div
      ref={ref}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={indeterminate ? undefined : progress}
      aria-busy={indeterminate}
      tabIndex={0}
      className={clsx(
        "group relative flex h-5 cursor-pointer items-center",
        indeterminate && "cursor-default",
        className,
      )}
      onMouseDown={(e) => handleInteraction(e.clientX)}
      onMouseMove={(e) => {
        if (e.buttons === 1) handleInteraction(e.clientX);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) handleInteraction(t.clientX);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleInteraction(t.clientX);
      }}
    >
      <div
        className={clsx(
          "relative w-full overflow-hidden rounded-full transition-[height]",
          indeterminate
            ? "h-[3px] bg-white/[0.06]"
            : "h-1 bg-white/10 group-hover:h-1.5",
        )}
      >
        {indeterminate ? (
          <div
            className="wavee-progress-indeterminate-shimmer absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            aria-hidden
          />
        ) : (
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-wavee-primary to-wavee-secondary"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {!indeterminate && (
        <div
          className="absolute h-3 w-3 rounded-full bg-wavee-primary opacity-0 shadow-neon transition-opacity group-hover:opacity-100"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      )}
    </div>
  );
}
