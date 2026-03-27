import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";
import { sanitizeSearchTerm } from "../../utils/searchSanitize.js";
import {
  inferAvatarMimeFromExt,
  isAllowedAvatarMime,
  normalizeAvatarMimeType,
} from "../../utils/avatarStorage.js";
import {
  deletePlaylistCoverFromBucket,
  uploadPlaylistCoverImage,
} from "../../utils/playlistCoverStorage.js";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

const patchPlaylistSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.union([z.string().max(1000), z.null()]).optional(),
    is_private: z.boolean().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.description !== undefined || d.is_private !== undefined,
    { message: "At least one field is required" }
  );

const idParamSchema = z.object({
  playlistId: z.string().uuid(),
});

const songIdParamSchema = z.object({
  songId: z.string().uuid(),
});

const playlistSongSchema = z.object({
  songId: z.string().uuid(),
});

const playlistSongMemberParamsSchema = z.object({
  playlistId: z.string().uuid(),
  songId: z.string().uuid(),
});

const maxCoverBytes = 5 * 1024 * 1024;

async function assertPlaylistOwner(playlistId: string, userId: string) {
  const { data: playlist, error } = await supabaseAdmin
    .from("playlists")
    .select("id,user_id")
    .eq("id", playlistId)
    .single();
  if (error || !playlist) {
    return { ok: false as const, status: 404 as const, message: "Playlist not found" };
  }
  if (playlist.user_id !== userId) {
    return { ok: false as const, status: 403 as const, message: "Forbidden" };
  }
  return { ok: true as const };
}

