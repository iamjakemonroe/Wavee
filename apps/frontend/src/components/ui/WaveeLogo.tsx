import clsx from "clsx";

interface WaveeLogoProps {
  size?: number;
  className?: string;
}

export function WaveeLogo({ size = 32, className }: WaveeLogoProps) {
  return (
    <img
      src="/icon-192.png"
      alt="Wavee"
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      draggable={false}
    />
  );
}
