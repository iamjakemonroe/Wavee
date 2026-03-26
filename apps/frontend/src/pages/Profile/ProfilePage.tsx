import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FiUser, FiCalendar, FiLogIn, FiEdit2, FiLogOut } from "react-icons/fi";
import { useProfileQuery } from "@/hooks/queries/useProfileQuery";
import { usePlaylistsQuery } from "@/hooks/queries/usePlaylistsQuery";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { useAuthStore } from "@/store/useAuthStore";
import { queryKeys } from "@/constants/queryKeys";
import { formatMusicRoles } from "@/constants/musicRoles";

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, logout } = useAuthStore();
  const profileQuery = useProfileQuery(isAuthenticated);
  const playlistsQuery = usePlaylistsQuery(isAuthenticated);
  const profile = profileQuery.data;

  const [editOpen, setEditOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const roleLabel =
    formatMusicRoles(profile?.music_roles) ??
    (profile?.is_artist ? "Artist" : null);

  const handleLogout = () => {
    logout();
    void queryClient.removeQueries({ queryKey: queryKeys.profile });
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <section>
      <header className="mb-4 sm:mb-6">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          Profile
        </h2>
      </header>

      {!isAuthenticated ? (
        <GlassPanel className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wavee-surface">
            <FiUser className="text-wavee-muted" size={28} />
          </div>
          <div>
            <p className="font-semibold text-wavee-text">
              Sign in to your account
            </p>
            <p className="mt-1 text-sm text-wavee-muted">
              Access your profile, playlists, and uploads
            </p>
          </div>
          <Link to="/login">
            <Button size="lg">
              <FiLogIn size={18} />
              Sign In
            </Button>
          </Link>
          <p className="text-xs text-wavee-muted">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-wavee-primary hover:underline">
              Sign up
            </Link>
          </p>
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-wavee-primary to-wavee-secondary">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiUser className="text-white" size={24} />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{profile.username}</h3>
                  <p className="text-xs text-wavee-muted">{profile.email}</p>
                  {roleLabel && (
                    <p className="mt-1 text-xs font-medium text-wavee-primary">
                      {roleLabel}
                    </p>
                  )}
                  {profile.bio && (
                    <p className="mt-2 text-sm text-wavee-muted">{profile.bio}</p>
                  )}
                  {/* <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-wavee-muted">
                    <span className="flex items-center gap-1">
                      <FiCalendar size={12} />
                      Joined{" "}
                      {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div> */}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setEditOpen(true)}
                >
                  <FiEdit2 size={16} />
                  Edit profile
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-wavee-muted sm:w-auto"
                  onClick={() => setLogoutOpen(true)}
                >
                  <FiLogOut size={16} />
                  Log out
                </Button>
              </div>
            </div>
          </GlassPanel>

          {editOpen && (
            <EditProfileModal
              open={editOpen}
              onOpenChange={setEditOpen}
              profile={profile}
            />
          )}

          <ConfirmationModal
            open={logoutOpen}
            onOpenChange={setLogoutOpen}
            title="Log out?"
            message="You'll need to sign in again to access your playlists, uploads, and profile."
            cancelLabel="Stay signed in"
            proceedLabel="Log out"
            onProceed={handleLogout}
          />

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
