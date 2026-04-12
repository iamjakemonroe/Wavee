import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiMusic } from "react-icons/fi";
import { PlaylistFormSheet } from "@/components/playlist/PlaylistFormSheet";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePlaylistsQuery } from "@/hooks/queries/usePlaylistsQuery";
import { useAuthStore } from "@/store/useAuthStore";

export function PlaylistPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const playlistsQuery = usePlaylistsQuery(isAuthenticated);

  return (
    <section>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Playlists</h2>
          <p className="mt-1 text-sm text-wavee-muted">
            Organize your music collection
          </p>
        </div>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Create playlist"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-wavee-primary transition-all hover:border-wavee-primary/25 hover:bg-wavee-primary/10 active:scale-95"
          >
            <FiPlus size={22} strokeWidth={2.25} />
          </button>
        )}
      </header>

      {isAuthenticated && (
        <PlaylistFormSheet
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {playlistsQuery.isLoading ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] [&>*]:min-w-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : playlistsQuery.data?.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] [&>*]:min-w-0">
          {playlistsQuery.data.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => navigate(`/playlists/${playlist.id}`)}
              className="group relative aspect-square w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] text-left shadow-[0_0_0_1px_rgba(0,209,160,0.06)] transition-all hover:border-wavee-primary/25 hover:shadow-neon/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavee-primary/45"
            >
              {playlist.cover_image_url ? (
                <img
                  src={playlist.cover_image_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-wavee-primary/35 via-wavee-secondary/20 to-wavee-surface"
                  aria-hidden
                >
                  <FiMusic className="text-wavee-primary/90" size={40} strokeWidth={1.5} />
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10"
                aria-hidden
              />
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-3.5">
                <p className="truncate text-sm font-bold leading-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:text-[0.95rem]">
                  {playlist.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <GlassPanel className="p-12 text-center">
          <FiMusic className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">
            {isAuthenticated ? (
              <>
                No playlists yet. Tap{" "}
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="font-medium text-wavee-primary underline-offset-2 hover:underline"
                >
                  +
                </button>{" "}
                to create one.
              </>
            ) : (
              "Sign in to see your playlists"
            )}
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
