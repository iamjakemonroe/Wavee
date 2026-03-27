import { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin, supabaseAnon } from "../../config/supabase.js";
import { requireAuth } from "../../plugins/auth.js";
import { fail } from "../../utils/http.js";
import { env } from "../../config/env.js";
import {
  mapProfileUpsertError,
  mapSupabaseAuthErrorMessage,
} from "../../utils/authErrors.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(24).optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        {
          route: "auth.signup",
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
        "Signup validation failed"
      );
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
        emailRedirectTo: `${env.FRONTEND_URL}/auth/callback`,
      },
    });
    if (error || !data.user) {
      request.log.warn(
        {
          route: "auth.signup",
          email: maskEmail(email),
          supabase_error: error,
        },
        "Signup failed at Supabase Auth"
      );
      return fail(
        reply,
        400,
        mapSupabaseAuthErrorMessage(error?.message, "signup")
      );
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
    if (profileError) {
      request.log.error(
        {
          route: "auth.signup",
          email: maskEmail(email),
          user_id: data.user.id,
          supabase_error: profileError,
        },
        "Profile upsert failed after signup"
      );
      return fail(
        reply,
        409,
        mapProfileUpsertError(profileError.message, profileError.code)
      );
    }

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
      request.log.warn(
        {
          route: "auth.signin",
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
        "Signin validation failed"
      );
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { email, password } = parsed.data;
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      request.log.warn(
        {
          route: "auth.signin",
          email: maskEmail(email),
          supabase_error: error,
        },
        "Signin failed at Supabase Auth"
      );
      return fail(
        reply,
        401,
        mapSupabaseAuthErrorMessage(error?.message, "signin")
      );
    }

    return reply.send({
      ok: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  });

  app.post("/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 400, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: parsed.data.refresh_token,
    });

    if (error || !data.session) {
      request.log.warn({ route: "auth.refresh", reason: "refresh_failed" }, "Session refresh failed");
      return fail(reply, 401, "Session expired. Please sign in again.");
    }

    return reply.send({
      ok: true,
      data: {
        user: data.user,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
      },
    });
  });

  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) return fail(reply, 401, "Not authenticated");

    const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", userId).single();
    if (error) {
      request.log.warn(
        {
          route: "auth.me",
          user_id: userId,
          supabase_error: error,
        },
        "Failed to fetch authenticated profile"
      );
      return fail(reply, 404, "We couldn't load your profile.");
    }

    return reply.send({
      ok: true,
      data,
    });
  });
}
