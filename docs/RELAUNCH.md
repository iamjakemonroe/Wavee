# Wavee relaunch (October 2026)

Wavee becomes a Kaivon product at **https://wavee.kaivon.app**, built the way Utopia is:

- **Data and logic:** Supabase (project `Wavee`, ref `ysdzcoqpmnhjfmqokcmi`). The web app talks to it directly with `supabase-js` and the user's session; rules live in row-level security and Postgres functions. The Fastify server (`apps/backend`) is retired.
- **Media:** Cloudflare R2 bucket `wavee-media`, served from **https://media.wavee.kaivon.app** (free streaming, range requests). Uploads go through the Worker `wavee-media` (`apps/media`), which checks the Supabase session, the file's real type and its size.
- **Web app:** `apps/frontend`, served by the Worker `wavee-web` at wavee.kaivon.app (static assets, single-page fallback, link previews for `/songs/:id` and `/u/:username`).
- **Account deletion:** Supabase Edge Function `delete-account`.

## Media rules (enforced by the media Worker)

| kind | key | types | max |
|---|---|---|---|
| `audio` | `audio/<uid>/<uuid>.<ext>` | mp3, m4a/aac, wav, ogg, flac | 50 MB |
| `video` | `video/<uid>/<uuid>.mp4\|webm` | mp4 (h264/aac), webm | 100 MB |
| `cover` | `cover/<uid>/<uuid>.jpg\|png\|webp` | jpeg, png, webp | 8 MB |
| `avatar` | `avatar/<uid>/<uuid>.<ext>` | jpeg, png, webp | 5 MB |
| `playlist` | `playlist/<uid>/<uuid>.<ext>` | jpeg, png, webp | 5 MB |
| `bug` | `bug/<uid or anon>/<uuid>.<ext>` | jpeg, png, webp | 5 MB |

`POST /upload?kind=<kind>` (body: the file; header `Authorization: Bearer <access token>`; `Content-Type`) → `{ key, url }`. `DELETE /object?key=<key>` deletes a key under the caller's own `<uid>/`. The Worker checks magic bytes, not just the declared type. Anonymous uploads are allowed only for `bug`.

## Database contract (migration `supabase/migrations/20261023100000_wavee_relaunch.sql`)

The live database already has the old migrations (`apps/backend/db/migrations/0001`–`0013`, applied by hand). The relaunch migration builds on that and must be **idempotent** (`if not exists`, `create or replace`, `drop policy if exists`) so it is safe to run once on the live database and on a fresh one. It must also create anything from the old migrations that the new app relies on, so a fresh database works from this file plus the old ones.

### Tables

**`users`** (one per auth user; created by a trigger on `auth.users` insert, username taken from `raw_user_meta_data.username` if valid and free, else derived from the email, made unique with a numeric suffix):
`id uuid pk`, `username text` (unique case-insensitively, 3–30 chars of `a-z 0-9 _ .`, existing duplicates renamed with a suffix), `display_name text` (≤ 50), `email text` (**never readable by other users**: revoke column select from `anon`/`authenticated`, expose own email via `my_account()`), `avatar_url text`, `bio text` (≤ 300), `is_artist bool`, `music_roles text[]`, `is_admin bool default false` (only settable by service role), `banned_at timestamptz`, `followers_count int default 0`, `following_count int default 0`, `created_at`.

**`songs`**: existing columns plus `description text` (≤ 1000), `video_url text`, `audio_key text`, `video_key text`, `cover_key text`, `duration_seconds int`, `explicit bool default false`, `status text default 'active'` check in (`active`,`hidden`,`removed`), `rights_confirmed_at timestamptz` (required on insert), `updated_at timestamptz`.
Readable when `status = 'active'` (or by the owner or an admin). Owners insert (with `rights_confirmed_at` set and `user_id = auth.uid()`, not banned), update their own title/genre/description/cover/video/explicit (not `status`, counts or `user_id`), and delete their own. Admins may update `status`.

