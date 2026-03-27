import { api } from "@/lib/api";

export interface Playlist {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_private?: boolean;
  created_at?: string;
}

export const playlistService = {
  async list() {
    return api.get<Playlist[]>("/v1/playlists");
  },

  async create(name: string) {
    return api.post<Playlist>("/v1/playlists", { name });
  },

  async addSong(playlistId: string, songId: string) {
    return api.post<void>(`/v1/playlists/${playlistId}/songs`, { songId });
  },
};
