import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Playlist } from "@/types/entities";

export type CreatePlaylistInput =
  | string
  | {
      name: string;
      description?: string;
      isPrivate?: boolean;
      cover?: File | null;
    };

export function useCreatePlaylistMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlaylistInput) => {
      if (typeof input === "string") {
        return httpService.post<Playlist>(apiEndpoints.playlists.base, { name: input });
      }
      const fd = new FormData();
      fd.append("name", input.name);
      fd.append("description", input.description ?? "");
      fd.append("is_private", input.isPrivate ? "true" : "false");
      if (input.cover) fd.append("cover", input.cover);
      return httpService.post<Playlist>(apiEndpoints.playlists.base, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
    },
  });
}
