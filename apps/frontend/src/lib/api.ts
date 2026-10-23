import type { Links } from './platforms';
import { supabase } from './supabase';

/** A song as every list shows it (the database's `song_card`). */
export interface Song {
  id: string;
  title: string;
  genre: string;
  description: string | null;
  audio_url: string;
  video_url: string | null;
  cover_image_url: string | null;
  duration_seconds: number | null;
  explicit: boolean;
  plays_count: number;
  likes_count: number;
  created_at: string;
  artist_id: string;
  artist_username: string;
  artist_display_name: string | null;
  artist_avatar_url: string | null;
  liked: boolean;
  /** Where the best part starts, in seconds (the feed plays from here). */
  hook_start: number | null;
  position?: number;
  /** Only on a single song (get_song). */
  links?: Links;
}

export interface UserCard {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_artist: boolean;
  music_roles: string[];
  followers_count: number;
}

export interface Profile extends UserCard {
  following_count: number;
  songs_count: number;
  is_following: boolean;
  links: Links;
  /** Tastemaker record: likes given early, and how many of those songs became hits. */
  ear: { early_likes: number; hits: number };
}

export interface ChartEntry {
  rank: number;
  plays: number;
  /** Position on last week's top chart (null when it had no plays then). */
  last_rank: number | null;
  song: Song;
}

export type ChartKind = 'top' | 'rising' | 'fresh';

