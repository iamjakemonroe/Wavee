import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

interface AddToPlaylistParams {
  playlistId: string;
  songId: string;
}

export function useAddToPlaylistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId }: AddToPlaylistParams) =>
      httpService.post(apiEndpoints.playlists.songs(playlistId), { songId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
    },
  });
}
