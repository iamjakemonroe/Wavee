import { z } from "zod";

export const MUSIC_ROLE_VALUES = [
  "artist",
  "songwriter",
  "producer",
  "audio_engineer",
  "manager",
] as const;

export type MusicRole = (typeof MUSIC_ROLE_VALUES)[number];

const roleEnum = z.enum(MUSIC_ROLE_VALUES);

/** Accepts JSON array; dedupes and drops unknowns (zod enum filters). */
export const musicRolesArraySchema = z
  .array(roleEnum)
  .max(16)
  .transform((arr) => Array.from(new Set(arr)) as MusicRole[]);
