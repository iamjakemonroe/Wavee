import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { LuArrowRight, LuPlay, LuSparkles, LuUpload } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { SongRow, SongTile } from '../components/music/Song';
import { Avatar, Bars, Button, EmptyState, Skeleton } from '../components/ui';
import { useFeed, useNewReleases, useTrending } from '../hooks/data';
import { api, type Song } from '../lib/api';
import { artistName } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-4">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-[22px]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TileRow({ songs, loading, source, ranked }: { songs?: Song[]; loading: boolean; source: string; ranked?: boolean }) {
  if (loading) {
    return (
      <div className="scroll-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[156px] shrink-0 sm:w-[176px]">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (!songs?.length) return <p className="text-sm text-muted">Nothing here yet. Be the first to upload.</p>;
  return (
    <div className="scroll-row">
      {songs.map((s, i) => (
        <SongTile key={s.id} song={s} list={songs} index={i} source={source} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}

function Hero({ trending }: { trending?: Song[] }) {
  const playList = usePlayer((s) => s.playList);
  const covers = (trending ?? []).filter((s) => s.cover_image_url).slice(0, 5);
  return (
    <section className="relative -mx-4 mb-6 overflow-hidden px-4 pb-14 pt-10 sm:-mx-6 sm:px-6 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_15%_10%,rgb(var(--teal)/0.22),transparent_60%),radial-gradient(50%_70%_at_85%_30%,rgb(var(--violet)/0.28),transparent_60%)]" />
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-muted">
            <Bars playing className="h-3.5 w-3.5" /> New music, straight from the artists
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.2, 0.7, 0.1, 1] }}
            className="text-[40px] leading-[1.02] sm:text-[56px]"
          >
            Hear it first.
            <br />
            <span className="text-brand">Share it everywhere.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-5 max-w-md text-[16px] leading-7 text-muted"
          >
            Wavee is where artists drop their songs and videos, from rising names to the biggest stars, and where fans
            hear them first. Free to listen, free to upload.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-3">
            {trending && trending.length === 0 ? (
              // Nothing uploaded yet: the way in is to be first.
              <Link to="/upload">
                <Button variant="brand" size="lg" icon={<LuUpload />}>
                  Be the first to upload
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<LuPlay className="fill-current" />}
                  disabled={!trending?.length}
                  onClick={() => trending && playList(trending, 0, 'Trending this week')}
                >
                  Start listening
                </Button>
                <Link to="/upload">
                  <Button size="lg" icon={<LuUpload />}>
                    Upload your music
                  </Button>
                </Link>
              </>
            )}
          </motion.div>
        </div>
        <div className="relative hidden h-[340px] lg:block" aria-hidden="true">
          {covers.length < 3 && <Halo />}
          {covers.length >= 3 && covers.map((s, i) => (
            <motion.img
              key={s.id}
              src={s.cover_image_url!}
              alt=""
              initial={{ opacity: 0, y: 30, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: [-10, 6, -3, 9, -6][i] }}
              transition={{ delay: 0.15 * i, duration: 0.9, ease: [0.2, 0.7, 0.1, 1] }}
              className="absolute h-44 w-44 rounded-3xl object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-line/10"
              style={{ left: `${[8, 32, 54, 20, 64][i]}%`, top: `${[18, 2, 22, 48, 52][i]}%`, zIndex: [3, 2, 4, 1, 5][i] }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** A ring of equaliser bars, breathing: the hero's picture until there
 * are covers to show. */
function Halo() {
  const count = 56;
  return (
    <div className="absolute inset-0 grid place-items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.2, 0.7, 0.1, 1] }}
        className="relative h-[320px] w-[320px]"
      >
        <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgb(var(--violet)/0.35),rgb(var(--teal)/0.12)_55%,transparent_70%)] blur-xl" />
        <div className="absolute inset-[30%] grid place-items-center rounded-full border border-line/10 bg-bg/60 backdrop-blur-md">
          <Bars playing className="h-12 w-12" />
        </div>
        {Array.from({ length: count }).map((_, i) => {
          const t = i / count;
          const tall = 18 + 26 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45));
          return (
            <span key={i} className="absolute left-1/2 top-1/2 block h-0 w-0" style={{ transform: `rotate(${t * 360}deg)` }}>
              <span
                className="absolute block w-[4px] origin-bottom animate-eq rounded-full"
                style={{
                  height: `${tall}px`,
                  left: '-2px',
                  bottom: '108px',
                  background: `color-mix(in oklab, rgb(var(--teal)) ${Math.round(100 - Math.abs(0.5 - t) * 200)}%, rgb(var(--violet)))`,
                  opacity: 0.85,
                  animationDelay: `${(i % 7) * -0.17}s`,
                  animationDuration: `${1 + (i % 5) * 0.18}s`,
                }}
              />
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}

/** Artists from what's trending, each once. */
function ArtistsToFollow({ songs }: { songs?: Song[] }) {
  const artists = useMemo(() => {
    const seen = new Map<string, Song>();
    for (const s of songs ?? []) if (!seen.has(s.artist_id)) seen.set(s.artist_id, s);
    return [...seen.values()].slice(0, 12);
  }, [songs]);
  if (!artists.length) return null;
  return (
    <Section title="Artists on the rise" subtitle="The people behind this week’s plays.">
      <div className="scroll-row">
        {artists.map((s) => (
          <Link key={s.artist_id} to={`/u/${s.artist_username}`} className="group w-[120px] shrink-0 snap-start text-center">
            <Avatar
              src={s.artist_avatar_url}
              name={artistName(s)}
              className="mx-auto h-[104px] w-[104px] text-3xl ring-1 ring-line/10 transition duration-500 group-hover:-translate-y-1 group-hover:ring-teal/50"
            />
            <p className="mt-3 truncate text-sm font-medium">{artistName(s)}</p>
            <p className="truncate text-[12px] text-faint">@{s.artist_username}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function Home() {
  const signedIn = !!useAuth((s) => s.session);
  const account = useAuth((s) => s.account);
  const trending = useTrending(20);
  const fresh = useNewReleases(20);
  const feed = useFeed();
  const forYou = feed.data?.pages.flat().slice(0, 10) ?? [];
  const playList = usePlayer((s) => s.playList);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="animate-rise">
      {signedIn ? (
        <div className="pb-2 pt-4">
          <p className="label">{greeting}</p>
          <h1 className="mt-2 text-[32px] leading-tight">{account?.display_name || account?.username || 'Welcome back'}</h1>
        </div>
      ) : (
        <Hero trending={trending.data} />
      )}

      <Section
        title="For you"
        subtitle={signedIn ? 'Picked from what you play, and what’s rising.' : 'A taste of what’s playing on Wavee.'}
        action={
          forYou.length > 0 && (
            <Button
              size="sm"
              icon={<LuPlay className="fill-current" />}
              onClick={() =>
                playList(forYou, 0, 'For you', async () => {
                  const offset = usePlayer.getState().queue.length;
                  return api.feed(20, offset);
                })
              }
            >
              Play
            </Button>
          )
        }
      >
        {feed.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : forYou.length ? (
          <div className="grid gap-x-6 lg:grid-cols-2">
            {forYou.map((s, i) => (
              <SongRow key={s.id} song={s} list={forYou} index={i} source="For you" showNumber={false} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<LuSparkles />}
            title="The first songs are on their way"
            text="Wavee is brand new. Upload a song and you could be the first thing people hear."
            action={
              <Link to="/upload">
                <Button variant="brand" icon={<LuUpload />}>
                  Upload music
                </Button>
              </Link>
            }
          />
        )}
        {forYou.length > 0 && (
          <Link to="/feed" className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            Keep going in the Feed <LuArrowRight />
          </Link>
        )}
      </Section>

      <Section
        title="Trending this week"
        subtitle="The most played songs of the last seven days."
        action={
          <Link to="/charts" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted hover:text-ink">
            See the charts <LuArrowRight />
          </Link>
        }
      >
        <TileRow songs={trending.data} loading={trending.isLoading} source="Trending this week" ranked />
      </Section>

      <Section title="New releases" subtitle="Fresh uploads from artists on Wavee.">
        <TileRow songs={fresh.data} loading={fresh.isLoading} source="New releases" />
      </Section>

      <ArtistsToFollow songs={trending.data} />

      {!signedIn && (
        <section className="relative mt-16 overflow-hidden rounded-4xl border border-line/10 p-8 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(70%_100%_at_0%_0%,rgb(var(--teal)/0.18),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(var(--violet)/0.25),transparent_60%)]" />
          <div className="relative max-w-xl">
            <h2 className="text-[26px] leading-tight sm:text-[32px]">Make music? Put it in front of new ears.</h2>
            <p className="mt-3 text-muted">
              Upload songs, cover art and music videos for free. Your fans follow you, and Wavee’s feed brings you
              new listeners every day.
            </p>
            <Link to="/signup" className="mt-6 inline-block">
              <Button variant="brand" size="lg" icon={<LuUpload />}>
                Start uploading
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