**`likes`** (unique user+song), **`follows`** (unique follower+following, no self-follow; triggers keep `followers_count`/`following_count`), **`playlists`** (`is_private` enforced: private playlists and their songs are readable only by the owner), **`playlist_songs`** plus `position int` (ordered; appended at the end).

**`plays`**: no direct insert or select from clients. Written only by `record_play`.

**`reports`**: `id`, `reporter_id uuid null`, `target_type text` (`song`,`user`,`playlist`), `target_id uuid`, `reason text` (`copyright`,`hate`,`harassment`,`sexual`,`violence`,`spam`,`impersonation`,`other`), `details text` (≤ 2000), `contact_email text`, `claimant_name text`, `sworn bool default false` (copyright claims), `status text default 'open'` (`open`,`reviewing`,`actioned`,`dismissed`), `resolution_note text`, `created_at`, `resolved_at`, `resolved_by`. Anyone (signed in or not) inserts through `submit_report`; only admins read and update.

**`bug_reports`**: `id`, `user_id null`, `message text` (≤ 4000), `page text`, `user_agent text`, `screenshot_url text`, `contact_email text`, `status text default 'open'`, `created_at`. Inserted through `submit_bug_report`; admins read and update.

Indexes on every foreign key, `songs(created_at desc)`, `songs(user_id, created_at desc)`, `plays(song_id, created_at)`, `playlist_songs(playlist_id, position)`, trigram indexes on `songs.title` and `users.username`/`display_name` (extension `pg_trgm`).

### Functions (all `security definer` with `set search_path = public`, granted to `anon` and `authenticated` unless noted)

- `my_account()` → `{ id, username, display_name, email, avatar_url, bio, is_artist, music_roles, is_admin }` for the caller.
- `username_available(p_username text)` → bool.
- `get_feed(p_limit int default 20, p_offset int default 0)` → `setof song_card`. Ranks all active songs: for a signed-in caller, genres they've listened to and artists they follow count up; everyone gets trending (plays in the last 7 days), freshness and a small daily-seeded exploration term; songs the caller skipped repeatedly count down. Sorted once, then `offset`/`limit` (so every page continues the same order), at most 2 consecutive songs by one artist where possible.
- `get_trending(p_limit int default 20)` → `setof song_card` (plays in the last 7 days, then likes).
- `get_new_releases(p_limit int default 20)` → `setof song_card`.
- `search_songs(p_query text, p_limit int default 30)` → `setof song_card` (title, genre, artist username/display name; trigram similarity).
- `search_users(p_query text, p_limit int default 20)` → `setof user_card`.
- `get_song(p_id uuid)` → `song_card` (or none).
- `get_user_songs(p_user uuid, p_limit int, p_offset int)` → `setof song_card`.
- `get_profile(p_username text)` → `user_card` plus `followers_count`, `following_count`, `songs_count`, `is_following` (for the caller).
- `get_liked_songs(p_limit int, p_offset int)` (authenticated) → `setof song_card` newest like first.
- `get_playlist_songs(p_playlist uuid)` → `setof song_card` plus `position`, in order (respects privacy).
- `toggle_like(p_song uuid, p_liked bool)` (authenticated) → `{ liked, likes_count }` (idempotent).
- `set_follow(p_user uuid, p_follow bool)` (authenticated) → `{ following, followers_count }`.
- `add_to_playlist(p_playlist uuid, p_song uuid)` / `remove_from_playlist(...)` / `move_in_playlist(p_playlist uuid, p_song uuid, p_position int)` (authenticated, owner only).
- `record_play(p_song uuid, p_listened numeric, p_duration numeric, p_skipped bool, p_session text)` → void. Clamps `p_listened` to the song's duration, ignores repeats by the same user (or session) within 30 seconds, counts a play towards `plays_count` only after 30 seconds or half the song.
- `submit_report(p_target_type, p_target_id, p_reason, p_details, p_contact_email, p_claimant_name, p_sworn)` → `{ id }`. Rate limited: 10 per user (or per hashed session) per hour.
- `submit_bug_report(p_message, p_page, p_user_agent, p_screenshot_url, p_contact_email)` → `{ id }`. Rate limited: 10 per hour.
- `moderate_song(p_song uuid, p_status text, p_note text)` (admin), `resolve_report(p_report uuid, p_status text, p_note text)` (admin), `admin_reports(p_status text)` / `admin_bug_reports(p_status text)` (admin).

