export type MusicRole =
  | "artist"
  | "songwriter"
  | "producer"
  | "audio_engineer"
  | "manager";

export const MUSIC_ROLES: { value: MusicRole; label: string }[] = [
  { value: "artist", label: "Artist" },
  { value: "songwriter", label: "Songwriter" },
  { value: "producer", label: "Producer" },
  { value: "audio_engineer", label: "Audio engineer" },
  { value: "manager", label: "Manager" },
];

const allowedRoleSet = new Set(MUSIC_ROLES.map((r) => r.value));

/** Coerce API data into known role values (ignores unknown entries). */
export function normalizeMusicRoles(raw: unknown): MusicRole[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is MusicRole => typeof x === "string" && allowedRoleSet.has(x as MusicRole),
  );
}

export function formatMusicRoles(
  roles: MusicRole[] | null | undefined,
): string | null {
  if (!roles?.length) return null;
  return roles
    .map((r) => MUSIC_ROLES.find((x) => x.value === r)?.label ?? r)
    .join(", ");
}
