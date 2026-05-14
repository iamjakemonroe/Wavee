import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { engagementRoutes } from "./modules/engagement/engagement.routes.js";
import { feedRoutes } from "./modules/feed/feed.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { leaderboardRoutes } from "./modules/leaderboards/leaderboards.routes.js";
import { playlistsRoutes } from "./modules/playlists/playlists.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { songsRoutes } from "./modules/songs/songs.routes.js";
import { HttpError } from "./utils/http.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    bodyLimit: 25 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
  });
  await app.register(multipart);

  const base = env.API_PREFIX;
  app.register(healthRoutes, { prefix: `${base}/health` });
  app.register(authRoutes, { prefix: `${base}/auth` });
  app.register(feedRoutes, { prefix: `${base}/feed` });
  app.register(songsRoutes, { prefix: `${base}/songs` });
  app.register(engagementRoutes, { prefix: `${base}/engagement` });
  app.register(playlistsRoutes, { prefix: `${base}/playlists` });
  app.register(profileRoutes, { prefix: `${base}/profile` });
  app.register(leaderboardRoutes, { prefix: `${base}/leaderboards` });

  app.setErrorHandler((err, request, reply) => {
    const error = err as Error & { statusCode?: number };
    console.error(`[${request.method} ${request.url}]`, error);
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        ok: false,
        error: { message: error.message },
      });
    }
    const status = error.statusCode ?? 500;
    const message =
      env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error";
    return reply.status(status).send({
      ok: false,
      error: { message },
    });
  });

  return app;
}
