import { useEffect, useRef, useState } from 'react';
import { LuPause, LuPlay } from 'react-icons/lu';
import { duration as fmt } from '../../lib/format';
import { usePlayer } from '../../store/player';

const PREVIEW = 15;

/** Choose where the best part starts. The feed plays songs from their hook, like a sound on
 * TikTok, so listeners hear the moment that hooks them first. */
export function HookPicker({
  src,
  length,
  value,
  onChange,
}: {
  /** The song (an uploaded URL, or a local file's object URL). */
  src: string;
  length: number;
  value: number | null;
  onChange: (seconds: number | null) => void;
}) {
  const el = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const at = Math.min(value ?? 0, Math.max(0, length - 1));

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    el.current = audio;
    const stop = () => setPreviewing(false);
    audio.addEventListener('pause', stop);
    return () => {
      audio.removeEventListener('pause', stop);
      audio.pause();
      audio.removeAttribute('src');
      el.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = el.current;
    if (!audio || !previewing) return;
    const tick = () => {
      if (audio.currentTime >= at + PREVIEW) audio.pause();
    };
    audio.addEventListener('timeupdate', tick);
    return () => audio.removeEventListener('timeupdate', tick);
  }, [previewing, at]);

  const preview = () => {
    const audio = el.current;
    if (!audio) return;
    if (previewing) {
      audio.pause();
      return;
    }
    // One thing playing at a time.
    if (usePlayer.getState().playing) usePlayer.getState().toggle();
    if (audio.src !== src) audio.src = src;
    audio.currentTime = at;
    setPreviewing(true);
    void audio.play().catch(() => setPreviewing(false));
  };

  const pct = length > 0 ? (at / length) * 100 : 0;

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={preview}
          aria-label={previewing ? 'Stop the preview' : 'Hear the hook'}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition hover:scale-105 active:scale-95"
        >
          {previewing ? <LuPause className="fill-current" /> : <LuPlay className="ml-0.5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="relative h-11">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line/[0.08]" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-teal to-violet"
              style={{ left: `${pct}%`, width: `${Math.min(100 - pct, (PREVIEW / Math.max(length, 1)) * 100)}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(0, length - 1)}
              step={1}
              value={at}
              aria-label="Where the hook starts"
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange(v);
                if (previewing && el.current) el.current.currentTime = v;
              }}
              className="hook-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>
          <div className="flex justify-between text-[12px] text-faint">
            <span>
              Starts at <b className="font-semibold text-ink">{fmt(at)}</b>
            </span>
            <span>{fmt(length)}</span>
          </div>
        </div>
      </div>
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} className="mt-2 text-[12px] text-muted hover:text-ink">
          Start from the beginning instead
        </button>
      )}
    </div>
  );
}
