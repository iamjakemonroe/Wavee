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

const songIdParamSchema = z.object({
  songId: z.string().uuid(),
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
}
