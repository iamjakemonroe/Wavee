import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/v1"),
  CORS_ORIGIN: z.string().default("*"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STORAGE_BUCKET_SONGS: z.string().default("songs"),
  STORAGE_BUCKET_COVERS: z.string().default("covers"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => {
    return `${issue.path.join(".")}: ${issue.message}`;
  });
  throw new Error(`Invalid environment configuration:\n${formatted.join("\n")}`);
}

export const env = parsed.data;
