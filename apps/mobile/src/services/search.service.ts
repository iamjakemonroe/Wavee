import { api } from "@/lib/api";
import { Song } from "@/types/entities";

export const searchService = {
  async searchSongs(query: string) {
    if (!query.trim()) return [] as Song[];
    return api.get<Song[]>(`/v1/songs/search?q=${encodeURIComponent(query.trim())}`);
  },
};
