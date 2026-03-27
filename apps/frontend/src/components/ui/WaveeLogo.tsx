import clsx from "clsx";

interface WaveeLogoProps {
  size?: number;
  className?: string;
}

/** Inline app mark — works offline / PWA without fetching `/icon-*.png`. */
export function WaveeLogo({ size = 32, className }: WaveeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={clsx("shrink-0", className)}
      role="img"
      aria-label="Wavee"
    >
      <rect width="32" height="32" rx="7" className="fill-[#0B0B0F]" />
      <g transform="translate(4.5 6)">
        <rect x="0" y="4.5" width="3" height="6" rx="1.5" className="fill-wavee-primary" />
        <rect x="5" y="2.5" width="3" height="14" rx="1.5" className="fill-wavee-primary" />
        <rect x="10" y="0" width="3" height="20" rx="1.5" className="fill-wavee-primary" />
        <rect x="15" y="1.5" width="3" height="17" rx="1.5" className="fill-wavee-secondary" />
        <rect x="20" y="3.5" width="3" height="11" rx="1.5" className="fill-wavee-secondary" />
      </g>
    </svg>
  );
}

/** Full route / suspense fallback: larger animated mark. */
export function WaveeRouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-wavee-bg">
      <div className="animate-pulse">
        <WaveeLogo size={72} className="drop-shadow-[0_0_24px_rgba(0,209,160,0.25)]" />
      </div>
    </div>
  );
}