export interface Tastemaker {
  rank: number;
  hits: number;
  early_likes: number;
  user: Pick<UserCard, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface Account {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  is_artist: boolean;
  music_roles: string[];
  is_admin: boolean;
  links: Links;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_private: boolean;
  created_at: string;
  songs_count?: number;
}

export type ReportReason =
  | 'copyright'
  | 'hate'
  | 'harassment'
  | 'sexual'
  | 'violence'
  | 'spam'
  | 'impersonation'
  | 'other';

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: 'song' | 'user' | 'playlist';
  target_id: string;
  reason: ReportReason;
  details: string | null;
  contact_email: string | null;
  claimant_name: string | null;
  sworn: boolean;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

export interface BugReport {
  id: string;
  user_id: string | null;
  message: string;
  page: string | null;
  user_agent: string | null;
  screenshot_url: string | null;
  contact_email: string | null;
  status: string;
  created_at: string;
}

/** What people see when something goes wrong: plain words, never a
 * database's internals. */
export class ApiError extends Error {}

function friendly(message: string): string {
  if (/rate|too many/i.test(message)) return 'You’re doing that a lot. Please wait a little and try again.';
  if (/duplicate|unique/i.test(message)) return 'That’s already taken.';
  if (/JWT|not authenticated|permission|row-level/i.test(message)) {
    return 'Please sign in to do that.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ApiError(friendly(error.message));
  return data as T;
}

const one = <T>(rows: T[] | T | null): T | null =>
  Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);

// ── Listening ──────────────────────────────────────────────────────────

export const api = {
  feed: (limit = 20, offset = 0) => rpc<Song[]>('get_feed', { p_limit: limit, p_offset: offset }),
  trending: (limit = 20) => rpc<Song[]>('get_trending', { p_limit: limit }),
  newReleases: (limit = 20) => rpc<Song[]>('get_new_releases', { p_limit: limit }),
  searchSongs: (query: string, limit = 30) =>
    rpc<Song[]>('search_songs', { p_query: query, p_limit: limit }),
  searchUsers: (query: string, limit = 20) =>
    rpc<UserCard[]>('search_users', { p_query: query, p_limit: limit }),
  song: async (id: string) => one(await rpc<Song[] | Song>('get_song', { p_id: id })),
  userSongs: (userId: string, limit = 50, offset = 0) =>
    rpc<Song[]>('get_user_songs', { p_user: userId, p_limit: limit, p_offset: offset }),
  profile: async (username: string) =>
    one(await rpc<Profile[] | Profile>('get_profile', { p_username: username })),
  likedSongs: (limit = 100, offset = 0) =>
    rpc<Song[]>('get_liked_songs', { p_limit: limit, p_offset: offset }),

  chart: (kind: ChartKind, genre: string | null, limit = 50) =>
    rpc<ChartEntry[]>('get_chart', { p_chart: kind, p_genre: genre, p_limit: limit }),
  tastemakers: (limit = 50) => rpc<Tastemaker[]>('get_tastemakers', { p_limit: limit }),

  recordPlay: (songId: string, listened: number, duration: number, skipped: boolean, session: string) =>
    rpc<void>('record_play', {
      p_song: songId,
      p_listened: Math.max(0, Math.round(listened)),
      p_duration: Math.max(1, Math.round(duration)),
      p_skipped: skipped,
      p_session: session,
    }),

  // ── You ────────────────────────────────────────────────────────────

  myAccount: async () => one(await rpc<Account[] | Account>('my_account')),
  usernameAvailable: (username: string) =>
    rpc<boolean>('username_available', { p_username: username }),

  async updateProfile(
    userId: string,
    changes: Partial<Pick<Account, 'username' | 'display_name' | 'bio' | 'avatar_url' | 'is_artist' | 'music_roles' | 'links'>>,
  ) {
    const { error } = await supabase.from('users').update(changes).eq('id', userId);
    if (error) throw new ApiError(friendly(error.message));
  },

  toggleLike: async (songId: string, liked: boolean) =>
    one(await rpc<{ liked: boolean; likes_count: number }[]>('toggle_like', { p_song: songId, p_liked: liked })),
  setFollow: async (userId: string, follow: boolean) =>
    one(
      await rpc<{ following: boolean; followers_count: number }[]>('set_follow', {
        p_user: userId,
        p_follow: follow,
      }),
    ),

  // ── Songs you upload ───────────────────────────────────────────────

  async createSong(song: {
    title: string;
    genre: string;
    description: string | null;
    explicit: boolean;
    duration_seconds: number | null;
    audio_url: string;
    audio_key: string;
    cover_image_url: string | null;
    cover_key: string | null;
    video_url: string | null;
    video_key: string | null;
    user_id: string;
    hook_start?: number;
    links?: Links;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('songs')
      .insert({ ...song, rights_confirmed_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) throw new ApiError(friendly(error.message));
    return data.id as string;
  },

  async updateSong(
    id: string,
    changes: Partial<{
      title: string;
      genre: string;
      description: string | null;
      explicit: boolean;
      cover_image_url: string | null;
      cover_key: string | null;
      video_url: string | null;
      video_key: string | null;
      hook_start: number | null;
      duration_seconds: number;
      links: Links;
    }>,
  ) {
    const { error } = await supabase.from('songs').update(changes).eq('id', id);
    if (error) throw new ApiError(friendly(error.message));
  },

  /** Deletes the song, then its files. */
  async deleteSong(id: string) {
    const { data, error } = await supabase
      .from('songs')
      .select('audio_key, video_key, cover_key')
      .eq('id', id)
      .single();
    if (error) throw new ApiError(friendly(error.message));
    const { error: deleteError } = await supabase.from('songs').delete().eq('id', id);
    if (deleteError) throw new ApiError(friendly(deleteError.message));
    return [data.audio_key, data.video_key, data.cover_key].filter(Boolean) as string[];
  },

  /** Your songs moderators hid or removed (lists show them as normal to
   * you, so Uploads lists these apart). */
  async myTakenDown(userId: string): Promise<{ id: string; title: string; status: 'hidden' | 'removed' }[]> {
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, status')
      .eq('user_id', userId)
      .neq('status', 'active');
    if (error) throw new ApiError(friendly(error.message));
    return data as { id: string; title: string; status: 'hidden' | 'removed' }[];
  },

  // ── Playlists ──────────────────────────────────────────────────────

  async myPlaylists(userId: string): Promise<Playlist[]> {
    const { data, error } = await supabase
      .from('playlists')
      .select('*, playlist_songs(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(friendly(error.message));
    return (data ?? []).map((p) => ({
      ...p,
      songs_count: (p.playlist_songs as { count: number }[] | undefined)?.[0]?.count ?? 0,
    })) as Playlist[];
  },

  async userPlaylists(userId: string): Promise<Playlist[]> {
    const { data, error } = await supabase
      .from('playlists')
      .select('*, playlist_songs(count)')
      .eq('user_id', userId)
      .eq('is_private', false)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(friendly(error.message));
    return (data ?? []).map((p) => ({
      ...p,
      songs_count: (p.playlist_songs as { count: number }[] | undefined)?.[0]?.count ?? 0,
    })) as Playlist[];
  },

  async playlist(id: string): Promise<(Playlist & { owner: UserCard | null }) | null> {
    const { data, error } = await supabase
      .from('playlists')
      .select('*, owner:users(id, username, display_name, avatar_url)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError(friendly(error.message));
    return data as (Playlist & { owner: UserCard | null }) | null;
  },

  playlistSongs: (id: string) => rpc<Song[]>('get_playlist_songs', { p_playlist: id }),

  async createPlaylist(userId: string, name: string, description: string | null, isPrivate: boolean) {
    const { data, error } = await supabase
      .from('playlists')
      .insert({ user_id: userId, name, description, is_private: isPrivate })
      .select('*')
      .single();
    if (error) throw new ApiError(friendly(error.message));
    return data as Playlist;
  },

  async updatePlaylist(
    id: string,
    changes: Partial<Pick<Playlist, 'name' | 'description' | 'is_private' | 'cover_image_url'>>,
  ) {
    const { error } = await supabase.from('playlists').update(changes).eq('id', id);
    if (error) throw new ApiError(friendly(error.message));
  },

  async deletePlaylist(id: string) {
    const { error } = await supabase.from('playlists').delete().eq('id', id);
    if (error) throw new ApiError(friendly(error.message));
  },

  addToPlaylist: (playlistId: string, songId: string) =>
    rpc<void>('add_to_playlist', { p_playlist: playlistId, p_song: songId }),
  removeFromPlaylist: (playlistId: string, songId: string) =>
    rpc<void>('remove_from_playlist', { p_playlist: playlistId, p_song: songId }),

  // ── Safety ─────────────────────────────────────────────────────────

  submitReport: (report: {
    targetType: 'song' | 'user' | 'playlist';
    targetId: string;
    reason: ReportReason;
    details: string;
    contactEmail: string | null;
    claimantName: string | null;
    sworn: boolean;
  }) =>
    rpc<unknown>('submit_report', {
      p_target_type: report.targetType,
      p_target_id: report.targetId,
      p_reason: report.reason,
      p_details: report.details,
      p_contact_email: report.contactEmail,
      p_claimant_name: report.claimantName,
      p_sworn: report.sworn,
    }),

  submitBugReport: (bug: {
    message: string;
    page: string;
    userAgent: string;
    screenshotUrl: string | null;
    contactEmail: string | null;
  }) =>
    rpc<unknown>('submit_bug_report', {
      p_message: bug.message,
      p_page: bug.page,
      p_user_agent: bug.userAgent,
      p_screenshot_url: bug.screenshotUrl,
      p_contact_email: bug.contactEmail,
    }),

  // ── Admin ──────────────────────────────────────────────────────────

  adminReports: (status: string) => rpc<Report[]>('admin_reports', { p_status: status }),
  adminBugReports: (status: string) => rpc<BugReport[]>('admin_bug_reports', { p_status: status }),
  async setBugStatus(id: string, status: 'open' | 'closed') {
    const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id);
    if (error) throw new ApiError(friendly(error.message));
  },
  resolveReport: (id: string, status: string, note: string) =>
    rpc<void>('resolve_report', { p_report: id, p_status: status, p_note: note }),
  moderateSong: (id: string, status: 'active' | 'hidden' | 'removed', note: string) =>
    rpc<void>('moderate_song', { p_song: id, p_status: status, p_note: note }),
};
