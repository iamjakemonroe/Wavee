import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const typeSchema = z.object({
  type: z.enum(["global", "rising", "weekly"]),
});

const mapping = {
  global: "artist_leaderboard_global",
  rising: "artist_leaderboard_rising",
  weekly: "artist_leaderboard_weekly_trending",
} as const;

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get("/:type", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = typeSchema.safeParse(request.params);
    if (!parsed.success) return fail(reply, 400, "Invalid leaderboard type");

    const viewName = mapping[parsed.data.type];
    const { data, error } = await supabaseAdmin.from(viewName).select("*").limit(100);

    if (error) return fail(reply, 500, error.message);
    return reply.send({ ok: true, data });
  });
}
