import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useSearchSongsQuery } from "@/hooks/queries/useSearchSongsQuery";
import { useSearchUsersQuery } from "@/hooks/queries/useSearchUsersQuery";
import { useRequireAuthAction } from "@/hooks/useRequireAuthAction";
import { usePlayerStore } from "@/store/usePlayerStore";
import { SongCard } from "@/components/music/SongCard";
import { SearchUserCard } from "@/components/search/SearchUserCard";
import { Skeleton } from "@/components/ui/Skeleton";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const enabled = query.trim().length > 1;

  const songsQuery = useSearchSongsQuery(query, enabled);
  const usersQuery = useSearchUsersQuery(query, enabled);

  const { currentSongId, isPlaying, setQueue, playSong } = usePlayerStore();
  const { run: withAuth } = useRequireAuthAction();
  const songs = songsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const isLoading = enabled && (songsQuery.isLoading || usersQuery.isLoading);
  const hasResults = users.length > 0 || songs.length > 0;

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Search</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          Find people, songs, and genres
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
          placeholder="Search artists, songs, or genres…"
          className="w-full rounded-2xl border border-white/[0.06] bg-wavee-surface px-4 py-3.5 pl-11 text-base outline-none transition-colors placeholder:text-wavee-muted/50 focus:border-wavee-primary/40 md:text-sm"
        />
      </div>

      {isLoading && (
        <div className="space-y-8">
          <div>
            <Skeleton className="mb-3 h-5 w-24" />
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] [&>*]:min-w-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
        </div>
      )}

      {!isLoading && enabled && hasResults && (
        <div className="space-y-10">
          {users.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-wavee-muted">
                People
              </h3>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] [&>*]:min-w-0">
                {users.map((user) => (
                  <SearchUserCard key={user.id} user={user} />
                ))}
              </div>
            </div>
          )}

          {songs.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-wavee-muted">
                Songs
              </h3>
              <div className="space-y-2">
                {songs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    isActive={currentSongId === song.id}
                    isPlaying={currentSongId === song.id && isPlaying}
                    showDuration
                    onPlay={() =>
                      withAuth(() => {
                        setQueue(songs);
                        playSong(song);
                      }, "Sign in to play tracks")
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && enabled && !hasResults && (
        <div className="py-20 text-center">
          <p className="text-wavee-muted">
            No results found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {!query.trim() && (
        <div className="py-20 text-center">
          <FiSearch className="mx-auto mb-3 text-wavee-muted/30" size={48} />
          <p className="text-wavee-muted">Start typing to search</p>
        </div>
      )}
    </section>
  );
}
