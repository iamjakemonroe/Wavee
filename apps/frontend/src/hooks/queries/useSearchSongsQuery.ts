import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

export function useSearchSongsQuery(query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchSongs(query),
    queryFn: () =>
      httpService.get<Song[]>(`${apiEndpoints.songs.search}?q=${encodeURIComponent(query)}`),
    enabled: enabled && query.trim().length > 1,
  });
}
