import { api } from "@/lib/api";

export interface Playlist {
  id: string;
  name: string;
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
