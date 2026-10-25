import { api, type FeedbackTag } from './api';

/** What a listener can tell an artist, in the order the sheet shows it. */
export const FEEDBACK: { tag: FeedbackTag; label: string; good: boolean }[] = [
  { tag: 'replay', label: 'I’d play it again', good: true },
  { tag: 'hook', label: 'The hook stuck', good: true },
  { tag: 'vocals', label: 'Great voice', good: true },
  { tag: 'beat', label: 'The beat hits', good: true },
  { tag: 'lyrics', label: 'The lyrics land', good: true },
  { tag: 'vibe', label: 'The vibe is right', good: true },
  { tag: 'share', label: 'I’d share it', good: true },
  { tag: 'mix', label: 'The mix needs work', good: false },
  { tag: 'intro', label: 'Slow to get going', good: false },
  { tag: 'long', label: 'A bit long', good: false },
];

export const feedbackLabel = (tag: FeedbackTag) => FEEDBACK.find((f) => f.tag === tag)?.label ?? tag;

/** "Week of 26 October", for a Monday from the database. */
export const weekLabel = (week: string) =>
  `Week of ${new Date(`${week}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

/** The Monday (UTC) that starts this week, or [weeks] after it, as the database writes it. */
export function thisMonday(weeks = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7 * weeks);
  return d.toISOString().slice(0, 10);
}

/** A link that tells Wavee you sent them. */
export const inviteLink = (username: string, path = '/founding') =>
  `${window.location.origin}${path}?ref=${encodeURIComponent(username)}`;

const REF = 'wavee.ref';

interface Saved {
  ref?: string;
  at?: number;
}

/** Remembers who sent this visitor (?ref=username on any page) until they have an account. */
export function rememberReferrer() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[a-z0-9_.]{3,30}$/i.test(ref)) {
      localStorage.setItem(REF, JSON.stringify({ ref: ref.toLowerCase(), at: Date.now() }));
    }
  } catch {
    // Private mode: nobody gets the credit, nothing breaks.
  }
}

/** Once signed in, tells Wavee who sent you. It's asked once; the database only keeps it for an
 * account made in the last two weeks. */
export async function claimReferrer(username: string) {
  let saved: Saved | null;
  try {
    saved = JSON.parse(localStorage.getItem(REF) ?? 'null') as Saved | null;
    localStorage.removeItem(REF);
  } catch {
    return;
  }
  if (!saved?.ref || saved.ref === username.toLowerCase()) return;
  if (Date.now() - (saved.at ?? 0) > 30 * 86_400_000) return;
  await api.claimReferral(saved.ref).catch(() => undefined);
}
