/** MIME types the API accepts (see backend songs upload). */
export const AUDIO_ACCEPT_ATTR =
  "audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav,audio/mp3";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

const ALLOWED_EXT = /\.(mp3|wav)$/i;

export function isAllowedAudioFile(file: File): boolean {
  const t = file.type?.toLowerCase() ?? "";
  if (t && ALLOWED_MIME.has(t)) return true;
  return ALLOWED_EXT.test(file.name);
}
