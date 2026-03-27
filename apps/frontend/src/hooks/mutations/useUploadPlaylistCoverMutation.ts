import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Playlist } from "@/types/entities";

export function useUploadPlaylistCoverMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, file }: { playlistId: string; file: File }) => {
      const fd = new FormData();
      fd.append("cover", file);
      return httpService.post<Playlist>(apiEndpoints.playlists.cover(playlistId), fd);
    },
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlistSongs(playlistId) });
    },
  });
}
