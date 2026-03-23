import clsx from "clsx";

interface WaveformBarProps {
  isPlaying: boolean;
  className?: string;
  barCount?: number;
}

export function WaveformBar({ isPlaying, className, barCount = 4 }: WaveformBarProps) {
  return (
    <div className={clsx("flex items-end gap-[2px]", className)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-wavee-primary"
          style={{
            height: "14px",
            transformOrigin: "bottom",
            animation: isPlaying
              ? `waveform ${0.8 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`
              : "none",
            transform: isPlaying ? undefined : "scaleY(0.3)",
            transition: "transform 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}
