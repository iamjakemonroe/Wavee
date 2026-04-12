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

/** Sets userId when a valid Bearer token is present; otherwise leaves user unset (no 401). */
export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  request.userId = undefined;
  request.accessToken = undefined;
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return;

  const accessToken = authorization.replace("Bearer ", "");
  const { data, error } = await supabaseAnon.auth.getUser(accessToken);
  if (error || !data.user) return;

  request.userId = data.user.id;
  request.accessToken = accessToken;
}
