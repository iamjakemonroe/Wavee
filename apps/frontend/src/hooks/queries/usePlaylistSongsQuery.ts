import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song, Playlist } from "@/types/entities";

interface PlaylistSongsData {
  playlist: Playlist;
  songs: Song[];
}

export function usePlaylistSongsQuery(playlistId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.playlistSongs(playlistId),
    queryFn: () =>
      httpService.get<PlaylistSongsData>(
        apiEndpoints.playlists.songs(playlistId),
      ),
    enabled: enabled && !!playlistId,
  });
}
