import { api } from "@/lib/api";
import { HomeFeedSong } from "@/types/entities";

interface FeedParams {
  limit?: number;
  offset?: number;
}

export const feedService = {
  async getHomeFeed({ limit = 25, offset = 0 }: FeedParams): Promise<HomeFeedSong[]> {
    return api.get<HomeFeedSong[]>(`/v1/feed/home?limit=${limit}&offset=${offset}`);
  },
};
