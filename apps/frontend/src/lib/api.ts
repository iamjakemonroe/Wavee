import type { Origin } from './origin';
import type { Links, Platform } from './platforms';
import { supabase } from './supabase';

/** A song as every list shows it (the database's `song_card`). */
export interface Song {
  id: string;
  title: string;
  genre: string;
  /** Up to three, the first is the main one (same as genre). */
  genres?: string[];
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
  /** The artist has the verified badge. */
  artist_verified?: boolean;
  /** Wavee's own account. */
  artist_official?: boolean;
  /** Featured artists who accepted, in credit order. */
  features?: Featured[];
  /** The uploader says AI tools made it. */
  made_with_ai?: boolean;
  position?: number;
  /** Only on a single song (get_song). */
  links?: Links;
  /** In the feed as a Boost: the boost's id (a listener who hears it for a while counts). */
  promoted?: string;
  /** 'promoted' for a paid Boost, 'new' for a new artist's first listens. */
  promoted_kind?: 'promoted' | 'new';
}

export interface Featured {
  id: string;
  username: string;
  display_name: string | null;
  verified: boolean;
}

/** Someone asked to feature on a song, and where they stand (the owner's view). */
export interface Credit {
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean };
  status: 'pending' | 'accepted' | 'declined';
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
  verified?: boolean;
  official?: boolean;
  /** Their Founding 100 spot, for good. */
  founding?: Founding | null;
  /** Weeks in a row they've found new artists (the discovery challenge). */
  explorer?: number;
}

export interface Founding {
  number: number;
  role: 'artist' | 'listener';
}

export interface FoundingStatus {
  open: boolean;
  /** Founding artists are chosen by the team from applications (wavee_growth.artists_by_review). */
  review: boolean;
  /** applied: every founding application so far. */
  artists: { taken: number; cap: number; applied: number };
  listeners: { taken: number; cap: number };
  me: Founding | null;
  /** Your founding application, if you've sent one. */
  application: { status: ApplicationStatus; decided_at: string | null } | null;
  /** The latest to join, newest first. */
  members: (Founding & Pick<UserCard, 'username' | 'display_name' | 'avatar_url'> & { verified: boolean })[];
}

export type ApplicationKind = 'founding' | 'verified';
/** emerging: show it's yours and let listeners decide; known: prove you are who you say. */
export type ApplicationTrack = 'emerging' | 'known';
export type ApplicationStatus = 'pending' | 'approved' | 'not_yet';

/** An application to be a founding artist, or to be verified, as its artist sees it. */
export interface Application {
  kind: ApplicationKind;
  track: ApplicationTrack;
  status: ApplicationStatus;
  artist_name: string;
  songs: string[];
  links: Links;
  /** Which of [links] carries the code. */
  code_on: Platform | null;
  making_of: string | null;
  about: string;
  audience: string | null;
  attempts: number;
  applied_at: string;
  updated_at: string;
  decided_at: string | null;
  /** From the team, with the decision. */
  message: string | null;
  /** After "not yet": when they can apply again. */
  again_at: string | null;
}

export interface MyApplications {
  /** Their code (wavee-xxxxxx), for a profile bio until the team has looked. */
  code: string;
  /** Already wearing the Verified badge. */
  is_verified: boolean;
  founding: Application | null;
  verified: Application | null;
}

export interface ApplicationInput {
  kind: ApplicationKind;
  track: ApplicationTrack;
  artistName: string;
  songs: string[];
  links: Links;
  codeOn: Platform | null;
  makingOf: string;
  about: string;
  audience: string;
  promise: boolean;
}

/** What listeners did with a song: everyone (not the artist), and the strangers its first
 * listens reached, who never chose the artist. completion is 0–1 (each listener's best listen). */
export interface SongSignal {
  listeners: number;
  heard: number;
  completion: number | null;
  finished: number;
  came_back: number;
  likes: number;
  saves: number;
  feedback: number;
  tags: Partial<Record<FeedbackTag, number>>;
  strangers: { reached: number; heard: number; completion: number | null; likes: number; came_back: number };
}

