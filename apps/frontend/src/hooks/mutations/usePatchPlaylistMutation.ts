import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Playlist } from "@/types/entities";

export interface PatchPlaylistBody {
  name?: string;
  description?: string | null;
  is_private?: boolean;
}

export function usePatchPlaylistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, body }: { playlistId: string; body: PatchPlaylistBody }) =>
      httpService.patch<Playlist>(apiEndpoints.playlists.byId(playlistId), body),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlistSongs(playlistId) });
    },
  });
}
