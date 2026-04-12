import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import { useAuthStore } from "@/store/useAuthStore";
import type { Song } from "@/types/entities";

const PAGE_SIZE = 10;

/**
 * Signed-in: personalized `GET /v1/feed/home` (ranking from `get_home_feed` RPC).
 * Signed-out: `GET /v1/feed/home/public` (server-defined discovery order).
 *
 * Responses are appended in fetch order; use {@link songsInFeedApiOrder} for rendering — never sort client-side.
 */
export function useHomeFeedQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useInfiniteQuery({
    queryKey: queryKeys.homeFeedQuery(isAuthenticated),
    queryFn: ({ pageParam }) => {
      const offset = Number(pageParam ?? 0);
      const base = isAuthenticated
        ? apiEndpoints.feed.home
        : apiEndpoints.feed.homePublic;
      return httpService.get<Song[]>(
        `${base}?limit=${PAGE_SIZE}&offset=${offset}`,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });
}
