import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const followSchema = z.object({
  artistId: z.string().uuid(),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", request.userId)
      .single();

    if (error) return fail(reply, 404, error.message);
    return reply.send({ ok: true, data });
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
}
