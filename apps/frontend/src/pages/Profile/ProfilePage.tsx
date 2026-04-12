import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiUser,
  FiLogIn,
  FiEdit2,
  FiLogOut,
  FiMusic,
  FiChevronRight,
} from "react-icons/fi";
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

const HERO_IMAGE_MASK =
  "linear-gradient(to bottom, #000 0%, #000 40%, rgba(0,0,0,0.5) 65%, transparent 92%)";

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
    <section className="relative -mt-4 sm:-mt-6">
      {!isAuthenticated ? (
        <GlassPanel
          intensity="medium"
          className="relative overflow-hidden border-white/[0.08] p-8 text-center sm:p-10"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-wavee-primary/12 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-gradient-to-br from-wavee-primary/25 to-wavee-secondary/15 shadow-[0_0_40px_-8px_rgba(0,209,160,0.35)]">
              <FiUser className="text-wavee-primary/90" size={36} strokeWidth={1.5} />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-lg font-bold text-wavee-text">Sign in to your account</p>
              <p className="text-sm leading-relaxed text-wavee-muted">
                Access your profile, playlists, and uploads in one place.
              </p>
            </div>
            <Link to="/login">
              <Button size="lg" className="shadow-[0_0_24px_-6px_rgba(0,209,160,0.45)]">
                <FiLogIn size={18} />
                Sign in
              </Button>
            </Link>
            <p className="text-xs text-wavee-muted">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="font-medium text-wavee-primary hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </GlassPanel>
      ) : profileQuery.isLoading ? (
        <div className="space-y-6">
          <div className="relative -mx-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-wavee-surface/40 sm:-mx-6">
            <Skeleton className="h-48 w-full rounded-none sm:h-52" />
            <div className="absolute bottom-4 left-4 right-4 flex gap-4 sm:left-6 sm:right-6">
              <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col justify-end gap-2 pb-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
          </div>
          <GlassPanel className="p-5">
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton className="aspect-[5/3] w-full rounded-xl" />
              <Skeleton className="aspect-[5/3] w-full rounded-xl" />
            </div>
          </GlassPanel>
        </div>
      ) : profileQuery.isError ? (
        <GlassPanel className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-wavee-muted">
            We couldn&apos;t load your profile. Check your connection and try again.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void profileQuery.refetch()}
          >
            Retry
          </Button>
        </GlassPanel>
      ) : profile ? (
        <div className="space-y-8">
          <div className="relative -mx-4 sm:-mx-6">
            <div
              className="pointer-events-none absolute inset-0 min-h-[220px] bg-wavee-bg bg-wavee-gradient sm:min-h-[240px]"
              aria-hidden
            />
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="absolute inset-0 h-full min-h-[220px] w-full object-cover object-center sm:min-h-[240px]"
                style={{
                  maskImage: HERO_IMAGE_MASK,
                  WebkitMaskImage: HERO_IMAGE_MASK,
                }}
              />
            ) : (
              <div
                className="absolute inset-0 flex min-h-[220px] items-center justify-center bg-gradient-to-b from-zinc-700/90 via-zinc-900 to-wavee-bg sm:min-h-[240px]"
                style={{
                  maskImage: HERO_IMAGE_MASK,
                  WebkitMaskImage: HERO_IMAGE_MASK,
                }}
                aria-hidden
              >
                <FiUser className="text-white/20" size={80} strokeWidth={1} />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 min-h-[220px] bg-gradient-to-b from-black/55 via-black/20 to-transparent sm:min-h-[240px]"
              aria-hidden
            />
            <div className="relative z-10 flex min-h-[220px] flex-col justify-end px-4 pb-6 pt-10 sm:min-h-[240px] sm:px-6 sm:pb-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/[0.12] bg-wavee-surface shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-2 ring-black/30 sm:h-28 sm:w-28">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wavee-primary/40 to-wavee-secondary/25">
                        <FiUser className="text-white/90" size={36} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 pb-0.5">
                    <h3 className="truncate text-2xl font-black tracking-tight text-white drop-shadow-md sm:text-3xl">
                      {profile.username}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-white/55">{profile.email}</p>
                    {roleLabel && (
                      <span className="mt-2 inline-flex rounded-full border border-wavee-primary/35 bg-wavee-primary/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-wavee-primary shadow-[0_0_20px_-8px_rgba(0,209,160,0.4)]">
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-[11rem] sm:items-stretch">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full border-wavee-primary/20 bg-black/35 text-white backdrop-blur-sm hover:border-wavee-primary/35 hover:bg-wavee-primary/15 sm:w-auto"
                    onClick={() => setEditOpen(true)}
                  >
                    <FiEdit2 size={16} />
                    Edit profile
                  </Button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-white/45 transition-colors hover:text-rose-400/90 sm:w-auto"
                    onClick={() => setLogoutOpen(true)}
                  >
                    <FiLogOut size={14} />
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {profile.bio ? (
            <GlassPanel intensity="light" className="border-white/[0.07] p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
                About you
              </p>
              <p className="mt-3 text-sm leading-relaxed text-wavee-muted">{profile.bio}</p>
            </GlassPanel>
          ) : null}

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
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
                  Your playlists
                </h3>
                <p className="mt-1 text-lg font-bold text-wavee-text">Library</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/playlists")}
                className="shrink-0 text-xs font-semibold text-wavee-primary transition-colors hover:underline"
              >
                Manage
              </button>
            </div>

            {playlistsQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="aspect-[5/3] w-full rounded-xl" />
                <Skeleton className="aspect-[5/3] w-full rounded-xl" />
              </div>
            ) : playlistsQuery.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {playlistsQuery.data.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => navigate(`/playlists/${playlist.id}`)}
                    className="group relative flex overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-left transition-all hover:border-wavee-primary/25 hover:bg-white/[0.05] hover:shadow-[0_0_32px_-12px_rgba(0,209,160,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavee-primary/40"
                  >
                    <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
                      {playlist.cover_image_url ? (
                        <img
                          src={playlist.cover_image_url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-wavee-primary/30 to-wavee-secondary/15">
                          <FiMusic className="text-wavee-primary/90" size={28} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-l border-white/[0.06] py-3 pl-4 pr-10 sm:pl-5">
                      <p className="truncate font-semibold text-wavee-text">{playlist.name}</p>
                      <p className="text-xs text-wavee-muted">
                        {new Date(playlist.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 transition-colors group-hover:text-wavee-primary/80">
                      <FiChevronRight size={20} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <GlassPanel intensity="light" className="border-dashed border-white/[0.1] p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
                  <FiMusic className="text-wavee-muted" size={22} />
                </div>
                <p className="mt-3 text-sm font-medium text-wavee-text">No playlists yet</p>
                <p className="mt-1 text-sm text-wavee-muted">
                  Create one from the Playlists tab to organize your tracks.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-5"
                  onClick={() => navigate("/playlists")}
                >
                  Go to playlists
                </Button>
              </GlassPanel>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
