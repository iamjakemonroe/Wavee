/** Where a play started, for the artist's stats ("where your plays come from"). The feed's
 * Boosts and first listens are marked by the player itself. */
export type Origin = 'feed' | 'home' | 'search' | 'profile' | 'playlist' | 'charts' | 'picks' | 'library' | 'song' | 'link' | 'other';

interface Landing {
  path: string;
  /** Arrived from outside Wavee: a link shared in WhatsApp, Instagram… */
  outside: boolean;
}

let landing: Landing | null = null;

/** Remembers the first page of this visit, and whether someone followed a link to it. */
export function rememberLanding() {
  try {
    const saved = sessionStorage.getItem('wavee.landing');
    if (saved) {
      landing = JSON.parse(saved) as Landing;
      return;
    }
  } catch {
    // Private mode: decided afresh below.
  }
  let outside = true;
  try {
    outside = !document.referrer || new URL(document.referrer).origin !== window.location.origin;
  } catch {
    // An odd referrer: counts as outside.
  }
  landing = { path: window.location.pathname, outside };
  try {
    sessionStorage.setItem('wavee.landing', JSON.stringify(landing));
  } catch {
    // Kept in memory for this page.
  }
}

const PAGES: Record<string, Origin> = {
  feed: 'feed',
  search: 'search',
  u: 'profile',
  playlists: 'playlist',
  charts: 'charts',
  picks: 'picks',
  library: 'library',
  songs: 'song',
};

/** The page someone pressed play on. A song, artist or playlist opened from a shared link counts
 * as the link. */
export function originHere(): Origin {
  const path = window.location.pathname;
  if (landing?.outside && path === landing.path && /^\/(songs|u|playlists)\//.test(path)) return 'link';
  if (path === '/') return 'home';
  return PAGES[path.split('/')[1]] ?? 'other';
}
