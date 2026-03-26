import { useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";

export interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  cancelLabel?: string;
  proceedLabel?: string;
  onProceed: () => void | Promise<void>;
  isProceeding?: boolean;
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  message,
  cancelLabel = "Cancel",
  proceedLabel = "Continue",
  onProceed,
  isProceeding,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isProceeding && onOpenChange(false)}
      />
      <GlassPanel
        intensity="heavy"
        className="relative z-[101] w-full max-w-md p-6 shadow-neon-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-modal-title" : undefined}
        aria-describedby="confirm-modal-desc"
      >
        {title && (
          <h2 id="confirm-modal-title" className="text-lg font-bold text-wavee-text">
            {title}
          </h2>
        )}
        <p
          id="confirm-modal-desc"
          className={clsx("text-sm text-wavee-muted", title && "mt-2")}
        >
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <div className="w-full rounded-xl bg-gradient-to-r from-wavee-primary to-wavee-secondary p-[1px] sm:w-auto sm:flex-none">
            <button
              type="button"
              disabled={isProceeding}
              onClick={() => onOpenChange(false)}
              className={clsx(
                "w-full rounded-[11px] bg-wavee-bg px-5 py-2.5 text-sm font-semibold text-wavee-text",
                "transition-colors hover:bg-wavee-surface disabled:opacity-50",
              )}
            >
              {cancelLabel}
            </button>
          </div>
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto sm:min-w-[7rem]"
            isLoading={isProceeding}
            disabled={isProceeding}
            onClick={() => void onProceed()}
          >
            {proceedLabel}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );

  return createPortal(node, document.body);
}
