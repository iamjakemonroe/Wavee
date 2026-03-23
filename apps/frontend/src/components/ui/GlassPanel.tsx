import type { HTMLAttributes } from "react";
import clsx from "clsx";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: "light" | "medium" | "heavy";
}

export function GlassPanel({
  className,
  intensity = "medium",
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border transition-colors",
        {
          "border-white/10 bg-white/5 backdrop-blur-md": intensity === "light",
          "border-white/[0.08] bg-white/[0.04] backdrop-blur-xl": intensity === "medium",
          "border-white/[0.06] bg-black/40 backdrop-blur-2xl": intensity === "heavy",
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
