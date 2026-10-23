import { LuSearch, LuX } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router-dom';
import { SongRow } from '../components/music/Song';
import { Avatar, Bars, EmptyState, Skeleton } from '../components/ui';
import { useSearch } from '../hooks/data';
import { count, GENRES, POPULAR_GENRES } from '../lib/format';

export function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const { q, songs, people } = useSearch(query);
  const searching = q.length >= 2;

  return (
    <div className="animate-rise">
      <div className="sticky top-0 z-10 lg:top-16 -mx-4 bg-bg px-4 pb-4 pt-2 sm:-mx-6 sm:px-6">
        <label className="relative block">
          <span className="sr-only">Search Wavee</span>
          <LuSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists or genres"
            className="h-14 w-full rounded-2xl border border-line/10 bg-surface pl-12 pr-12 text-[16px] text-ink placeholder:text-faint focus:border-violet/60 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-line/[0.06]">
              <LuX />
            </button>
          )}
        </label>
      </div>

      {!searching && (
        <section className="mt-4">
          <h2 className="mb-4 text-lg">Browse by genre</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {POPULAR_GENRES.map((g, i) => (
              <button
                key={g}
                onClick={() => setQuery(g)}
                className="group relative h-24 overflow-hidden rounded-2xl border border-line/[0.07] p-4 text-left font-semibold transition duration-300 hover:-translate-y-0.5 hover:border-line/20"
                style={{
                  background: `radial-gradient(120% 140% at 0% 0%, hsl(${(i * 37 + 160) % 360} 65% 42% / 0.55), transparent 60%), linear-gradient(160deg, rgb(var(--raised)), rgb(var(--surface)))`,
                }}
              >
                <span className="relative">{g}</span>
                <Bars className="absolute -bottom-2 -right-2 h-16 w-16 rotate-[-12deg] opacity-25 transition duration-500 group-hover:opacity-50" />
              </button>
            ))}
          </div>
          <h2 className="mb-4 mt-10 text-lg">More genres</h2>
          <div className="flex flex-wrap gap-2">
            {GENRES.filter((g) => !(POPULAR_GENRES as readonly string[]).includes(g)).map((g) => (
              <button
                key={g}
                onClick={() => setQuery(g)}
                className="h-9 rounded-full border border-line/10 px-4 text-[13px] text-muted transition hover:border-line/25 hover:text-ink"
              >
                {g}
              </button>
            ))}
          </div>
        </section>
      )}

      {searching && (
        <div className="mt-2 space-y-10">
          {(people.data?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-4 text-lg">People</h2>
              <div className="scroll-row">
                {people.data!.map((u) => (
                  <Link key={u.id} to={`/u/${u.username}`} className="group w-[128px] shrink-0 snap-start text-center">
                    <Avatar src={u.avatar_url} name={u.display_name || u.username} className="mx-auto h-24 w-24 text-2xl ring-1 ring-line/10 transition group-hover:ring-teal/50" />
                    <p className="mt-3 truncate text-sm font-medium">{u.display_name || u.username}</p>
                    <p className="truncate text-[12px] text-faint">{count(u.followers_count)} followers</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg">Songs</h2>
            {songs.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : songs.data?.length ? (
              <div>
                {songs.data.map((s, i) => (
                  <SongRow key={s.id} song={s} list={songs.data!} index={i} source={`Search: ${q}`} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<LuSearch />} title={`Nothing for “${q}” yet`} text="Try another spelling, an artist’s name or a genre." />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
