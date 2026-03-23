import { useMutation } from "@tanstack/react-query";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song } from "@/types/entities";

interface UploadPayload {
  title: string;
  genre: string;
  audioFile: File;
  coverFile?: File;
}

export function useUploadSongMutation() {
  return useMutation({
    mutationFn: async (payload: UploadPayload) => {
      const formData = new FormData();
      formData.append("title", payload.title);
      formData.append("genre", payload.genre);
      formData.append("audio", payload.audioFile);
      if (payload.coverFile) {
        formData.append("cover", payload.coverFile);
      }

      return httpService.post<Song>(apiEndpoints.songs.upload, formData);
    },
  });
}
