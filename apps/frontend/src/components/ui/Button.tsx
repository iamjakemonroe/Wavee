import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all",
        "disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-wavee-primary text-black hover:bg-wavee-primary-dim hover:shadow-neon active:scale-[0.98]":
            variant === "primary",
          "bg-wavee-secondary text-white hover:bg-wavee-secondary-dim hover:shadow-glow active:scale-[0.98]":
            variant === "secondary",
          "bg-white/5 text-wavee-text hover:bg-white/10 active:bg-white/[0.07]":
            variant === "ghost",
          "bg-wavee-danger/10 text-wavee-danger hover:bg-wavee-danger/20":
            variant === "danger",
        },
        {
          "px-3 py-1.5 text-xs": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          "px-6 py-3 text-base": size === "lg",
        },
        className,
      )}
      {...props}
    >
      {isLoading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
