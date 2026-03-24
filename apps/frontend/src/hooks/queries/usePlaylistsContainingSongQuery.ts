import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

export function usePlaylistsContainingSongQuery(songId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.playlistsContaining(songId),
    queryFn: () =>
      httpService.get<string[]>(apiEndpoints.playlists.containing(songId)),
    enabled: enabled && !!songId,
    staleTime: 30_000,
  });
}
