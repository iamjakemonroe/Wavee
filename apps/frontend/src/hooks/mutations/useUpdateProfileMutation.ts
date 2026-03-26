import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import type { MusicRole } from "@/constants/musicRoles";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { UserProfile } from "@/types/entities";

export interface UpdateProfilePayload {
  username: string;
  bio: string;
  music_roles: MusicRole[];
  avatarFile?: File | null;
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      bio,
      music_roles,
      avatarFile,
    }: UpdateProfilePayload) => {
      if (avatarFile) {
        const fd = new FormData();
        fd.append("avatar", avatarFile);
        await httpService.post<{ avatar_url: string }>(
          apiEndpoints.profile.avatar,
          fd,
        );
      }

      return httpService.patch<UserProfile>(apiEndpoints.profile.patch, {
        username,
        bio: bio.trim() ? bio.trim() : null,
        music_roles,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}
