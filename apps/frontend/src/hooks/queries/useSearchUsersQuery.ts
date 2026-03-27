import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { SearchUser } from "@/types/search";

export function useSearchUsersQuery(query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchUsers(query),
    queryFn: () =>
      httpService.get<SearchUser[]>(
        `${apiEndpoints.profile.search}?q=${encodeURIComponent(query)}`,
      ),
    enabled: enabled && query.trim().length > 1,
  });
}
