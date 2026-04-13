import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";
import { sanitizeSearchTerm } from "../../utils/searchSanitize.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(120),
});

const uploadBodySchema = z.object({
  title: z.string().min(1).max(140),
  genre: z.string().min(1).max(64),
});

const allowedAudioMimeTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
]);
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAudioBytes = 20 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;

export async function songsRoutes(app: FastifyInstance) {
  /** Direct table search (no DB RPC). Works for anonymous + authenticated clients. */
  app.get("/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const term = sanitizeSearchTerm(parsed.data.q);
    if (term.length < 1) {
      return reply.send({ ok: true, data: [] });
    }

    const pattern = `%${term}%`;
    const { data, error } = await supabaseAdmin
      .from("songs")
      .select("*, artist:users!user_id(username)")
      .or(`title.ilike.${pattern},genre.ilike.${pattern}`)
      .order("likes_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return fail(reply, 500, error.message);

    const songs = (data ?? []).map((s: Record<string, unknown>) => {
      const artist = s.artist as { username: string } | null;
      return {
        ...s,
        artist_name: artist?.username ?? "Unknown",
        artist: undefined,
      };
    });

    return reply.send({ ok: true, data: songs });
  });

  app.post("/upload", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const rateLimitProbe = await supabaseAdmin
      .from("songs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);
    if (rateLimitProbe.error) return fail(reply, 500, rateLimitProbe.error.message);
    if ((rateLimitProbe.count ?? 0) >= 5) {
      return fail(reply, 429, "Upload rate limit exceeded. Please try again shortly.");
    }

    const parts = request.parts();
    let audioBuffer: Buffer | null = null;
    let audioMime = "";
    let audioExt = "mp3";
    let coverBuffer: Buffer | null = null;
    let coverMime = "";
    let coverExt = "jpg";
    let title = "";
    let genre = "";

    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "title") title = String(part.value ?? "");
        if (part.fieldname === "genre") genre = String(part.value ?? "");
        continue;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk as Buffer);
      const fileBuffer = Buffer.concat(chunks);

      if (part.fieldname === "audio") {
        if (!allowedAudioMimeTypes.has(part.mimetype)) {
          return fail(reply, 400, "Unsupported audio format");
        }
        if (fileBuffer.byteLength > maxAudioBytes) {
          return fail(reply, 400, "Audio file exceeds 20MB");
        }
        audioBuffer = fileBuffer;
        audioMime = part.mimetype;
        audioExt = part.filename.split(".").pop() ?? "mp3";
      }

      if (part.fieldname === "cover") {
        if (!allowedImageMimeTypes.has(part.mimetype)) {
          return fail(reply, 400, "Unsupported cover image format");
        }
        if (fileBuffer.byteLength > maxImageBytes) {
          return fail(reply, 400, "Cover image exceeds 5MB");
        }
        coverBuffer = fileBuffer;
        coverMime = part.mimetype;
        coverExt = part.filename.split(".").pop() ?? "jpg";
      }
    }

    const payloadParsed = uploadBodySchema.safeParse({ title, genre });
    if (!payloadParsed.success) {
      return fail(reply, 400, payloadParsed.error.issues[0]?.message ?? "Invalid song payload");
    }
    if (!audioBuffer) return fail(reply, 400, "Audio file is required");

    const audioPath = `${userId}/${Date.now()}-${randomUUID()}.${audioExt}`;
    const audioUpload = await supabaseAdmin.storage
      .from(env.STORAGE_BUCKET_SONGS)
      .upload(audioPath, audioBuffer, {
        contentType: audioMime,
        upsert: false,
      });
    if (audioUpload.error) return fail(reply, 500, audioUpload.error.message);

    const audioUrl = supabaseAdmin.storage
      .from(env.STORAGE_BUCKET_SONGS)
      .getPublicUrl(audioPath).data.publicUrl;

    let coverUrl: string | null = null;
    if (coverBuffer) {
      const coverPath = `${userId}/${Date.now()}-${randomUUID()}.${coverExt}`;
      const coverUpload = await supabaseAdmin.storage
        .from(env.STORAGE_BUCKET_COVERS)
        .upload(coverPath, coverBuffer, {
          contentType: coverMime || "image/jpeg",
          upsert: false,
        });
      if (coverUpload.error) return fail(reply, 500, coverUpload.error.message);
      coverUrl = supabaseAdmin.storage.from(env.STORAGE_BUCKET_COVERS).getPublicUrl(coverPath).data
        .publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from("songs")
      .insert({
        user_id: userId,
        title: payloadParsed.data.title,
        genre: payloadParsed.data.genre,
        audio_url: audioUrl,
        cover_image_url: coverUrl,
      })
      .select("*")
      .single();

    if (error) return fail(reply, 500, error.message);

    return reply.send({
      ok: true,
      data,
      ai: {
        genre_detection: "pending",
      },
    });
  });

  const songIdParamSchema = z.object({
    songId: z.string().uuid(),
  });

  /** Public read for share links (no auth). */
  app.get("/:songId", async (request, reply) => {
    const parsed = songIdParamSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid song id");

    const { data, error } = await supabaseAdmin
      .from("songs")
      .select("*, artist:users!user_id(username)")
      .eq("id", parsed.data.songId)
      .single();

    if (error || !data) return fail(reply, 404, "Song not found");

    const row = data as Record<string, unknown>;
    const artist = row.artist as { username: string } | null;
    return reply.send({
      ok: true,
      data: {
        ...row,
        artist_name: artist?.username ?? "Unknown",
        artist: undefined,
      },
    });
  });
}
