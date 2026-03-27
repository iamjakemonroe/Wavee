import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

export function useRemoveSongFromPlaylistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      httpService.delete(apiEndpoints.playlists.songInPlaylist(playlistId, songId)),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlistSongs(playlistId) });
      queryClient.invalidateQueries({ queryKey: ["playlist-songs-search", playlistId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
    },
  });
}
