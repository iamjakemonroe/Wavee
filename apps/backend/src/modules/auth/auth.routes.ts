import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin, supabaseAnon } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(24).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { email, password, username } = parsed.data;
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username ?? email.split("@")[0],
        },
      },
    });
    if (error || !data.user) {
      return fail(reply, 400, error?.message ?? "Signup failed");
    }

    const profileUsername = username ?? email.split("@")[0];
    const { error: profileError } = await supabaseAdmin.from("users").upsert(
      {
        id: data.user.id,
        email,
        username: profileUsername,
        avatar_url: null,
        bio: null,
        is_artist: false,
      },
      { onConflict: "id" }
    );
    if (profileError) return fail(reply, 500, profileError.message);

    return reply.send({
      ok: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  });

  app.post("/signin", async (request, reply) => {
    const parsed = credentialsSchema.omit({ username: true }).safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { email, password } = parsed.data;
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return fail(reply, 401, error?.message ?? "Invalid credentials");
    }

    return reply.send({
      ok: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  });

  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", userId).single();
    if (error) return fail(reply, 404, error.message);

    return reply.send({
      ok: true,
      data,
    });
  });
}
