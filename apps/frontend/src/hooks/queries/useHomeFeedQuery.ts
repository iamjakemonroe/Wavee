import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

const PAGE_SIZE = 10;

export function useHomeFeedQuery(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.homeFeed,
    queryFn: ({ pageParam }) => {
      const offset = Number(pageParam ?? 0);
      return httpService.get<Song[]>(
        `${apiEndpoints.feed.home}?limit=${PAGE_SIZE}&offset=${offset}`
      );
    },
    initialPageParam: 0,
    enabled,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });
}
