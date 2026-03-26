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
