import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";
import type { Song, PublicUserProfile } from "@/types/entities";

export interface UserSongsData {
  user: PublicUserProfile;
  songs: Song[];
}

export function useUserSongsQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.userSongs(userId),
    queryFn: () =>
      httpService.get<UserSongsData>(apiEndpoints.profile.userSongs(userId)),
    enabled: enabled && !!userId,
  });
}
