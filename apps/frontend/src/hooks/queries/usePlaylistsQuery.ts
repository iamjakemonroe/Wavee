import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Playlist } from "@/types/entities";

export function usePlaylistsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.playlists,
    queryFn: () => httpService.get<Playlist[]>(apiEndpoints.playlists.base),
    enabled,
  });
}
