import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

export function useLikeSongMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (songId: string) => httpService.post<void>(apiEndpoints.engagement.like(songId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed });
    },
  });
}
