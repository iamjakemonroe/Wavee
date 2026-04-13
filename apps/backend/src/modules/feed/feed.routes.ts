import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

function mapSongRowsWithArtist(data: Record<string, unknown>[]) {
  return data.map((s) => {
    const artist = s.artist as { username: string } | null;
    return {
      ...s,
      artist_name: artist?.username ?? "Unknown",
      artist: undefined,
    };
  });
}

/**
 * Logged-out home: simple discovery by engagement (no RPC / migration dependency).
 * Registered before `/home` so paths don’t clash.
 */
export async function feedRoutes(app: FastifyInstance) {
  app.get("/home/public", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const { limit, offset } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from("songs")
      .select(
        "id, user_id, title, audio_url, cover_image_url, genre, plays_count, likes_count, created_at, artist:users!user_id(username)"
      )
      .order("created_at", { ascending: false })
      .order("likes_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return fail(reply, 500, error.message);

    const rows = mapSongRowsWithArtist((data ?? []) as Record<string, unknown>[]);
    return reply.send({ ok: true, data: rows });
  });

  app.get("/home", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid query");
    }

    const { limit, offset } = parsed.data;
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin.rpc("get_home_feed", {
      input_user_id: userId,
      input_limit: limit,
      input_offset: offset,
    });

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });
}
