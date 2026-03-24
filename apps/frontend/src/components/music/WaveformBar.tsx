import clsx from "clsx";

interface WaveformBarProps {
  isPlaying: boolean;
  className?: string;
  barCount?: number;
}

const WAVE_CONFIGS = [
  { name: "wave-1", duration: 1.2 },
  { name: "wave-2", duration: 1.0 },
  { name: "wave-3", duration: 1.4 },
  { name: "wave-4", duration: 0.9 },
  { name: "wave-5", duration: 1.1 },
  { name: "wave-3", duration: 1.3 },
  { name: "wave-1", duration: 0.8 },
];

export function WaveformBar({
  isPlaying,
  className,
  barCount = 5,
}: WaveformBarProps) {
  return (
    <div className={clsx("flex items-end gap-[2px]", className)}>
      {Array.from({ length: barCount }).map((_, i) => {
        const config = WAVE_CONFIGS[i % WAVE_CONFIGS.length]!;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-wavee-primary"
            style={{
              height: "100%",
              transformOrigin: "bottom",
              animation: isPlaying
                ? `${config.name} ${config.duration}s ease-in-out ${i * 0.08}s infinite`
                : "none",
              transform: isPlaying ? undefined : "scaleY(0.15)",
              transition: "transform 0.3s ease",
            }}
          />
        );
      })}
    </div>
  );
}
