import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

export function useUserSongsSearchQuery(userId: string, q: string, enabled = true) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.userSongsSearch(userId, trimmed),
    queryFn: () =>
      httpService.get<Song[]>(apiEndpoints.profile.userSongsSearch(userId, trimmed)),
    enabled: enabled && !!userId && trimmed.length >= 1,
  });
}
