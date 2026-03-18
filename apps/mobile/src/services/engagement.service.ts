import { api } from "@/lib/api";

export const engagementService = {
  async likeSong(songId: string) {
    await api.post<void>(`/v1/engagement/likes/${songId}`);
  },

  async unlikeSong(songId: string) {
    await api.delete<void>(`/v1/engagement/likes/${songId}`);
  },

  async recordPlay({
    userId,
    songId,
    durationListened,
    songDuration,
    skipped,
    replayed,
  }: {
    userId: string | null;
    songId: string;
    durationListened: number;
    songDuration: number;
    skipped: boolean;
    replayed: boolean;
  }) {
    await api.post<void>("/v1/engagement/plays", {
      userId,
      songId,
      durationListened,
      songDuration,
      skipped,
      replayed,
    });
  },
};
