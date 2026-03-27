import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

export function useSongByIdQuery(songId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.song(songId),
    queryFn: () => httpService.get<Song>(apiEndpoints.songs.byId(songId)),
    enabled: enabled && !!songId,
    staleTime: 60_000,
  });
}
