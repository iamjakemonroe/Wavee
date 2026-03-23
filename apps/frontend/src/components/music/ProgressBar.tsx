import { useRef, useCallback } from "react";
import clsx from "clsx";

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
}

export function ProgressBar({ progress, duration, onSeek, className }: ProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const safeMax = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const pct = Math.min((progress / safeMax) * 100, 100);

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * safeMax);
    },
    [safeMax, onSeek],
  );

  return (
    <div
      ref={ref}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={progress}
      tabIndex={0}
      className={clsx("group relative flex h-5 cursor-pointer items-center", className)}
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
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 transition-[height] group-hover:h-1.5">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-wavee-primary to-wavee-secondary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="absolute h-3 w-3 rounded-full bg-wavee-primary opacity-0 shadow-neon transition-opacity group-hover:opacity-100"
        style={{ left: `calc(${pct}% - 6px)` }}
      />
    </div>
  );
}
