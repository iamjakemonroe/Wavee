# Wavee

**Wavee** is a music streaming platform focused on discovery, creator uploads, and a TikTok-style vertical feed. This repository is a **pnpm monorepo** with three apps:

| App | Stack | Role |
|-----|--------|------|
| **Frontend** (`apps/frontend`) | React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand, Framer Motion | Web app + installable PWA (dark UI, global player, feed, search, playlists, upload) |
| **Backend** (`apps/backend`) | Fastify 5, TypeScript, Zod, Supabase (Postgres + Auth + Storage) | REST API (`/v1/...`), auth, feeds, songs, engagement, playlists |
| **Mobile** (`apps/mobile`) | Expo, React Native, Expo Router | Native client aligned with the same API |

Data lives in **Supabase** (PostgreSQL with RLS, Storage buckets for audio and covers). The backend uses the **service role** key for privileged operations; clients talk only to the API with user JWTs.

---

## Prerequisites

- **Node.js** 20+ (recommended)
- **pnpm** 9+ (repo pins `pnpm@10.6.3` in `package.json`)
- A **Supabase** project (URL, anon key, service role key)

---

## Quick start

From the repository root:

```bash
pnpm install
```

### 1. Backend environment

Copy and edit `apps/backend/.env` (see `apps/backend` for expected variables). At minimum:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Public anon key (JWT verification) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key (DB/Storage admin) |
| `FRONTEND_URL` | Web app origin (e.g. `http://localhost:5173`) for email redirects |
| `CORS_ORIGIN` | Allowed browser origin(s) or `*` for dev |

Optional: `PORT` (default `4000`), `API_PREFIX` (default `/v1`).

### 2. Database

Apply SQL in order under **`apps/backend/db/migrations/`** in the Supabase SQL Editor (or your migration runner). These define schema, RLS, feed functions, storage buckets, and triggers (e.g. likes/plays counts).

### 3. Frontend environment

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Set `VITE_API_BASE_URL` to your API base (e.g. `http://localhost:4000`). **Do not commit `apps/frontend/.env`** — it is gitignored.

### 4. Run dev servers

In two terminals from the repo root:

```bash
pnpm backend
```

```bash
pnpm frontend
```

- API: `http://localhost:4000` (`GET /v1/health` for a quick health check)
- Web: `http://localhost:5173`

Mobile (optional):

```bash
pnpm mobile
```

---

## Root scripts

| Command | Description |
|---------|-------------|
| `pnpm backend` | Start Fastify API in watch mode |
| `pnpm frontend` | Start Vite dev server |
| `pnpm mobile` | Start Expo |
| `pnpm typecheck` | Typecheck all workspaces |

Per-app scripts (build, lint, etc.) live in each `apps/*/package.json`.

---

## Features (high level)

- **Auth** — Email/password via Supabase; backend issues/validates sessions; web uses stored JWT + `/auth/callback` for email confirmation.
- **Home feed** — Personalized/trending mix from SQL (`get_home_feed`); vertical snap scroll with autoplay; likes with optimistic UI.
- **Player** — Shared audio instance, queue, skip, progress; PWA-friendly.
- **Upload** — Multipart audio (+ optional cover) to Storage; metadata in `songs`.
- **Playlists** — Create playlists, add tracks, dedicated playlist view and queue.
- **Search & profile** — Song search; profile and creator-oriented UI.

---

## Project layout

```
apps/
  backend/     # Fastify API, env schema, route modules, db/migrations
  frontend/    # Vite SPA, PWA assets (manifest, service worker), public icons
  mobile/      # Expo app
```

---

## Security notes

- Never commit **`.env`** files or the **Supabase service role** key.
- Configure Supabase **Site URL** and **redirect URLs** to match `FRONTEND_URL` and your auth callback path.
- Storage buckets and RLS policies are defined in migrations — run them in your Supabase project before relying on uploads or public URLs.

---

## License

Private / unlicensed unless you add a `LICENSE` file.
