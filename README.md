# Wavee

Stream, share and discover music from new artists: **[wavee.kaivon.app](https://wavee.kaivon.app)**. A Kaivon product.

Artists upload songs with cover art and an optional music video. Listeners find them through a swipeable feed, trending charts, search, playlists and likes.

## How it runs

| Piece | Where | What it does |
|-------|-------|--------------|
| Web app (`apps/frontend/src`) | Cloudflare Worker `wavee-web` (static assets) | React 19, Vite, Tailwind, TanStack Query, Zustand, Framer Motion |
| Worker (`apps/frontend/worker`) | Same Worker, on `/api/*`, `/songs/*` and `/u/*` | Checks and stores uploads in R2, deletes a person's files, and adds a song's or artist's title and picture to shared links |
| Media | R2 bucket `wavee-media`, served at `media.wavee.kaivon.app` | Songs (50 MB), music videos (100 MB), covers, avatars and playlist art |
| Data and sign-in | Supabase (Postgres with row-level security, Auth) | The app talks to it directly; every rule lives in the database (`supabase/migrations`) |
| Account deletion | Supabase Edge Function `delete-account` | Deletes the sign-in, which removes everything that belongs to it |

There is no separate API server. The old Fastify backend (`apps/backend`) and the Expo app (`apps/mobile`) belong to the previous version and aren't deployed.

## Develop

```bash
pnpm install
cp apps/frontend/.env.example apps/frontend/.env.local   # then fill in the two values
pnpm --filter wavee-frontend dev
```

`.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the project's publishable key). In development, `/api` is proxied to the live Worker, so uploads work too.

```bash
pnpm --filter wavee-frontend typecheck   # app and Worker
pnpm --filter wavee-frontend icons       # regenerate the favicon, icons and link preview
```

## Database

The schema, policies and functions are in `supabase/migrations`. `docs/RELAUNCH.md` describes the contract the app relies on, and `docs/GROWTH.md` is the plan for growing Wavee. To test a migration against a throwaway Postgres before it ships, see `tool/db_test`.

```bash
supabase link --project-ref ysdzcoqpmnhjfmqokcmi
supabase db push
supabase functions deploy delete-account
```

## Deploy

```bash
pnpm --filter wavee-frontend deploy
```

This typechecks, builds and deploys the Worker with the Supabase values from `.env.local`.

## Policies

Terms, Privacy, Copyright and Community Guidelines are in `apps/frontend/src/content/legal.ts` and live at `/terms`, `/privacy`, `/copyright` and `/guidelines`. Contact: support@kaivon.app.
