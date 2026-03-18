import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function feedRoutes(app: FastifyInstance) {
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
