export type PlanType = "free" | "premium" | "creator_pro";

export interface AppUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  is_artist: boolean;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
}

export interface Song {
  id: string;
  user_id: string;
  title: string;
  audio_url: string;
  cover_image_url: string | null;
  genre: string;
  plays_count: number;
  likes_count: number;
  created_at: string;
  completion_rate?: number;
  skip_rate?: number;
  trending_score?: number;
}

export interface HomeFeedSong extends Song {
  score: number;
}