export async function playlistsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });

  app.post("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const ct = (request.headers["content-type"] ?? "").toLowerCase();
    if (ct.includes("multipart/form-data")) {
      const parts = request.parts();
      let name = "";
      let description = "";
      let isPrivate = false;
      let coverBuffer: Buffer | null = null;
      let coverMime = "";
      let coverExt = "jpg";

      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "name") name = String(part.value ?? "").trim();
          if (part.fieldname === "description") description = String(part.value ?? "").trim();
          if (part.fieldname === "is_private") isPrivate = String(part.value ?? "").toLowerCase() === "true";
          continue;
        }

        if (part.fieldname !== "cover") continue;

        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        const fileBuffer = Buffer.concat(chunks);

        if (fileBuffer.byteLength > maxCoverBytes) {
          return fail(reply, 400, "Cover image exceeds 5MB");
        }

        coverExt = part.filename.split(".").pop() ?? "jpg";
        let resolvedMime = normalizeAvatarMimeType(part.mimetype ?? "");
        if (!isAllowedAvatarMime(resolvedMime)) {
          const inferred = inferAvatarMimeFromExt(coverExt);
          resolvedMime = inferred ? normalizeAvatarMimeType(inferred) : "";
        }
        if (!isAllowedAvatarMime(resolvedMime)) {
          return fail(reply, 400, "Use a JPEG, PNG, or WebP image for the cover.");
        }
        coverBuffer = fileBuffer;
        coverMime = resolvedMime;
      }

      const nameParsed = z.string().min(1).max(100).safeParse(name);
      if (!nameParsed.success) {
        return fail(reply, 400, nameParsed.error.issues[0]?.message ?? "Playlist name is required");
      }

      const descTrim = description.slice(0, 1000);
      const { data: row, error: insErr } = await supabaseAdmin
        .from("playlists")
        .insert({
          user_id: userId,
          name: nameParsed.data,
          description: descTrim === "" ? null : descTrim,
          is_private: isPrivate,
          cover_image_url: null,
        })
        .select("*")
        .single();

      if (insErr) return fail(reply, 500, insErr.message);

      if (coverBuffer && row) {
        const up = await uploadPlaylistCoverImage(
          supabaseAdmin,
          userId,
          row.id,
          coverBuffer,
          coverMime,
          coverExt
        );
        if (!up.ok) {
          request.log.error({ err: up.error }, "Playlist cover upload failed after insert");
          return reply.send({ ok: true, data: row });
        }
        const { data: updated, error: uErr } = await supabaseAdmin
          .from("playlists")
          .update({ cover_image_url: up.publicUrl })
          .eq("id", row.id)
          .select("*")
          .single();
        if (uErr) return fail(reply, 500, uErr.message);
        return reply.send({ ok: true, data: updated });
      }

      return reply.send({ ok: true, data: row });
    }

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .insert({
        user_id: userId,
        name: parsed.data.name,
        description: null,
        cover_image_url: null,
        is_private: false,
      })
      .select("*")
      .single();

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });

  app.get("/containing/:songId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parsed = songIdParamSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid song id");

    const { data: userPlaylists, error: plErr } = await supabaseAdmin
      .from("playlists")
      .select("id")
      .eq("user_id", userId);

    if (plErr) return fail(reply, 500, plErr.message);
    const playlistIds = (userPlaylists ?? []).map((p) => p.id);

    if (playlistIds.length === 0) {
      return reply.send({ ok: true, data: [] });
    }

    const { data: matches, error: matchErr } = await supabaseAdmin
      .from("playlist_songs")
      .select("playlist_id")
      .eq("song_id", parsed.data.songId)
      .in("playlist_id", playlistIds);

    if (matchErr) return fail(reply, 500, matchErr.message);
    return reply.send({
      ok: true,
      data: (matches ?? []).map((m) => m.playlist_id),
    });
  });

  app.patch("/:playlistId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid playlist id");

    const owned = await assertPlaylistOwner(paramsParsed.data.playlistId, userId);
    if (!owned.ok) return fail(reply, owned.status, owned.message);

    const bodyParsed = patchPlaylistSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return fail(reply, 400, bodyParsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const updates: Record<string, unknown> = {};
    if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
    if (bodyParsed.data.description !== undefined) {
      updates.description =
        bodyParsed.data.description === null || bodyParsed.data.description === ""
          ? null
          : bodyParsed.data.description;
    }
    if (bodyParsed.data.is_private !== undefined) updates.is_private = bodyParsed.data.is_private;

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .update(updates)
      .eq("id", paramsParsed.data.playlistId)
      .select("*")
      .single();

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });

  app.delete("/:playlistId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid playlist id");

    const owned = await assertPlaylistOwner(paramsParsed.data.playlistId, userId);
    if (!owned.ok) return fail(reply, owned.status, owned.message);

    const playlistId = paramsParsed.data.playlistId;
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("playlists")
      .select("cover_image_url")
      .eq("id", playlistId)
      .single();

    if (fetchErr) return fail(reply, 500, fetchErr.message);

    const removed = await deletePlaylistCoverFromBucket(
      supabaseAdmin,
      userId,
      playlistId,
      row?.cover_image_url
    );
    if (!removed.ok) {
      request.log.warn({ err: removed.error }, "Playlist cover delete from storage failed");
    }

    const { error } = await supabaseAdmin.from("playlists").delete().eq("id", playlistId);
    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true });
  });

  app.post("/:playlistId/cover", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid playlist id");

    const owned = await assertPlaylistOwner(paramsParsed.data.playlistId, userId);
    if (!owned.ok) return fail(reply, owned.status, owned.message);

    const playlistId = paramsParsed.data.playlistId;

    const parts = request.parts();
    let fileBuffer: Buffer | null = null;
    let mime = "";
    let ext = "jpg";

    for await (const part of parts) {
      if (part.type === "field") continue;
      if (part.fieldname !== "cover") continue;

      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk as Buffer);
      const buf = Buffer.concat(chunks);

      if (buf.byteLength > maxCoverBytes) {
        return fail(reply, 400, "Image must be 5MB or smaller.");
      }
      ext = part.filename.split(".").pop() ?? "jpg";
      let resolvedMime = normalizeAvatarMimeType(part.mimetype?.trim() ?? "");
      if (!isAllowedAvatarMime(resolvedMime)) {
        const inferred = inferAvatarMimeFromExt(ext);
        resolvedMime = inferred ? normalizeAvatarMimeType(inferred) : "";
      }
      if (!isAllowedAvatarMime(resolvedMime)) {
        return fail(reply, 400, "Use a JPEG, PNG, or WebP image.");
      }
      fileBuffer = buf;
      mime = resolvedMime;
      break;
    }

    if (!fileBuffer) return fail(reply, 400, "Cover image is required");

    const up = await uploadPlaylistCoverImage(supabaseAdmin, userId, playlistId, fileBuffer, mime, ext);
    if (!up.ok) {
      request.log.error({ err: up.error }, "Playlist cover upload failed");
      let message = "We couldn't upload your cover. Try again later.";
      if (up.bucketMissing) {
        message = `Create storage bucket "${env.STORAGE_BUCKET_PLAYLIST_COVERS}" (see migration 0008).`;
      }
      return fail(reply, 500, message);
    }

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .update({ cover_image_url: up.publicUrl })
      .eq("id", playlistId)
      .select("*")
      .single();

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });

  const playlistSongSearchQuerySchema = z.object({
    q: z.string().min(1).max(120),
  });

  app.get("/:playlistId/songs/search", { preHandler: [requireAuth] }, async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid playlist id");

    const queryParsed = playlistSongSearchQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return fail(reply, 400, queryParsed.error.issues[0]?.message ?? "Invalid search query");
    }

    const { playlistId } = paramsParsed.data;
    const term = sanitizeSearchTerm(queryParsed.data.q);
    if (term.length < 1) {
      return reply.send({ ok: true, data: [] });
    }

    const { error: playlistLookupError } = await supabaseAdmin
      .from("playlists")
      .select("id")
      .eq("id", playlistId)
      .single();

    if (playlistLookupError) return fail(reply, 404, "Playlist not found");

    const { data: playlistSongs, error: psError } = await supabaseAdmin
      .from("playlist_songs")
      .select("song_id")
      .eq("playlist_id", playlistId)
      .order("created_at", { ascending: false });

    if (psError) return fail(reply, 500, psError.message);

    const songIds = (playlistSongs ?? []).map((ps) => ps.song_id);
    if (songIds.length === 0) {
      return reply.send({ ok: true, data: [] });
    }

    const { data: songs, error: songsError } = await supabaseAdmin
      .from("songs")
      .select("*, artist:users!user_id(username)")
      .in("id", songIds);

    if (songsError) return fail(reply, 500, songsError.message);

    const lower = term.toLowerCase();
    const idOrder = new Map(songIds.map((id, index) => [id, index]));

    const mapped: Record<string, unknown>[] = (songs ?? []).map((s: Record<string, unknown>) => {
      const artist = s.artist as { username: string } | null;
      return {
        ...s,
        artist_name: artist?.username ?? "Unknown",
        artist: undefined,
      };
    });

    const filtered = mapped.filter((s) => {
      const title = String(s.title ?? "").toLowerCase();
      const genre = String(s.genre ?? "").toLowerCase();
      const artistName = String(s.artist_name ?? "").toLowerCase();
      return (
        title.includes(lower) || genre.includes(lower) || artistName.includes(lower)
      );
    });

    filtered.sort(
      (a, b) =>
        (idOrder.get(String(a.id)) ?? 0) - (idOrder.get(String(b.id)) ?? 0),
    );

    const limit = 80;
    return reply.send({ ok: true, data: filtered.slice(0, limit) });
  });

  app.get("/:playlistId/songs", { preHandler: [requireAuth] }, async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid playlist id");

    const { playlistId } = paramsParsed.data;

    const { data: playlist, error: playlistError } = await supabaseAdmin
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (playlistError) return fail(reply, 404, "Playlist not found");

    const { data: playlistSongs, error: psError } = await supabaseAdmin
      .from("playlist_songs")
      .select("song_id")
      .eq("playlist_id", playlistId)
      .order("created_at", { ascending: false });

    if (psError) return fail(reply, 500, psError.message);

    const songIds = (playlistSongs ?? []).map((ps) => ps.song_id);

    if (songIds.length === 0) {
      return reply.send({ ok: true, data: { playlist, songs: [] } });
    }

    const { data: songs, error: songsError } = await supabaseAdmin
      .from("songs")
      .select("*, artist:users!user_id(username)")
      .in("id", songIds);

    if (songsError) return fail(reply, 500, songsError.message);

    const mapped = (songs ?? []).map((s: Record<string, unknown>) => {
      const artist = s.artist as { username: string } | null;
      return {
        ...s,
        artist_name: artist?.username ?? "Unknown",
        artist: undefined,
      };
    });

    return reply.send({ ok: true, data: { playlist, songs: mapped } });
  });

  app.post("/:playlistId/songs", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const paramsParsed = idParamSchema.safeParse(request.params);
    const bodyParsed = playlistSongSchema.safeParse(request.body);
    if (!paramsParsed.success || !bodyParsed.success) return fail(reply, 400, "Invalid payload");

    const { data: playlist, error: playlistError } = await supabaseAdmin
      .from("playlists")
      .select("id,user_id")
      .eq("id", paramsParsed.data.playlistId)
      .single();
    if (playlistError) return fail(reply, 404, playlistError.message);
    if (playlist.user_id !== userId) return fail(reply, 403, "Forbidden");

    const { error } = await supabaseAdmin.from("playlist_songs").insert({
      playlist_id: paramsParsed.data.playlistId,
      song_id: bodyParsed.data.songId,
    });
    if (error) return fail(reply, 500, error.message);

    return reply.send({ ok: true });
  });

  app.delete("/:playlistId/songs/:songId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parsed = playlistSongMemberParamsSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid playlist or song id");

    const owned = await assertPlaylistOwner(parsed.data.playlistId, userId);
    if (!owned.ok) return fail(reply, owned.status, owned.message);

    const { error } = await supabaseAdmin
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", parsed.data.playlistId)
      .eq("song_id", parsed.data.songId);

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true });
  });
}
