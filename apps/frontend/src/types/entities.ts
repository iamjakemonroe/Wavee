import type { MusicRole } from "@/constants/musicRoles";

export interface Song {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  audio_url: string;
  cover_image_url: string | null;
  plays_count: number;
  likes_count: number;
  /** Length in seconds when known (e.g. from metadata). */
  duration_seconds?: number | null;
  created_at: string;
  artist_name?: string;
  score?: number;
  completion_rate?: number;
  skip_rate?: number;
  trending_score?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  is_artist: boolean;
  music_roles?: MusicRole[];
  created_at: string;
}

/** Profile fields exposed for other users (no email). */
export interface PublicUserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_artist: boolean;
  music_roles?: MusicRole[];
  created_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_private: boolean;
  created_at: string;
}
