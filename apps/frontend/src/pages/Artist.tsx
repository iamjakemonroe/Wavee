import clsx from 'clsx';
import { useState } from 'react';
import { LuEar, LuFlag, LuFlame, LuMusic, LuPencil, LuPlay, LuShare2, LuUserCheck, LuUserPlus } from 'react-icons/lu';
import { Link, useParams } from 'react-router-dom';
import { FoundingBadge } from '../components/growth/Founding';
import { OfficialTag } from '../components/music/Artists';
import { LinkPills } from '../components/music/Links';
import { Verified } from '../components/music/Verified';
import { SongRow } from '../components/music/Song';
import { Menu, ReportDialog } from '../components/music/SongMenu';
import { Avatar, Button, Cover, EmptyState, LoadError, Skeleton } from '../components/ui';
import { useAppearances, useFinds, useFollow, useProfile, useUserPlaylists, useUserSongs } from '../hooks/data';
import { count, plural, roleLabel } from '../lib/format';
import { ARTIST_PLATFORMS } from '../lib/platforms';
import { useAuth, withAccount } from '../store/auth';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { NotFound } from './NotFound';
import { useTitle } from '../hooks/useTitle';

export function Artist() {
  const { username = '' } = useParams();
  const me = useAuth((s) => s.session?.user.id);
  const profile = useProfile(username.toLowerCase());
  const songs = useUserSongs(profile.data?.id);
  const playlists = useUserPlaylists(profile.data?.id);
  const follow = useFollow(username.toLowerCase());
  const playList = usePlayer((s) => s.playList);
  const [tab, setTab] = useState<'songs' | 'appears' | 'finds' | 'playlists'>('songs');
  const appearances = useAppearances(profile.data?.id);
  const finds = useFinds(tab === 'finds' ? profile.data?.id : undefined);
  useTitle(profile.data ? profile.data.display_name || profile.data.username : null);
  const [reporting, setReporting] = useState(false);

  if (profile.isLoading) {
    return (
      <div className="flex items-center gap-6 pt-8">
        <Skeleton className="h-36 w-36 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }
  if (profile.isError) return <LoadError what="this profile" onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <NotFound what="person" />;
  const p = profile.data;
  const name = p.display_name || p.username;
  const mine = me === p.id;
  const list = songs.data ?? [];

  const share = async () => {
    const url = `${location.origin}/u/${p.username}`;
    try {
      if (navigator.share) await navigator.share({ title: `${name} on Wavee`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      // Share sheet closed.
    }
  };

  return (
    <div className="animate-rise">
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-10 pt-14 sm:-mx-6 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(70%_100%_at_10%_0%,rgb(var(--violet)/0.25),transparent_60%),radial-gradient(50%_80%_at_90%_10%,rgb(var(--teal)/0.15),transparent_60%)]" />
        <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:text-left">
          <Avatar src={p.avatar_url} name={name} className="h-36 w-36 text-5xl shadow-lift ring-4 ring-bg sm:h-44 sm:w-44" />
          <div className="min-w-0">
            <p className="label">
              {p.official ? 'Official Wavee account' : p.is_artist ? 'Artist' : 'Listener'}
              {p.music_roles?.length ? ` · ${p.music_roles.map(roleLabel).join(', ')}` : ''}
            </p>
            <h1 className="mt-2 break-words text-[34px] leading-tight sm:text-5xl">
              {name}
              {p.verified && <Verified className="ml-2 inline h-7 w-7 align-[-0.1em] sm:h-9 sm:w-9" />}
            </h1>
            <p className="mt-1 flex items-center justify-center gap-2 text-muted sm:justify-start">
              @{p.username}
              {p.official && <OfficialTag />}
            </p>
            {p.bio && <p className="mt-3 max-w-xl text-[15px] leading-6 text-ink/80">{p.bio}</p>}
            {(p.founding || (p.explorer ?? 0) > 0) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {p.founding && (
                  <Link to="/founding">
                    <FoundingBadge founding={p.founding} />
                  </Link>
                )}
                {(p.explorer ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-[12px] font-medium text-warn"
                    title="Weeks in a row finding new artists"
                  >
                    <LuFlame /> Explorer · {p.explorer} {p.explorer === 1 ? 'week' : 'weeks'}
                  </span>
                )}
              </div>
            )}
            {p.ear?.early_likes > 0 && (
              <Link
                to="/charts?tab=tastemakers"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[12px] font-medium text-teal"
                title="Liked songs early, after really listening"
              >
                <LuEar /> Early Ear · {p.ear.hits ? `${count(p.ear.hits)} ${p.ear.hits === 1 ? 'hit' : 'hits'}` : `${count(p.ear.early_likes)} early ${p.ear.early_likes === 1 ? 'find' : 'finds'}`}
              </Link>
            )}
            <div className="mt-4 flex justify-center gap-6 text-sm sm:justify-start">
              <span><b className="text-ink">{count(p.followers_count)}</b> <span className="text-muted">{plural(p.followers_count, 'follower')}</span></span>
              <span><b className="text-ink">{count(p.following_count)}</b> <span className="text-muted">following</span></span>
              <span><b className="text-ink">{count(p.songs_count)}</b> <span className="text-muted">{plural(p.songs_count, 'song')}</span></span>
            </div>
          </div>
        </div>
        <LinkPills links={p.links} order={ARTIST_PLATFORMS} className="relative mt-6 justify-center sm:justify-start" />
        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {list.length > 0 && (
            <Button variant="primary" icon={<LuPlay className="fill-current" />} onClick={() => playList(list, 0, name)}>
              Play
            </Button>
          )}
          {mine ? (
            <Link to="/settings">
              <Button icon={<LuPencil />}>Edit profile</Button>
            </Link>
          ) : (
            <Button
              variant={p.is_following ? 'secondary' : 'brand'}
              loading={follow.isPending}
              icon={p.is_following ? <LuUserCheck /> : <LuUserPlus />}
              onClick={() => withAccount(`Sign in to follow ${name}.`, () => follow.mutate({ userId: p.id, follow: !p.is_following }))}
            >
              {p.is_following ? 'Following' : 'Follow'}
            </Button>
          )}
          <Button variant="secondary" icon={<LuShare2 />} onClick={() => void share()}>
            Share
          </Button>
          {!mine && <Menu label="More" items={[{ label: 'Report', icon: <LuFlag />, danger: true, onClick: () => setReporting(true) }]} />}
        </div>
      </section>

      <div className="mb-4 flex gap-2 border-b border-line/[0.06]">
        {(
          [
            ['songs', 'Songs'],
            ['appears', 'Appears on'],
            ...(p.ear?.early_likes > 0 ? ([['finds', 'Early finds']] as const) : []),
            ['playlists', 'Playlists'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              '-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition',
              tab === t ? 'border-teal text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'songs' &&
        (songs.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : list.length ? (
          list.map((s, i) => <SongRow key={s.id} song={s} list={list} index={i} source={name} />)
        ) : (
          <EmptyState
            icon={<LuMusic />}
            title={mine ? 'Your songs will live here' : 'No songs yet'}
            text={mine ? 'Upload your first song and share this page with your fans.' : `${name} hasn’t uploaded anything yet.`}
            action={mine && <Link to="/upload"><Button variant="brand">Upload a song</Button></Link>}
          />
        ))}

      {tab === 'appears' &&
        (appearances.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : appearances.data?.length ? (
          appearances.data.map((s, i) => (
            <SongRow key={s.id} song={s} list={appearances.data!} index={i} source={`${name}: appears on`} />
          ))
        ) : (
          <EmptyState title="Not featured on anything yet" text={`Songs ${name} is featured on show here.`} />
        ))}

      {tab === 'finds' &&
        (finds.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : finds.data?.length ? (
          <>
            <p className="mb-3 text-[13px] text-muted">Songs {name} liked early, after really listening.</p>
            {finds.data.map((s, i) => (
              <SongRow key={s.id} song={s} list={finds.data!} index={i} source={`${name}: early finds`} />
            ))}
          </>
        ) : (
          <EmptyState title="No early finds yet" text="Songs liked early, before they took off, show here." />
        ))}

      {tab === 'playlists' &&
        (playlists.data?.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {playlists.data.map((pl) => (
              <Link key={pl.id} to={`/playlists/${pl.id}`} className="group">
                <Cover src={pl.cover_image_url} title={pl.name} className="aspect-square w-full shadow-lift transition duration-500 group-hover:-translate-y-1" rounded="rounded-2xl" />
                <p className="mt-3 truncate text-sm font-medium">{pl.name}</p>
                <p className="text-[12px] text-faint">{pl.songs_count ?? 0} {plural(pl.songs_count, 'song')}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No public playlists" />
        ))}

      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={p.id} targetName={name} />
    </div>
  );
}
