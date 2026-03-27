import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

export function useDeletePlaylistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (playlistId: string) => httpService.delete(apiEndpoints.playlists.byId(playlistId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
    },
  });
}
