import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ className, label, id, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-wavee-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          "w-full rounded-xl border border-wavee-border bg-wavee-surface px-4 py-2.5 text-base text-wavee-text md:text-sm",
          "outline-none transition-colors placeholder:text-wavee-muted/50",
          "focus:border-wavee-primary/50 focus:ring-1 focus:ring-wavee-primary/20",
          className,
        )}
        {...props}
      />
    </div>
  );
}
