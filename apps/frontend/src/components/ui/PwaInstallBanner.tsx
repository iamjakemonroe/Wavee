import { AnimatePresence, motion } from "framer-motion";
import { FiDownload, FiShare2, FiSmartphone, FiX } from "react-icons/fi";
import {
  usePwaInstallPrompt,
  type PwaBannerVariant,
} from "@/hooks/usePwaInstallPrompt";
import clsx from "clsx";

function copyForVariant(v: PwaBannerVariant): { title: string; body: string } {
  switch (v) {
    case "install":
      return {
        title: "Install Wavee",
        body: "Launch from your home screen, listen full screen, and keep music out of crowded browser tabs.",
      };
    case "ios":
      return {
        title: "Add Wavee to your Home Screen",
        body: "Get the app feel in one tap — no App Store required. Works offline after the first visit.",
      };
    case "android":
      return {
        title: "Install Wavee on this device",
        body: "Open your browser menu (⋮) and choose Install app or Add to Home screen for quick access.",
      };
  }
}

export function PwaInstallBanner() {
  const { visible, variant, deferredPrompt, runInstall, dismiss } =
    usePwaInstallPrompt();

  const { title, body } = copyForVariant(variant);
  const showInstallButton = Boolean(deferredPrompt);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-labelledby="pwa-install-title"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
          className={clsx(
            "pointer-events-auto fixed z-[46] w-full",
            /* Below mobile header + safe area; desktop: top of main column past sidebar */
            "left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+3.85rem)]",
            "px-3 sm:px-5",
            "lg:left-64 lg:top-[calc(env(safe-area-inset-top,0px)+0.75rem)] lg:px-6",
          )}
        >
          <div
            className={clsx(
              "mx-auto w-full max-w-4xl",
              "relative overflow-hidden rounded-2xl border border-white/[0.12]",
              "bg-wavee-surface/95 shadow-neon-lg backdrop-blur-2xl",
              "ring-1 ring-wavee-primary/20",
            )}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(ellipse 120% 80% at 100% 0%, rgba(0,209,160,0.14), transparent 55%), radial-gradient(ellipse 100% 60% at 0% 100%, rgba(124,92,255,0.12), transparent 50%)",
              }}
            />

            <button
              type="button"
              onClick={() => dismiss("permanent")}
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.08] hover:text-wavee-text"
              aria-label="Dismiss"
            >
              <FiX size={20} />
            </button>

            <div className="relative px-5 pb-5 pt-5 pr-14 sm:px-7 sm:pb-6 sm:pt-6 sm:pr-16">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wavee-primary/15 ring-1 ring-wavee-primary/25 sm:h-12 sm:w-12">
                  {variant === "ios" ? (
                    <FiShare2 className="text-wavee-primary" size={22} />
                  ) : variant === "android" ? (
                    <FiSmartphone className="text-wavee-primary" size={22} />
                  ) : (
                    <FiDownload className="text-wavee-primary" size={22} />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <h2
                    id="pwa-install-title"
                    className="text-base font-bold leading-snug tracking-tight text-wavee-text sm:text-lg"
                  >
                    {title}
                  </h2>
                  <p className="max-w-2xl text-sm leading-[1.65] text-wavee-muted sm:text-[15px]">
                    {body}
                  </p>
                </div>
              </div>

              {variant === "ios" && (
                <ol className="mt-5 space-y-3 border-l border-white/[0.1] pl-4 sm:mt-6">
                  <li className="relative pl-1 text-sm leading-[1.65] text-wavee-muted sm:text-[15px]">
                    <span className="absolute -left-[calc(1rem+3px)] top-2 h-2 w-2 rounded-full bg-wavee-primary" />
                    Tap <strong className="font-semibold text-wavee-text">Share</strong>{" "}
                    <span className="text-wavee-muted/80">(square with arrow)</span>{" "}
                    in the toolbar
                  </li>
                  <li className="relative pl-1 text-sm leading-[1.65] text-wavee-muted sm:text-[15px]">
                    <span className="absolute -left-[calc(1rem+3px)] top-2 h-2 w-2 rounded-full bg-wavee-secondary/80" />
                    Scroll and tap{" "}
                    <strong className="font-semibold text-wavee-text">
                      Add to Home Screen
                    </strong>
                  </li>
                  <li className="relative pl-1 text-sm leading-[1.65] text-wavee-muted sm:text-[15px]">
                    <span className="absolute -left-[calc(1rem+3px)] top-2 h-2 w-2 rounded-full bg-white/35" />
                    Tap <strong className="font-semibold text-wavee-text">Add</strong> — done.
                  </li>
                </ol>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
                {showInstallButton && (
                  <button
                    type="button"
                    onClick={() => void runInstall()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wavee-primary px-5 py-3 text-sm font-semibold text-black shadow-neon transition-transform hover:brightness-110 active:scale-[0.99] sm:w-auto"
                  >
                    <FiDownload size={18} />
                    Install app
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss("snooze")}
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 py-3 text-sm font-medium text-wavee-text transition-colors hover:bg-white/[0.09] sm:w-auto"
                >
                  Remind me later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
