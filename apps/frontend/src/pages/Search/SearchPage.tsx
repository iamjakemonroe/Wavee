import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useSearchSongsQuery } from "@/hooks/queries/useSearchSongsQuery";
import { usePlayerStore } from "@/store/usePlayerStore";
import { SongCard } from "@/components/music/SongCard";
import { Skeleton } from "@/components/ui/Skeleton";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSearchSongsQuery(query, true);
  const { currentSongId, isPlaying, setQueue, playSong } = usePlayerStore();
  const songs = data ?? [];

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Search</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          Find songs, artists, and genres
        </p>
      </header>

      <div className="relative mb-6">
        <FiSearch
          className="absolute left-4 top-1/2 -translate-y-1/2 text-wavee-muted"
          size={18}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to listen to?"
          className="w-full rounded-2xl border border-white/[0.06] bg-wavee-surface px-4 py-3.5 pl-11 text-sm outline-none transition-colors placeholder:text-wavee-muted/50 focus:border-wavee-primary/40"
        />
      </div>

      {isLoading && query.length > 1 && (
        <div className="space-y-3">
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
      )}

      {!isLoading && songs.length > 0 && (
        <div className="space-y-2">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isActive={currentSongId === song.id}
              isPlaying={currentSongId === song.id && isPlaying}
              onPlay={() => {
                setQueue(songs);
                playSong(song);
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && query.length > 1 && songs.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-wavee-muted">
            No results found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {!query && (
        <div className="py-20 text-center">
          <FiSearch className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">Start typing to search</p>
        </div>
      )}
    </section>
  );
}
