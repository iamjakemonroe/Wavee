import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const paramsSchema = z.object({
  songId: z.string().uuid(),
});

const playBodySchema = z.object({
  songId: z.string().uuid(),
  durationListened: z.number().nonnegative(),
  songDuration: z.number().positive(),
  skipped: z.boolean().default(false),
  replayed: z.boolean().default(false),
});

export async function engagementRoutes(app: FastifyInstance) {
  app.post("/likes/:songId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid song id");

    const { error } = await supabaseAdmin.from("likes").insert({
      user_id: userId,
      song_id: parsed.data.songId,
    });

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true });
  });

  app.delete("/likes/:songId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid song id");

    const { error } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("user_id", userId)
      .eq("song_id", parsed.data.songId);

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true });
  });

  app.post("/plays", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = playBodySchema.safeParse(request.body);
    if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid body");

    const body = parsed.data;
    const { error } = await supabaseAdmin.from("plays").insert({
      user_id: request.userId ?? null,
      song_id: body.songId,
      duration_listened: body.durationListened,
      song_duration: body.songDuration,
      skipped: body.skipped,
      replayed: body.replayed,
    });

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true });
  });
}
