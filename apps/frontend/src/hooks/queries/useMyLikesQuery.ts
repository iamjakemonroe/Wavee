import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

export function useMyLikesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.myLikes,
    queryFn: () => httpService.get<string[]>(apiEndpoints.engagement.myLikes),
    enabled,
    staleTime: 60_000,
  });
}
