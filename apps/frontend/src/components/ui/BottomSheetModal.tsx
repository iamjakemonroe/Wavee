import { useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

const MD_UP_QUERY = "(min-width: 768px)";

function subscribeMediaQuery(query: string, callback: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeMediaQuery(query, onStoreChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export interface BottomSheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shown under the title (e.g. artist line in action menus). */
  subtitle?: string;
  /** `menu`: Done-only header, no Save/Cancel. `form`: Cancel | Title | Save. */
  variant?: "form" | "menu";
  /**
   * Menu only: hide title/Done bar; use `menuTopSlot` for a custom top (e.g. track art + text).
   * Close via drag handle, backdrop, or Escape.
   */
  menuBare?: boolean;
  /** Menu + menuBare: rendered under the drag handle; area is draggable to dismiss. */
  menuTopSlot?: ReactNode;
  /** Overrides padding on the scrollable content wrapper (e.g. `px-3 pt-0 pb-4`). */
  contentClassName?: string;
  /** When the visible title is custom (menuBare), set for screen readers. */
  "aria-label"?: string;
  onSave?: () => void | Promise<void>;
  saveLabel?: string;
  isSaving?: boolean;
  saveDisabled?: boolean;
  children: ReactNode;
}

const sheetSpring = { type: "spring" as const, damping: 32, stiffness: 380 };
const desktopSpring = { type: "spring" as const, damping: 28, stiffness: 320 };

export function BottomSheetModal({
  open,
  onOpenChange,
  title,
  subtitle,
  variant = "form",
  menuBare = false,
  menuTopSlot,
  contentClassName,
  "aria-label": ariaLabelProp,
  onSave,
  saveLabel = "Save",
  isSaving,
  saveDisabled,
  children,
}: BottomSheetModalProps) {
  const titleId = useId();
  const subtitleId = useId();
  const isDesktop = useMediaQuery(MD_UP_QUERY);
  const dragControls = useDragControls();
  const isMenu = variant === "menu";
  const bareMenu = isMenu && menuBare;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, isSaving]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const tryClose = () => {
    if (!isSaving) onOpenChange(false);
  };

  const onSheetDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    if (isSaving || isDesktop) return;
    const dismissY = 96;
    const dismissVel = 420;
    if (info.offset.y > dismissY || info.velocity.y > dismissVel) {
      onOpenChange(false);
    }
  };

  const startSheetDrag = (e: React.PointerEvent) => {
    if (isDesktop || isSaving) return;
    dragControls.start(e);
  };

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (isDesktop || isSaving) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragControls.start(e);
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="bottom-sheet-backdrop"
            role="presentation"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={tryClose}
          />

          <motion.div
            key="bottom-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label={bareMenu ? (ariaLabelProp ?? title) || "Options" : undefined}
            aria-labelledby={bareMenu ? undefined : titleId}
            aria-describedby={bareMenu || !subtitle ? undefined : subtitleId}
            initial={
              isDesktop
                ? { opacity: 0, scale: 0.94, x: "-50%", y: "-50%" }
                : { y: "100%" }
            }
            animate={
              isDesktop
                ? { opacity: 1, scale: 1, x: "-50%", y: "-50%" }
                : { y: 0 }
            }
            exit={
              isDesktop
                ? { opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }
                : { y: "100%" }
            }
            transition={isDesktop ? desktopSpring : sheetSpring}
            drag={!isSaving && !isDesktop ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={onSheetDragEnd}
            className={clsx(
              "fixed z-[101] flex max-h-[min(92vh,640px)] w-full flex-col overflow-hidden border border-white/[0.08] bg-[#0c0c0f]",
              isDesktop
                ? "left-1/2 top-1/2 max-h-[min(85vh,720px)] max-w-lg rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                : "inset-x-0 bottom-0 max-w-none rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.45)]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col pt-2">
              {bareMenu ? (
                <div
                  className={clsx(
                    "shrink-0 touch-none",
                    !isDesktop && !isSaving && "cursor-grab active:cursor-grabbing",
                  )}
                  onPointerDown={!isDesktop && !isSaving ? startSheetDrag : undefined}
                >
                  {!isDesktop && (
                    <div className="mx-auto mb-1 flex justify-center py-1">
                      <div className="h-1 w-10 shrink-0 rounded-full bg-white/25" aria-hidden />
                    </div>
                  )}
                  {menuTopSlot}
                </div>
              ) : (
                !isDesktop && (
                  <div
                    className="mx-auto mb-2 flex cursor-grab touch-none justify-center py-1 active:cursor-grabbing"
                    onPointerDown={startSheetDrag}
                  >
                    <div className="h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
                  </div>
                )
              )}

              {!bareMenu && (
              <header
                className={clsx(
                  "flex shrink-0 flex-col gap-0.5 border-b border-white/[0.06] px-4 pb-3 pt-0",
                  !isDesktop && !isSaving && "cursor-grab touch-none active:cursor-grabbing",
                )}
                onPointerDown={onHeaderPointerDown}
              >
                <div className="flex min-h-[2.25rem] items-center justify-between gap-2">
                  {isMenu ? (
                    <>
                      <div className="min-w-[4rem] shrink-0" aria-hidden />
                      <h2
                        id={titleId}
                        className="flex-1 truncate text-center text-sm font-semibold text-wavee-text"
                      >
                        {title}
                      </h2>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                        className="min-w-[4rem] shrink-0 py-1 text-right text-sm font-semibold text-wavee-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                        className="min-w-[4rem] shrink-0 py-1 text-left text-sm font-medium text-wavee-muted transition-colors hover:text-wavee-text disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <h2
                        id={titleId}
                        className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-wavee-text"
                      >
                        {title}
                      </h2>
                      <button
                        type="button"
                        disabled={isSaving || saveDisabled}
                        onClick={() => void onSave?.()}
                        className="min-w-[4rem] shrink-0 py-1 text-right text-sm font-semibold text-wavee-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {isSaving ? "…" : saveLabel}
                      </button>
                    </>
                  )}
                </div>
                {subtitle ? (
                  <p
                    id={subtitleId}
                    className="truncate px-2 text-center text-xs text-wavee-muted"
                  >
                    {subtitle}
                  </p>
                ) : null}
              </header>
              )}

              <div
                className={clsx(
                  "max-h-[min(72vh,520px)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]",
                  contentClassName ?? "px-4 pt-4",
                )}
              >
                {children}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
