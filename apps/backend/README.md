# Wavee Backend

Scalable API and service layer for Wavee. All database, storage, and business logic lives in this backend.

## Stack

- Fastify + TypeScript
- Supabase Auth/Postgres/Storage via server-side clients
- Zod request validation
- Module-oriented route architecture

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Default base URL: `http://localhost:4000/v1`

## API Modules

- `auth` (`/auth/signup`, `/auth/signin`, `/auth/me`)
- `feed` (`/feed/home`)
- `songs` (`/songs/search`, `/songs/upload`)
- `engagement` (`/engagement/likes/:songId`, `/engagement/plays`)
- `playlists` (`/playlists`, `/playlists/:playlistId/songs`)
- `profile` (`/profile/me`, `/profile/follow`)
- `leaderboards` (`/leaderboards/global|rising|weekly`)

## Database

Apply SQL migration:

- `db/migrations/0001_wavee_mvp.sql`

Includes:
- core entities (`users`, `songs`, `likes`, `follows`, `playlists`, `playlist_songs`, `plays`, `subscriptions`)
- ranking views (`song_metrics`, `song_scores`)
- feed function (`get_home_feed`) with 60/30/10 composition
- global/rising/weekly artist leaderboard views
- AI metadata placeholder table