/** The checks a reviewer made; identity is required to verify. */
export interface ApplicationReview {
  identity?: 'code' | 'email' | 'personal';
  ownership?: ('code' | 'making_of' | 'released' | 'credits')[];
  /** The reviewer's own ear, 1–5. */
  ear?: number;
}

export interface AdminApplication extends Omit<Application, 'songs' | 'again_at'> {
  user: Pick<UserCard, 'id' | 'username' | 'display_name' | 'avatar_url'> & {
    verified: boolean;
    links: Links;
    joined_at: string;
    email: string | null;
    followers: number;
    songs: number;
  };
  code: string | null;
  decided_by: string | null;
  note: string | null;
  review: ApplicationReview | null;
  founding: number | null;
  /** Other accounts going by the same name. */
  same_name: { username: string; display_name: string | null; verified: boolean }[];
  songs: { song: Song; signal: SongSignal }[];
}

/** The team's picks for a week (a Monday), each with why. */
export interface Picks {
  week: string;
  this_week: boolean;
  picks: { note: string | null; song: Song }[];
  /** Recent weeks that have picks, newest first. */
  weeks: string[];
}

export type FeedbackTag = 'replay' | 'hook' | 'vocals' | 'beat' | 'lyrics' | 'vibe' | 'share' | 'mix' | 'intro' | 'long';

export interface Feedback {
  tags: FeedbackTag[];
  note: string | null;
}

export interface FeedbackSummary {
  count: number;
  tags: Partial<Record<FeedbackTag, number>>;
  notes: { note: string; tags: FeedbackTag[]; at: string }[];
}

/** An artist's last seven days, next to the seven before. */
export interface MyWeek {
  songs: number;
  plays: number;
  plays_before: number;
  listeners: number;
  listeners_before: number;
  /** Plays that got past 30 seconds. */
  heard: number;
  top_song: Song | null;
  followers: number;
  likes: number;
  feedback: number;
  first_listens: { reached: number; listeners: number } | null;
  /** In this week's Fresh Finds. */
  picked: boolean;
}

export interface Challenge {
  week: string;
  ends_at: string;
  goal: number;
  found: number;
  streak: number;
  artists: (Pick<UserCard, 'id' | 'username' | 'display_name' | 'avatar_url'> & { verified: boolean })[];
}

export interface Invites {
  count: number;
  artists: number;
  people: (Pick<UserCard, 'username' | 'display_name' | 'avatar_url'> & { joined: string })[];
}

/** A playlist the team features on Home. */
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  owner: { username: string; display_name: string | null };
  songs_count: number;
  covers: string[];
}

export interface NewArtist {
  user: Pick<UserCard, 'id' | 'username' | 'display_name' | 'avatar_url'> & { verified: boolean; links: Links };
  first_at: string;
  songs: number;
  song: Song | null;
  /** Listeners in their first seven days. */
  listeners: number;
  first_listens: { reached: number; listeners: number } | null;
  feedback: number;
  founding: number | null;
  picked: boolean;
  welcomed_at: string | null;
  welcome_note: string | null;
}

export interface PulseWeek {
  week: string;
  accounts: number;
  artists: number;
  songs: number;
  listeners: number;
  returning: number;
  plays: number;
  new_songs_heard: number;
  feedback: number;
  picks: number;
}

export interface Pulse {
  weeks: PulseWeek[];
  totals: {
    accounts: number;
    artists: number;
    songs: number;
    founding_artists: number;
    founding_listeners: number;
    invited: number;
  };
}

/** Where streams came from (plays.source). */
export type PlaySource = Origin | 'new' | 'boost';

interface InsightTotals {
  plays: number;
  streams: number;
  listeners: number;
  /** Average share of a song heard, 0–100. */
  avg_heard: number | null;
  /** Null for a single song (followers are the artist's). */
  followers: number | null;
  likes: number;
  playlist_adds: number;
  feedback: number;
}

