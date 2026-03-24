import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiMusic, FiChevronRight } from "react-icons/fi";
import { useCreatePlaylistMutation } from "@/hooks/mutations/useCreatePlaylistMutation";
import { usePlaylistsQuery } from "@/hooks/queries/usePlaylistsQuery";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/useAuthStore";

export function PlaylistPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const playlistsQuery = usePlaylistsQuery(isAuthenticated);
  const createMutation = useCreatePlaylistMutation();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(name.trim(), {
      onSuccess: () => setName(""),
    });
  };

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Playlists</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          Organize your music collection
        </p>
      </header>

      {isAuthenticated && (
        <GlassPanel className="mb-6 p-4">
          <form className="flex items-end gap-3" onSubmit={onSubmit}>
            <div className="flex-1">
              <Input
                id="playlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New playlist name"
              />
            </div>
            <Button type="submit" isLoading={createMutation.isPending}>
              <FiPlus size={16} />
              Create
            </Button>
          </form>
        </GlassPanel>
      )}

      {playlistsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : playlistsQuery.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlistsQuery.data.map((playlist) => (
            <GlassPanel
              key={playlist.id}
              onClick={() => navigate(`/playlists/${playlist.id}`)}
              className="group cursor-pointer p-5 transition-all hover:border-wavee-primary/20 hover:shadow-neon"
            >
              <div className="flex items-start justify-between">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-wavee-primary/10 transition-colors group-hover:bg-wavee-primary/20">
                  <FiMusic className="text-wavee-primary" size={18} />
                </div>
                <FiChevronRight
                  className="text-wavee-muted/40 transition-colors group-hover:text-wavee-primary"
                  size={18}
                />
              </div>
              <p className="font-semibold">{playlist.name}</p>
              <p className="mt-1 text-xs text-wavee-muted">
                {new Date(playlist.created_at).toLocaleDateString()}
              </p>
            </GlassPanel>
          ))}
        </div>
      ) : (
        <GlassPanel className="p-12 text-center">
          <FiMusic className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">
            {isAuthenticated
              ? "No playlists yet. Create one above!"
              : "Sign in to see your playlists"}
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
