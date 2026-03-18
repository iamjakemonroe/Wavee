import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAnon } from "../config/supabase.js";
import { fail } from "../utils/http.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return fail(reply, 401, "Missing bearer token");
  }

  const accessToken = authorization.replace("Bearer ", "");
  const { data, error } = await supabaseAnon.auth.getUser(accessToken);
  if (error || !data.user) {
    return fail(reply, 401, "Invalid access token");
  }

  request.userId = data.user.id;
  request.accessToken = accessToken;
}
