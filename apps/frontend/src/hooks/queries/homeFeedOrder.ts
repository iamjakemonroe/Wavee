import type { InfiniteData } from "@tanstack/react-query";
import type { Song } from "@/types/entities";

/**
 * Ordered list of songs for the home feed UI and player queue.
 *
 * **Preserves backend ranking strictly:** page order is `pageParams` sequence (0, then limit, …);
 * within and across pages, order matches each `/v1/feed/home` (or `/public`) response array.
 * Do not sort, dedupe-by-sort, or reorder — the API defines discovery/ranking.
 */
export function songsInFeedApiOrder(
  data: InfiniteData<Song[]> | undefined,
): Song[] {
  if (!data?.pages.length) return [];
  return data.pages.flat();
}