/** An artist's stats for a period (artist_insights). */
export interface Insights {
  days: number;
  unit: 'day' | 'week';
  /** Artist Pro (or a founding artist): every range and the audience details. */
  full: boolean;
  from: string;
  totals: InsightTotals;
  prev: InsightTotals;
  series: { date: string; streams: number; listeners: number; followers: number | null }[];
  top: {
    id: string;
    title: string;
    cover_image_url: string | null;
    streams: number;
    streams_before: number;
    listeners: number;
    avg_heard: number | null;
    likes: number;
  }[];
  sources: Partial<Record<PlaySource, number>>;
  all_time: { streams: number; listeners: number; followers: number };
  songs: { id: string; title: string }[];
  more: {
    countries: { shown: { country: string; listeners: number }[]; other: number; unknown: number };
    audience: { new: number; returning: number };
    segments: { light: number; regular: number; super: number };
    /** Plays by how much of the song was heard, in tenths. */
    completion: number[];
  } | null;
}

interface ListeningTotals {
  minutes: number;
  streams: number;
  artists: number;
  discovered: number;
  likes: number;
}

/** Someone's own listening (listener_insights). */
export interface Listening {
  days: number;
  unit: 'day' | 'week';
  totals: ListeningTotals;
  prev: ListeningTotals;
  series: { date: string; minutes: number; discovered: number }[];
  top_artists: (Pick<UserCard, 'id' | 'username' | 'display_name' | 'avatar_url'> & { verified: boolean; streams: number })[];
  all_time: { minutes: number; discovered: number };
  ear: { early_likes: number; hits: number };
  streak: number;
  invited: number;
}

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

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

