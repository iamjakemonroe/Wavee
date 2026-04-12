import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import { useAuthStore } from "@/store/useAuthStore";
import type { Song } from "@/types/entities";

interface ToggleLikeResult {
  liked: boolean;
}

function bumpLikesInFeed(
  data: InfiniteData<Song[]> | undefined,
  songId: string,
  delta: 1 | -1,
): InfiniteData<Song[]> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.map((song) =>
        song.id === songId
          ? {
              ...song,
              likes_count: Math.max(0, song.likes_count + delta),
            }
          : song,
      ),
    ),
  };
}

export function useLikeSongMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (songId: string) =>
      httpService.post<ToggleLikeResult>(
        apiEndpoints.engagement.toggleLike(songId),
      ),

    onMutate: async (songId) => {
      const { isAuthenticated } = useAuthStore.getState();
      const feedKey = queryKeys.homeFeedQuery(isAuthenticated);

      await queryClient.cancelQueries({ queryKey: queryKeys.myLikes });
      await queryClient.cancelQueries({ queryKey: feedKey });

      const previousMyLikes = queryClient.getQueryData<string[]>(
        queryKeys.myLikes,
      );
      const previousHomeFeed =
        queryClient.getQueryData<InfiniteData<Song[]>>(feedKey);

      const wasLiked = previousMyLikes?.includes(songId) ?? false;
      const delta: 1 | -1 = wasLiked ? -1 : 1;

      queryClient.setQueryData<string[]>(queryKeys.myLikes, (old) => {
        if (!old) return wasLiked ? [] : [songId];
        return wasLiked ? old.filter((id) => id !== songId) : [...old, songId];
      });

      queryClient.setQueryData<InfiniteData<Song[]>>(feedKey, (old) =>
        bumpLikesInFeed(old, songId, delta),
      );

      return { previousMyLikes, previousHomeFeed };
    },

    onError: (_err, _songId, context) => {
      if (!context) return;
      queryClient.setQueryData(queryKeys.myLikes, context.previousMyLikes);
      queryClient.setQueryData(
        queryKeys.homeFeedQuery(useAuthStore.getState().isAuthenticated),
        context.previousHomeFeed,
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myLikes });
      // Do not invalidate home feed here: refetch re-runs the feed IntersectionObserver
      // and can auto-play the next visible card. Likes are already updated in onMutate.
    },
  });
}