`song_card` columns: `id, title, genre, description, audio_url, video_url, cover_image_url, duration_seconds, explicit, plays_count, likes_count, created_at, artist_id, artist_username, artist_display_name, artist_avatar_url, liked` (`liked` is for the caller; false when signed out).

`user_card` columns: `id, username, display_name, avatar_url, bio, is_artist, music_roles, followers_count`.

## Growth (migration `supabase/migrations/20261023120000_wavee_growth.sql`)

See `docs/GROWTH.md` for why each of these exists.

- **Links:** `users.links` and `songs.links` are `jsonb` objects mapping a platform to an https link. The database only accepts each platform's own domains (`wavee_link_domains`), mirrored in the app (`src/lib/platforms.tsx`).
  - Profiles: spotify, apple_music, audiomack, boomplay, youtube, soundcloud, deezer, tidal, bandcamp, tiktok, instagram, x, website.
  - Songs: spotify, apple_music, audiomack, boomplay, youtube, soundcloud, deezer, tidal, presave.
  - `get_profile`, `my_account` and `get_song` return `links`. Owners update them directly on the table.
- **Media links:** song audio, cover and video links, avatars and playlist covers written by a client must be the writer's own files on `media.wavee.kaivon.app` (`wavee_media_guard`). Links already in the database aren't affected.
- **Hook:** `songs.hook_start` (seconds; 0 or more and before the song's end). It's on every `song_card` as `hook_start`, and the feed starts songs there.
- **Early likes:** `likes.early` is set when the like is inserted, if the liker has a counted play of the song, the song has fewer than 50 counted plays, and it isn't the liker's own song.
  - `get_profile` returns `ear: { early_likes, hits }`, where a hit is an early like on a song now at 250+ plays.
  - `get_tastemakers(p_limit)` → `[{ rank, hits, early_likes, user: { id, username, display_name, avatar_url } }]`.
- **Charts:** `get_chart(p_chart 'top' | 'rising' | 'fresh', p_genre text, p_limit)` → `[{ rank, plays, last_rank, song }]`.
  - Counts plays of 30 seconds or half the song, over the 7 days before the start of the current hour, excluding the artist's own plays.
  - Rising needs at least 3 plays this week, and more than last week.
  - Fresh covers songs released in the last 14 days.
  - Genres match loosely ("hip hop" = "Hip-Hop").

- **Verified artists:** `users.verified_at` is set only by `set_verified(p_user, p_verified, p_note)` (admins; logged in `moderation_log`) or the service role. `get_profile` returns `verified`.

`song_card` gains `hook_start` and `artist_verified` (last, in that order).

## Web app

Pages: landing (signed out: trending tracks you can play without an account), Home (For you, Trending, New releases, Artists), Feed (vertical, swipe, from each song's hook), Charts (Top 50, Rising, Fresh, Tastemakers), Search, Library (Liked, Playlists, Uploads, Following), Upload (audio, details, cover, optional music video, rights confirmation), Song, Artist (`/u/:username`), Playlist, Settings (profile, account, password, delete account), Sign in, Sign up, Forgot password, Reset password, Check your email, Terms, Privacy, Copyright, Community guidelines, Report a bug, Admin (reports, bug reports), 404.

Player: one queue owned by the player (pages hand it a list when you press play; browsing never replaces it), skip on errors with a message, Media Session controls, keyboard shortcuts, background play, plays recorded through `record_play`, video playback for songs with a video.
