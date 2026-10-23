import { useState } from 'react';
import { LuCalendar, LuFilm, LuHeadphones, LuHeart, LuImage, LuShare2 } from 'react-icons/lu';
import { Link, useParams } from 'react-router-dom';
import { LinkPills } from '../components/music/Links';
import { AiTag, Artists } from '../components/music/Artists';
import { ShareCardDialog } from '../components/music/ShareCard';
import { LikeButton, PlayToggle, SongRow } from '../components/music/Song';
import { SongMenu, shareSong } from '../components/music/SongMenu';
import { Avatar, Button, Cover, EmptyState, Skeleton } from '../components/ui';
import { useSong, useUserSongs } from '../hooks/data';
import { ago, artistName, count, duration, songGenres } from '../lib/format';
import { SONG_PLATFORMS } from '../lib/platforms';
import { NotFound } from './NotFound';

export function SongPage() {
  const { id = '' } = useParams();
  const song = useSong(id);
  const more = useUserSongs(song.data?.artist_id);
  const [card, setCard] = useState(false);

  if (song.isLoading) {
    return (
      <div className="grid gap-8 pt-6 md:grid-cols-[300px_1fr]">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-4 pt-10">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    );
  }
  if (!song.data) return <NotFound what="song" />;
  const s = song.data;
  const others = (more.data ?? []).filter((x) => x.id !== s.id).slice(0, 8);
  const list = [s, ...others];

  return (
    <div className="animate-rise">
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-10 pt-12 sm:-mx-6 sm:px-6">
        {s.cover_image_url && (
          <img src={s.cover_image_url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
        <div className="relative grid items-end gap-8 md:grid-cols-[minmax(220px,300px)_1fr]">
          <Cover src={s.cover_image_url} title={s.title} className="aspect-square w-full max-w-[300px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]" rounded="rounded-3xl" />
          <div className="min-w-0">
            <p className="label">Song · {songGenres(s).join(', ')}</p>
            <h1 className="mt-3 break-words text-[34px] leading-[1.05] sm:text-5xl">
              {s.title}
              {s.explicit && <span className="ml-3 rounded-md bg-line/10 px-1.5 align-middle text-xs font-semibold text-muted">E</span>}
              {s.made_with_ai && <AiTag className="ml-2 text-xs" />}
            </h1>
            <div className="mt-5 flex items-center gap-3">
              <Link to={`/u/${s.artist_username}`} className="shrink-0">
                <Avatar src={s.artist_avatar_url} name={artistName(s)} className="h-8 w-8 text-xs" />
              </Link>
              <Artists song={s} className="font-medium" badgeClassName="h-4 w-4" />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5"><LuHeadphones /> {count(s.plays_count)} plays</span>
              <span className="inline-flex items-center gap-1.5"><LuHeart /> {count(s.likes_count)} likes</span>
              <span className="inline-flex items-center gap-1.5"><LuCalendar /> {ago(s.created_at)}</span>
              {s.duration_seconds ? <span>{duration(s.duration_seconds)}</span> : null}
            </div>
            <div className="mt-7 flex items-center gap-2">
              <PlayToggle song={s} list={list} index={0} source={s.title} className="h-14 w-14 text-2xl" />
              <LikeButton song={s} size="lg" />
              <Button variant="ghost" icon={<LuShare2 />} onClick={() => void shareSong(s)}>
                <span className="max-sm:hidden">Share</span>
              </Button>
              <Button variant="ghost" icon={<LuImage />} onClick={() => setCard(true)}>
                <span className="max-sm:hidden">Story card</span>
              </Button>
              <SongMenu song={s} />
            </div>
            {s.links && Object.keys(s.links).length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-faint">Listen everywhere</p>
                <LinkPills links={s.links} order={SONG_PLATFORMS} />
              </div>
            )}
          </div>
        </div>
      </section>

      {s.video_url && (
        <section className="mt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg"><LuFilm /> Music video</h2>
          <video src={s.video_url} poster={s.cover_image_url ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full max-w-4xl rounded-3xl bg-black shadow-lift" />
        </section>
      )}

      {s.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-lg">About this song</h2>
          <p className="selectable whitespace-pre-line text-[15px] leading-7 text-muted">{s.description}</p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-3 text-lg">More from {artistName(s)}</h2>
        {others.length ? (
          others.map((o, i) => <SongRow key={o.id} song={o} list={list} index={i + 1} source={artistName(s)} />)
        ) : (
          <EmptyState title="That’s all for now" text={`${artistName(s)} hasn’t uploaded anything else yet.`} />
        )}
      </section>
      {card && <ShareCardDialog song={s} open={card} onClose={() => setCard(false)} />}
    </div>
  );
}
