import type { MusicRole } from "@/constants/musicRoles";

export interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  music_roles?: MusicRole[];
  is_artist: boolean;
}
