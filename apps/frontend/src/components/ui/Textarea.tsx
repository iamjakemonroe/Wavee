import type { TextareaHTMLAttributes } from "react";
import clsx from "clsx";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ className, label, id, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-wavee-muted">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={4}
        className={clsx(
          "w-full resize-y rounded-xl border border-wavee-border bg-wavee-surface px-4 py-2.5 text-base text-wavee-text md:text-sm",
          "outline-none transition-colors placeholder:text-wavee-muted/50",
          "focus:border-wavee-primary/50 focus:ring-1 focus:ring-wavee-primary/20",
          className,
        )}
        {...props}
      />
    </div>
  );
}