/** Messages written for people (raised with errcode WV001) are shown as they are. */
function friendly(message: string, code?: string): string {
  if (code === 'WV001') return message;
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
  if (error) throw new ApiError(friendly(error.message, error.code));
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

  recordPlay: (
    songId: string,
    listened: number,
    duration: number,
    skipped: boolean,
    session: string,
    source: Origin | 'new' | 'boost',
    country: string | null,
  ) =>
    rpc<void>('record_play', {
      p_song: songId,
      p_listened: Math.max(0, Math.round(listened)),
      p_duration: Math.max(1, Math.round(duration)),
      p_skipped: skipped,
      p_session: session,
      p_source: source,
      p_country: country,
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
    genres?: string[];
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
    made_with_ai?: boolean;
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
      genres: string[];
      description: string | null;
      explicit: boolean;
      cover_image_url: string | null;
      cover_key: string | null;
      video_url: string | null;
      video_key: string | null;
      hook_start: number | null;
      duration_seconds: number;
      links: Links;
      made_with_ai: boolean;
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

  // ── Featured artists ──────────────────────────────────────────────

  /** Who's featured on your song, in order. New names are asked; names left out are removed. */
  setSongFeatures: (songId: string, userIds: string[]) =>
    rpc<Credit[]>('set_song_features', { p_song: songId, p_users: userIds }),
  songCredits: (songId: string) => rpc<Credit[]>('get_song_credits', { p_song: songId }),
  /** Accept or decline being featured (or take your name off later). */
  respondToFeature: (songId: string, accept: boolean) =>
    rpc<unknown>('respond_to_feature', { p_song: songId, p_accept: accept }),
  featureInvites: () => rpc<Song[]>('my_feature_invites'),
  appearances: (userId: string, limit = 100) =>
    rpc<Song[]>('get_user_appearances', { p_user: userId, p_limit: limit, p_offset: 0 }),

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

  // ── Growing Wavee ──────────────────────────────────────────────────

  foundingStatus: () => rpc<FoundingStatus>('founding_status'),
  claimFounding: (role: Founding['role']) => rpc<Founding>('claim_founding', { p_role: role }),
  myApplications: () => rpc<MyApplications>('my_applications'),
  submitApplication: (a: ApplicationInput) =>
    rpc<Application>('submit_application', {
      p_kind: a.kind,
      p_track: a.track,
      p_artist_name: a.artistName,
      p_songs: a.songs,
      p_links: a.links,
      p_code_on: a.codeOn,
      p_making_of: a.makingOf || null,
      p_about: a.about,
      p_audience: a.audience || null,
      p_promise: a.promise,
    }),
  withdrawApplication: (kind: ApplicationKind) => rpc<MyApplications>('withdraw_application', { p_kind: kind }),
  picks: (week?: string | null) => rpc<Picks>('get_picks', { p_week: week ?? null }),
  giveFeedback: (songId: string, tags: FeedbackTag[], note: string, listened: number) =>
    rpc<Feedback>('give_feedback', { p_song: songId, p_tags: tags, p_note: note || null, p_listened: Math.round(listened) }),
  myFeedback: (songId: string) => rpc<Feedback | null>('my_feedback', { p_song: songId }),
  feedbackSummary: (songId: string) => rpc<FeedbackSummary>('song_feedback_summary', { p_song: songId }),
  myWeek: () => rpc<MyWeek>('my_week'),
  challenge: () => rpc<Challenge>('my_challenge'),
  finds: (userId: string, limit = 50) => rpc<Song[]>('get_user_finds', { p_user: userId, p_limit: limit }),
  claimReferral: (username: string) => rpc<{ ok: boolean }>('claim_referral', { p_username: username }),
  myInvites: () => rpc<Invites>('my_invites'),
  collections: () => rpc<Collection[]>('get_featured_playlists'),
  insights: (days: number, song: string | null, user: string | null = null) =>
    rpc<Insights>('artist_insights', { p_days: days, p_song: song, p_tz: timeZone(), p_user: user }),
  listening: (days: number) => rpc<Listening>('listener_insights', { p_days: days, p_tz: timeZone() }),

  // ── Admin ──────────────────────────────────────────────────────────

  adminSetFounding: (userId: string, role: Founding['role'] | null) =>
    rpc<Founding | null>('admin_set_founding', { p_user: userId, p_role: role }),
  adminPick: (songId: string, note: string, week?: string | null) =>
    rpc<Picks>('admin_pick', { p_song: songId, p_note: note || null, p_week: week ?? null }),
  adminUnpick: (songId: string, week: string) => rpc<Picks>('admin_unpick', { p_song: songId, p_week: week }),
  adminFeaturePlaylist: (playlistId: string, on: boolean) =>
    rpc<Collection[]>('admin_feature_playlist', { p_playlist: playlistId, p_on: on }),
  adminNewArtists: (days = 30) => rpc<NewArtist[]>('admin_new_artists', { p_days: days }),
  adminWelcomeArtist: (userId: string, note: string) =>
    rpc<void>('admin_welcome_artist', { p_user: userId, p_note: note || null }),
  adminPulse: (weeks = 8) => rpc<Pulse>('admin_pulse', { p_weeks: weeks }),
  adminApplications: (status: ApplicationStatus | 'all', kind: ApplicationKind | null = null) =>
    rpc<AdminApplication[]>('admin_applications', { p_status: status, p_kind: kind }),
  adminDecideApplication: (d: {
    userId: string;
    kind: ApplicationKind;
    decision: Exclude<ApplicationStatus, 'pending'>;
    message: string;
    note: string;
    verify: boolean;
    review: ApplicationReview;
  }) =>
    rpc<{ status: ApplicationStatus; founding: number | null; verified: boolean }>('admin_decide_application', {
      p_user: d.userId,
      p_kind: d.kind,
      p_decision: d.decision,
      p_message: d.message || null,
      p_note: d.note || null,
      p_verify: d.verify,
      p_review: d.review,
    }),

  adminReports: (status: string) => rpc<Report[]>('admin_reports', { p_status: status }),
  adminBugReports: (status: string) => rpc<BugReport[]>('admin_bug_reports', { p_status: status }),
  async setBugStatus(id: string, status: 'open' | 'closed') {
    const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id);
    if (error) throw new ApiError(friendly(error.message));
  },
  setOfficial: async (userId: string, official: boolean) =>
    one(await rpc<{ official: boolean }[] | { official: boolean }>('set_official', { p_user: userId, p_official: official })),
  setVerified: async (userId: string, verified: boolean, note: string) =>
    one(await rpc<{ verified: boolean }[] | { verified: boolean }>('set_verified', {
      p_user: userId,
      p_verified: verified,
      p_note: note || null,
    })),
  resolveReport: (id: string, status: string, note: string) =>
    rpc<void>('resolve_report', { p_report: id, p_status: status, p_note: note }),
  moderateSong: (id: string, status: 'active' | 'hidden' | 'removed', note: string) =>
    rpc<void>('moderate_song', { p_song: id, p_status: status, p_note: note }),
};
