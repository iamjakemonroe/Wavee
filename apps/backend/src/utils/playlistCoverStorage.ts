import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import {
  inferAvatarMimeFromExt,
  isAllowedAvatarMime,
  isLikelyMissingStorageBucket,
  normalizeAvatarMimeType,
} from "./avatarStorage.js";

type UploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: { message: string }; bucketMissing: boolean };

/**
 * Playlist cover images in {@link env.STORAGE_BUCKET_PLAYLIST_COVERS}.
 * Create bucket via migration 0008_storage_playlist_covers_bucket.sql.
 */
export async function uploadPlaylistCoverImage(
  client: SupabaseClient,
  userId: string,
  playlistId: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<UploadResult> {
  let mime = normalizeAvatarMimeType(contentType);
  if (!isAllowedAvatarMime(mime)) {
    const fromExt = inferAvatarMimeFromExt(ext);
    mime = fromExt ? normalizeAvatarMimeType(fromExt) : mime;
  }
  if (!isAllowedAvatarMime(mime)) {
    return { ok: false, error: { message: "Unsupported image type" }, bucketMissing: false };
  }

  const bucket = env.STORAGE_BUCKET_PLAYLIST_COVERS;
  const objectPath = `${userId}/${playlistId}/${Date.now()}-${randomUUID()}.${ext}`;

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
 * Parse a public playlist-cover URL into the storage object path for our bucket.
 * Supabase path shape: /storage/v1/object/public/{bucket}/{userId}/{playlistId}/...
 */
function extractPlaylistCoverObjectPath(url: string, bucket: string): string | null {
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

type DeleteCoverResult = { ok: true } | { ok: false; error: { message: string } };

/**
 * Remove the playlist cover object from the playlist-covers bucket when deleting a playlist.
 * No-ops if there is no URL, URL is not our bucket, or path does not match userId/playlistId/.
 */
export async function deletePlaylistCoverFromBucket(
  client: SupabaseClient,
  userId: string,
  playlistId: string,
  coverImageUrl: string | null | undefined
): Promise<DeleteCoverResult> {
  if (!coverImageUrl?.trim()) return { ok: true };

  const bucket = env.STORAGE_BUCKET_PLAYLIST_COVERS;
  const objectPath = extractPlaylistCoverObjectPath(coverImageUrl, bucket);
  if (!objectPath) return { ok: true };

  const prefix = `${userId}/${playlistId}/`;
  if (!objectPath.startsWith(prefix)) return { ok: true };

  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) {
    return { ok: false, error: { message: error.message } };
  }
  return { ok: true };
}
