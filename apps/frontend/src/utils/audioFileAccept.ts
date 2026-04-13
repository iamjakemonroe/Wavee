/** MIME types the API accepts (see backend songs upload). */
export const AUDIO_ACCEPT_ATTR =
  "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a,audio/mp3";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
]);

const ALLOWED_EXT = /\.(mp3|wav|m4a)$/i;

export function isAllowedAudioFile(file: File): boolean {
  const t = file.type?.toLowerCase() ?? "";
  if (t && ALLOWED_MIME.has(t)) return true;
  return ALLOWED_EXT.test(file.name);
}
