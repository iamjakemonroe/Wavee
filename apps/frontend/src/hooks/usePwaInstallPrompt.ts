import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wavee:pwa-install-banner";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function getStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function readDismissState(): "permanent" | number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (raw === "permanent") return "permanent";
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export type PwaBannerVariant = "install" | "ios" | "android";

function initialSuppressed(): boolean {
  const dismissed = readDismissState();
  if (dismissed === "permanent") return true;
  if (typeof dismissed === "number" && Date.now() < dismissed) return true;
  return false;
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [delayed, setDelayed] = useState(false);
  const [suppressed, setSuppressed] = useState(initialSuppressed);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDelayed(true), 2800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!delayed || suppressed) {
      setVisible(false);
      return;
    }
    if (getStandalone()) {
      setVisible(false);
      return;
    }

    const dismissed = readDismissState();
    if (dismissed === "permanent") {
      setVisible(false);
      return;
    }
    if (typeof dismissed === "number" && Date.now() < dismissed) {
      setVisible(false);
      return;
    }

    const hasInstallPrompt = deferredPrompt !== null;
    const narrow = window.matchMedia("(max-width: 1023px)").matches;
    const showDesktopHint = hasInstallPrompt;

    if (!narrow && !showDesktopHint) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [delayed, deferredPrompt, suppressed]);

  const variant: PwaBannerVariant = deferredPrompt
    ? "install"
    : isIos()
      ? "ios"
      : "android";

  const dismiss = useCallback((mode: "permanent" | "snooze") => {
    try {
      if (mode === "permanent") {
        localStorage.setItem(STORAGE_KEY, "permanent");
      } else {
        localStorage.setItem(STORAGE_KEY, String(Date.now() + SNOOZE_MS));
      }
    } catch {
      /* ignore */
    }
    setSuppressed(true);
    setDeferredPrompt(null);
  }, []);

  const runInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    try {
      localStorage.setItem(STORAGE_KEY, "permanent");
    } catch {
      /* ignore */
    }
    setSuppressed(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    visible,
    variant,
    deferredPrompt,
    runInstall,
    dismiss,
  };
}
