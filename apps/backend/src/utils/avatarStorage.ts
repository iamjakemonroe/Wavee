import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function normalizeAvatarMimeType(mimetype: string): string {
  const m = mimetype.trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

export function inferAvatarMimeFromExt(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

export function isAllowedAvatarMime(mimetype: string): boolean {
  return ALLOWED.has(normalizeAvatarMimeType(mimetype));
}

export function isLikelyMissingStorageBucket(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return (
    m.includes("bucket") ||
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("no such bucket")
  );
}

type UploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: { message: string }; bucketMissing: boolean };

/**
 * Uploads profile images only to {@link env.STORAGE_BUCKET_AVATARS}.
 * Create that bucket in Supabase Storage (public read recommended for URLs).
 */
export async function uploadUserAvatar(
  client: SupabaseClient,
  userId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<UploadResult> {
  let mime = normalizeAvatarMimeType(contentType);
  if (!mime) mime = inferAvatarMimeFromExt(ext) ?? "image/jpeg";

  const bucket = env.STORAGE_BUCKET_AVATARS;
  const objectPath = `${userId}/${Date.now()}-${randomUUID()}.${ext}`;

  const result = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType: mime,
    upsert: true,
  });

  if (result.error) {
    return {
      ok: false,
      error: result.error,
      bucketMissing: isLikelyMissingStorageBucket(result.error),
    };
  }

  const publicUrl = client.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
  return { ok: true, publicUrl };
}

/**
 * Parse a public avatar URL into the storage object path for our bucket.
 * Shape: .../object/public/{bucket}/{userId}/...
 */
function extractAvatarObjectPath(url: string, bucket: string): string | null {
  try {
    const u = new URL(url.trim());
    const marker = `/object/public/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/**
 * Deletes a user's previous avatar object after a successful new upload.
 * No-ops if there is no URL, it is not in our bucket, or the path is not under {@link userId}/.
 */
export async function removePreviousAvatarFromBucket(
  client: SupabaseClient,
  userId: string,
  previousPublicUrl: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  if (!previousPublicUrl?.trim()) return { ok: true };

  const bucket = env.STORAGE_BUCKET_AVATARS;
  const objectPath = extractAvatarObjectPath(previousPublicUrl, bucket);
  if (!objectPath) return { ok: true };

  const prefix = `${userId}/`;
  if (!objectPath.startsWith(prefix)) return { ok: true };

  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) {
    return { ok: false, error: { message: error.message } };
  }
  return { ok: true };
}
