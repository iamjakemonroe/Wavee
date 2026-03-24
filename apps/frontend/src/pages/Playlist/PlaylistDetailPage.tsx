import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPlay, FiMusic } from "react-icons/fi";
import { usePlaylistSongsQuery } from "@/hooks/queries/usePlaylistSongsQuery";
import { usePlayerStore } from "@/store/usePlayerStore";
import { SongCard } from "@/components/music/SongCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";

export function PlaylistDetailPage() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePlaylistSongsQuery(playlistId ?? "");
  const { currentSongId, isPlaying, setQueue, playSong } = usePlayerStore();

  const playlist = data?.playlist;
  const songs = data?.songs ?? [];

  const playAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    playSong(songs[0]!);
  };

  const playSongFromPlaylist = (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;
    setQueue(songs);
    playSong(song);
  };

  if (isLoading) {
    return (
      <section>
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="mb-6 h-12 w-36 rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-3"
            >
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("/playlists")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
        >
          <FiArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            {playlist?.name ?? "Playlist"}
          </h2>
          {playlist && (
            <p className="mt-0.5 text-xs text-wavee-muted">
              {songs.length} {songs.length === 1 ? "song" : "songs"} ·{" "}
              {new Date(playlist.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {songs.length > 0 && (
        <button
          onClick={playAll}
          className="mb-6 flex items-center gap-2 rounded-xl bg-wavee-primary px-5 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-neon active:scale-95"
        >
          <FiPlay size={16} />
          Play All
        </button>
      )}

      {songs.length > 0 ? (
        <div className="space-y-2">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isActive={currentSongId === song.id}
              isPlaying={currentSongId === song.id && isPlaying}
              onPlay={() => playSongFromPlaylist(song.id)}
            />
          ))}
        </div>
      ) : (
        <GlassPanel className="p-12 text-center">
          <FiMusic className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">
            This playlist is empty. Add songs from the feed!
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
