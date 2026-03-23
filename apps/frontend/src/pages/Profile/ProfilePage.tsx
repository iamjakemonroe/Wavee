import { FiUser, FiMusic, FiCalendar } from "react-icons/fi";
import { useProfileQuery } from "@/hooks/queries/useProfileQuery";
import { usePlaylistsQuery } from "@/hooks/queries/usePlaylistsQuery";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/useAuthStore";

export function ProfilePage() {
  const { isAuthenticated } = useAuthStore();
  const profileQuery = useProfileQuery(isAuthenticated);
  const playlistsQuery = usePlaylistsQuery(isAuthenticated);
  const profile = profileQuery.data;

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Profile</h2>
      </header>

      {!isAuthenticated ? (
        <GlassPanel className="p-8 text-center">
          <FiUser className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">Sign in to see your profile</p>
        </GlassPanel>
      ) : profileQuery.isLoading ? (
        <GlassPanel className="space-y-4 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </GlassPanel>
      ) : profile ? (
        <div className="space-y-4">
          <GlassPanel className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wavee-primary to-wavee-secondary">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <FiUser className="text-white" size={24} />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">{profile.username}</h3>
                <p className="text-sm text-wavee-muted">{profile.email}</p>
                {profile.bio && (
                  <p className="mt-2 text-sm text-wavee-muted">{profile.bio}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-wavee-muted">
                  {profile.is_artist && (
                    <span className="flex items-center gap-1">
                      <FiMusic size={12} /> Artist
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FiCalendar size={12} />
                    Joined{" "}
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </GlassPanel>

          <div>
            <h3 className="mb-3 text-lg font-bold">Your Playlists</h3>
            {playlistsQuery.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {playlistsQuery.data.map((playlist) => (
                  <GlassPanel key={playlist.id} className="p-4">
                    <p className="font-semibold">{playlist.name}</p>
                    <p className="mt-1 text-xs text-wavee-muted">
                      Created{" "}
                      {new Date(playlist.created_at).toLocaleDateString()}
                    </p>
                  </GlassPanel>
                ))}
              </div>
            ) : (
              <GlassPanel className="p-6 text-center">
                <p className="text-wavee-muted">No playlists yet</p>
              </GlassPanel>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
