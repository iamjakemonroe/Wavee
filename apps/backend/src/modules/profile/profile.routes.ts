import { FastifyInstance } from "fastify";
import { z } from "zod";
import { musicRolesArraySchema } from "../../constants/musicRoles.js";
import { env } from "../../config/env.js";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";
import { mapProfileUpdateError } from "../../utils/profileErrors.js";
import {
  inferAvatarMimeFromExt,
  isAllowedAvatarMime,
  normalizeAvatarMimeType,
  uploadUserAvatar,
} from "../../utils/avatarStorage.js";
import { sanitizeSearchTerm } from "../../utils/searchSanitize.js";

const followSchema = z.object({
  artistId: z.string().uuid(),
});

const patchProfileSchema = z
  .object({
    username: z.string().min(3).max(24).optional(),
    bio: z.union([z.string().max(500), z.null()]).optional(),
    music_roles: musicRolesArraySchema.optional(),
  })
  .refine(
    (o) =>
      o.username !== undefined ||
      o.bio !== undefined ||
      o.music_roles !== undefined,
    { message: "At least one field is required" }
  );

const maxAvatarBytes = 5 * 1024 * 1024;

const profileSearchQuerySchema = z.object({
  q: z.string().min(1).max(120),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/search", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = profileSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const term = sanitizeSearchTerm(parsed.data.q);
    if (term.length < 1) {
      return reply.send({ ok: true, data: [] });
    }

    const pattern = `%${term}%`;
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, username, avatar_url, music_roles, is_artist")
      .ilike("username", pattern)
      .order("username", { ascending: true })
      .limit(24);

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data: data ?? [] });
  });

  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", request.userId)
      .single();

    if (error) return fail(reply, 404, "We couldn't load your profile.");
    return reply.send({ ok: true, data });
  });

  app.patch("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parsed = patchProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { username, bio, music_roles } = parsed.data;
    const updates: Record<string, unknown> = {};

    if (username !== undefined) updates.username = username;
    if (bio !== undefined) updates.bio = bio === "" ? null : bio;
    if (music_roles !== undefined) {
      updates.music_roles = music_roles;
      updates.is_artist = music_roles.includes("artist");
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      request.log.warn(
        { route: "profile.patch", user_id: userId, supabase_error: error },
        "Profile update failed"
      );
      return fail(reply, 400, mapProfileUpdateError(error.message, error.code));
    }

    return reply.send({ ok: true, data });
  });

  app.post("/avatar", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parts = request.parts();
    let fileBuffer: Buffer | null = null;
    let mime = "";
    let ext = "jpg";

    for await (const part of parts) {
      if (part.type === "field") continue;
      if (part.fieldname !== "avatar") continue;

      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk as Buffer);
      const buf = Buffer.concat(chunks);

      if (buf.byteLength > maxAvatarBytes) {
        return fail(reply, 400, "Image must be 5MB or smaller.");
      }
      ext = part.filename.split(".").pop() ?? "jpg";
      let resolvedMime = normalizeAvatarMimeType(part.mimetype?.trim() ?? "");
      if (!isAllowedAvatarMime(resolvedMime)) {
        resolvedMime = inferAvatarMimeFromExt(ext) ?? "";
      }
      if (!isAllowedAvatarMime(resolvedMime)) {
        return fail(reply, 400, "Use a JPEG, PNG, or WebP image.");
      }
      fileBuffer = buf;
      mime = resolvedMime;
      break;
    }

    if (!fileBuffer) return fail(reply, 400, "Image file is required");

    const uploadResult = await uploadUserAvatar(
      supabaseAdmin,
      userId,
      fileBuffer,
      mime,
      ext
    );

    if (!uploadResult.ok) {
      request.log.error(
        {
          route: "profile.avatar",
          user_id: userId,
          err: uploadResult.error,
        },
        "Avatar storage upload failed"
      );
      let message = "We couldn't upload your photo. Try again later.";
      if (uploadResult.bucketMissing) {
        message = `Avatar storage is not set up yet. In Supabase → Storage, create a public bucket named "${env.STORAGE_BUCKET_AVATARS}" (same as STORAGE_BUCKET_AVATARS in your API env).`;
      } else if (env.NODE_ENV !== "production") {
        message += ` (${uploadResult.error.message})`;
      }
      return fail(reply, uploadResult.bucketMissing ? 503 : 500, message);
    }

    const publicUrl = uploadResult.publicUrl;

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", userId)
      .select("avatar_url")
      .single();

    if (error) {
      request.log.error(
        { route: "profile.avatar", user_id: userId, supabase_error: error },
        "Avatar URL update failed"
      );
      return fail(reply, 500, "We couldn't save your photo. Try again later.");
    }

    return reply.send({ ok: true, data: { avatar_url: data.avatar_url } });
  });

  app.post("/follow", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.userId) return fail(reply, 401, "Not authenticated");

    const parsed = followSchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    if (parsed.data.artistId === request.userId) return fail(reply, 400, "Cannot follow yourself");

    const { error } = await supabaseAdmin.from("follows").insert({
      follower_id: request.userId,
      following_id: parsed.data.artistId,
    });
    if (error) return fail(reply, 500, error.message);

    return reply.send({ ok: true });
  });

  const userIdParamSchema = z.object({
    userId: z.string().uuid(),
  });

  const userSongSearchQuerySchema = z.object({
    q: z.string().min(1).max(120),
  });

  app.get(
    "/:userId/songs/search",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const paramsParsed = userIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return fail(reply, 400, "Invalid user id");

      const queryParsed = userSongSearchQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return fail(reply, 400, queryParsed.error.issues[0]?.message ?? "Invalid search query");
      }

      const { userId } = paramsParsed.data;
      const term = sanitizeSearchTerm(queryParsed.data.q);
      if (term.length < 1) {
        return reply.send({ ok: true, data: [] });
      }

      const { data: userRow, error: userErr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userErr || !userRow) return fail(reply, 404, "User not found");

      const { data: songs, error: songsError } = await supabaseAdmin
        .from("songs")
        .select("*, artist:users!user_id(username)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (songsError) return fail(reply, 500, songsError.message);

      const lower = term.toLowerCase();
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

      const limit = 80;
      return reply.send({ ok: true, data: filtered.slice(0, limit) });
    },
  );

  app.get("/:userId/songs", { preHandler: [requireAuth] }, async (request, reply) => {
    const paramsParsed = userIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return fail(reply, 400, "Invalid user id");

    const { userId } = paramsParsed.data;

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, username, avatar_url, bio, music_roles, is_artist, created_at")
      .eq("id", userId)
      .single();

    if (userError || !user) return fail(reply, 404, "User not found");

    const { data: songs, error: songsError } = await supabaseAdmin
      .from("songs")
      .select("*, artist:users!user_id(username)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (songsError) return fail(reply, 500, songsError.message);

    const mapped = (songs ?? []).map((s: Record<string, unknown>) => {
      const artist = s.artist as { username: string } | null;
      return {
        ...s,
        artist_name: artist?.username ?? "Unknown",
        artist: undefined,
      };
    });

    return reply.send({ ok: true, data: { user, songs: mapped } });
  });
}
