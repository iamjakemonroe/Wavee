/** 3:07, or 1:02:45. */
export function duration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** 950, 12.4K, 3.1M. */
export function count(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** "3 days ago", "just now". */
export function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export const artistName = (s: { artist_display_name: string | null; artist_username: string }) =>
  s.artist_display_name || s.artist_username;

/** Everyone credited on a song, the uploader first: "Wavee, Jake, Drake". */
export const artistNames = (s: {
  artist_display_name: string | null;
  artist_username: string;
  features?: { username: string; display_name: string | null }[];
}) => [artistName(s), ...(s.features ?? []).map((f) => f.display_name || f.username)].join(', ');

/** Music roles: the keys the database keeps, and how they read. */
export const ROLES = [
  ['singer', 'Singer'],
  ['rapper', 'Rapper'],
  ['producer', 'Producer'],
  ['songwriter', 'Songwriter'],
  ['dj', 'DJ'],
  ['instrumentalist', 'Instrumentalist'],
  ['engineer', 'Engineer'],
  ['manager', 'Manager'],
] as const;
export const roleLabel = (key: string) => ROLES.find(([k]) => k === key)?.[1] ?? key;

export const GENRES = [
  'Afrobeats',
  'Amapiano',
  'Hip-Hop',
  'R&B',
  'Pop',
  'Gospel',
  'Highlife',
  'Fuji',
  'Dancehall',
  'Reggae',
  'Electronic',
  'House',
  'Rock',
  'Jazz',
  'Soul',
  'Alté',
  'Drill',
  'Lo-fi',
  'Classical',
  'Instrumental',
  'Other',
] as const;
