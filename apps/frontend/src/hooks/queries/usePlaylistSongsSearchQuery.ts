import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

export function usePlaylistSongsSearchQuery(playlistId: string, q: string, enabled = true) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.playlistSongsSearch(playlistId, trimmed),
    queryFn: () =>
      httpService.get<Song[]>(apiEndpoints.playlists.songsSearch(playlistId, trimmed)),
    enabled: enabled && !!playlistId && trimmed.length >= 1,
  });
}
