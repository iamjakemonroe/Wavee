import { useMemo } from "react";
import { FiDisc } from "react-icons/fi";
import { usePlayerStore } from "@/store/usePlayerStore";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SongCard } from "@/components/music/SongCard";

export function PlayerPage() {
  const { queue, currentSongId, isPlaying, playSong } = usePlayerStore();

  const currentSong = useMemo(
    () => queue.find((s) => s.id === currentSongId) ?? null,
    [queue, currentSongId],
  );

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Now Playing</h2>
      </header>

      {currentSong ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <GlassPanel className="overflow-hidden">
            <div className="aspect-square w-full overflow-hidden">
              <img
                src={currentSong.cover_image_url ?? "/icons.svg"}
                alt={currentSong.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-wavee-primary">
                Now Playing
              </p>
              <h3 className="mt-1 text-2xl font-bold">{currentSong.title}</h3>
              <p className="mt-1 text-sm text-wavee-muted">
                {currentSong.genre}
              </p>
            </div>
          </GlassPanel>

          <div>
            <h3 className="mb-3 text-lg font-bold">
              Queue ({queue.length})
            </h3>
            <div className="space-y-2">
              {queue.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isActive={song.id === currentSongId}
                  isPlaying={song.id === currentSongId && isPlaying}
                  onPlay={() => playSong(song)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <GlassPanel className="p-12 text-center">
          <FiDisc className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">
            No song selected. Pick something from the feed!
          </p>
        </GlassPanel>
      )}
    </section>
  );
}
