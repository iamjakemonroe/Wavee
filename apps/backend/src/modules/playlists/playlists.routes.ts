import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

const idParamSchema = z.object({
  playlistId: z.string().uuid(),
});

const playlistSongSchema = z.object({
  songId: z.string().uuid(),
});

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

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .insert({ user_id: userId, name: parsed.data.name })
      .select("*")
      .single();

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
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
}
