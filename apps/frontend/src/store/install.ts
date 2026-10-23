import { create } from 'zustand';
import { standalone } from '../lib/standalone';

/** The browser's install offer (Chrome, Edge, Samsung Internet), kept until it's used. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How Wavee can get onto this device's home screen. */
export type InstallWay =
  | 'prompt' // the browser can install it with one tap (Android, desktop Chrome/Edge)
  | 'ios-safari' // Share, Add to Home Screen
  | 'ios-browser' // Chrome, Firefox or Edge on an iPhone: their own Share, Add to Home Screen
  | 'in-app' // inside Instagram, TikTok, Facebook...: open in a real browser first
  | 'android-menu' // Android without the one-tap offer: the browser's menu
  | 'mac-safari' // File, Add to Dock
  | 'none'; // this browser can't install apps

interface InstallState {
  installed: boolean;
  offer: InstallPromptEvent | null;
  open: boolean;
  /** Opened by Wavee, not by a tap on Install (only then does "Not now" count). */
  asked: boolean;
  show: (asked?: boolean) => void;
  close: (notNow?: boolean) => void;
  /** Runs the browser's install offer; true if it was accepted. */
  install: () => Promise<boolean>;
}

const KEY = 'wavee.install';
const DAY = 86_400_000;

interface Memory {
  /** When "Not now" was last chosen, and how many times. */
  notNowAt?: number;
  notNow?: number;
  visits?: number;
}

const read = (): Memory => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Memory;
  } catch {
    return {};
  }
};
const write = (m: Memory) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Private browsing: it simply asks again another time.
  }
};

const ua = () => navigator.userAgent;
const isIos = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|TikTok|musical_ly|Bytedance|Snapchat|Twitter|LinkedInApp|Pinterest/i.test(ua());

export const useInstall = create<InstallState>((set, get) => ({
  installed: false,
  offer: null,
  open: false,
  asked: false,

  show: (asked = false) => {
    if (get().installed) return;
    set({ open: true, asked });
  },

  close: (notNow = false) => {
    if (notNow && get().asked) {
      const m = read();
      write({ ...m, notNowAt: Date.now(), notNow: (m.notNow ?? 0) + 1 });
    }
    set({ open: false, asked: false });
  },

  install: async () => {
    const offer = get().offer;
    if (!offer) return false;
    set({ offer: null }); // an offer can only be used once
    try {
      await offer.prompt();
      const { outcome } = await offer.userChoice;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  },
}));

/** How this device installs Wavee, right now. */
export function installWay(): InstallWay {
  if (useInstall.getState().offer) return 'prompt';
  if (inApp()) return 'in-app';
  if (isIos()) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua()) ? 'ios-browser' : 'ios-safari';
  if (/Android/i.test(ua())) return 'android-menu';
  if (/Macintosh/.test(ua()) && /Version\/1[7-9]|Version\/[2-9]\d/.test(ua()) && /Safari/.test(ua()) && !/Chrome|Chromium|Edg/.test(ua())) {
    return 'mac-safari';
  }
  return 'none';
}

/** Whether Wavee should offer itself now, unasked: on a phone or tablet that can install it,
 * not installed, and not turned down lately (two weeks after a "Not now"; never after three). */
export function mayAsk(): boolean {
  const { installed, open } = useInstall.getState();
  if (installed || open || standalone()) return false;
  const way = installWay();
  const phone = isIos() || /Android/i.test(ua());
  if (!phone || way === 'none' || way === 'in-app' || way === 'mac-safari') return false;
  const m = read();
  if ((m.notNow ?? 0) >= 3) return false;
  if (m.notNowAt && Date.now() - m.notNowAt < 14 * DAY) return false;
  return true;
}

/** How many separate visits this browser has made. */
export const visits = () => read().visits ?? 0;

/** Listens for the browser's install offer and for the app being installed. Call once, early:
 * the offer arrives soon after the page loads and isn't sent twice. */
export function startInstall() {
  if (standalone()) {
    useInstall.setState({ installed: true });
    return;
  }
  try {
    if (!sessionStorage.getItem('wavee.visit')) {
      sessionStorage.setItem('wavee.visit', '1');
      const m = read();
      write({ ...m, visits: (m.visits ?? 0) + 1 });
    }
  } catch {
    // Counting visits is a nicety.
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Wavee asks in its own way, at a good moment
    useInstall.setState({ offer: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    useInstall.setState({ installed: true, offer: null, open: false });
  });
}
