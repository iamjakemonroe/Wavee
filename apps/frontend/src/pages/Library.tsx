import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Boosts } from '../components/money/Boosts';
import { useState } from 'react';
import { LuHeart, LuListMusic, LuMusic, LuPlay, LuPlus, LuUpload } from 'react-icons/lu';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SignedOut } from '../components/auth/SignedOut';
import { SongRow } from '../components/music/Song';
import { Button, Checkbox, Cover, EmptyState, Input, Modal, Skeleton, Textarea } from '../components/ui';
import { keys, useAppearances, useFeatureInvites, useLiked, useMyPlaylists, useUserSongs } from '../hooks/data';
import { api, type Song } from '../lib/api';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { EditSong } from './EditSong';
import { plural } from '../lib/format';
import { useTitle } from '../hooks/useTitle';

const tabs = [
  { id: 'liked', label: 'Liked songs' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'uploads', label: 'Your uploads' },
  { id: 'credits', label: 'Credits' },
  { id: 'boosts', label: 'Boosts' },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Library() {
  useTitle('Your library');
  const session = useAuth((s) => s.session);
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'liked') as Tab;
  const invites = useFeatureInvites().data?.length ?? 0;

  if (!session) {
    return (
      <SignedOut
        icon={<LuListMusic />}
        title="Your library lives here"
        text="Keep the songs you like, make playlists, and upload your own music. It’s free."
        next="/library"
      />
    );
  }

  return (
    <div className="animate-rise">
      <h1 className="mt-2 text-3xl">Your library</h1>
      <div className="mb-6 mt-6 flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={clsx(
              'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition',
              tab === t.id ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted hover:bg-line/[0.1] hover:text-ink',
            )}
          >
            {t.label}
            {t.id === 'credits' && invites > 0 && (
              <span className="ml-1.5 rounded-full bg-teal px-1.5 text-[11px] font-semibold text-bg">{invites}</span>
            )}
          </button>
        ))}
      </div>
      {tab === 'liked' && <Liked />}
      {tab === 'playlists' && <Playlists />}
      {tab === 'uploads' && <Uploads userId={session.user.id} />}
      {tab === 'credits' && <Credits userId={session.user.id} />}
      {tab === 'boosts' && <Boosts />}
    </div>
  );
}

function PlayAll({ list, source }: { list: Song[]; source: string }) {
  const playList = usePlayer((s) => s.playList);
  if (!list.length) return null;
  return (
    <Button variant="primary" size="sm" className="mb-4" icon={<LuPlay className="fill-current" />} onClick={() => playList(list, 0, source)}>
      Play all
    </Button>
  );
}

function Liked() {
  const liked = useLiked();
  if (liked.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  const list = liked.data ?? [];
  if (!list.length) {
    return <EmptyState icon={<LuHeart />} title="Songs you like appear here" text="Tap the heart on any song to keep it." action={<Link to="/feed"><Button variant="brand">Find music</Button></Link>} />;
  }
  return (
    <>
      <PlayAll list={list} source="Liked songs" />
      {list.map((s, i) => (
        <SongRow key={s.id} song={s} list={list} index={i} source="Liked songs" />
      ))}
    </>
  );
}

function Playlists() {
  const playlists = useMyPlaylists();
  const [creating, setCreating] = useState(false);
  return (
    <>
      {playlists.isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          <button
            onClick={() => setCreating(true)}
            className="group grid aspect-square w-full place-items-center rounded-2xl border border-dashed border-line/15 text-muted transition hover:border-teal/50 hover:text-ink"
          >
            <span className="flex flex-col items-center gap-2 text-sm font-medium">
              <LuPlus className="text-2xl transition group-hover:scale-110" />
              New playlist
            </span>
          </button>
          {playlists.data?.map((p) => (
            <Link key={p.id} to={`/playlists/${p.id}`} className="group">
              <Cover src={p.cover_image_url} title={p.name} className="aspect-square w-full shadow-lift transition duration-500 group-hover:-translate-y-1" rounded="rounded-2xl" />
              <p className="mt-3 truncate text-sm font-medium">{p.name}</p>
              <p className="text-[12px] text-faint">
                {p.is_private ? 'Private · ' : ''}
                {p.songs_count ?? 0} {plural(p.songs_count, 'song')}
              </p>
            </Link>
          ))}
        </div>
      )}
      <NewPlaylist open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

export function NewPlaylist({ open, onClose, then }: { open: boolean; onClose: () => void; then?: (id: string) => void }) {
  const userId = useAuth((s) => s.session?.user.id);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!userId || !name.trim()) return;
    setSaving(true);
    try {
      const playlist = await api.createPlaylist(userId, name.trim(), description.trim() || null, isPrivate);
      void client.invalidateQueries({ queryKey: keys.myPlaylists });
      setName('');
      setDescription('');
      onClose();
      if (then) then(playlist.id);
      else navigate(`/playlists/${playlist.id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New playlist">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="space-y-4"
      >
        <Input label="Name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Late night drive" />
        <Textarea label="Description (optional)" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        <Checkbox checked={isPrivate} onChange={setPrivate}>Private: only you can see it</Checkbox>
        <Button type="submit" variant="primary" className="w-full" loading={saving} disabled={!name.trim()}>
          Create playlist
        </Button>
      </form>
    </Modal>
  );
}

function Uploads({ userId }: { userId: string }) {
  const songs = useUserSongs(userId);
  const takenDown = useQuery({ queryKey: ['taken-down', userId], queryFn: () => api.myTakenDown(userId) });
  const [editing, setEditing] = useState<Song | null>(null);
  if (songs.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  const down = new Map((takenDown.data ?? []).map((s) => [s.id, s.status]));
  const list = (songs.data ?? []).filter((s) => !down.has(s.id));
  if (!list.length && !down.size) {
    return (
      <EmptyState
        icon={<LuMusic />}
        title="Share your first song"
        text="Upload a track with its cover art, and a music video if you have one. It’s free."
        action={<Link to="/upload"><Button variant="brand" icon={<LuUpload />}>Upload music</Button></Link>}
      />
    );
  }
  return (
    <>
      <div className="flex items-center justify-between">
        <PlayAll list={list} source="Your uploads" />
        <Link to="/upload" className="mb-4">
          <Button size="sm" icon={<LuUpload />}>Upload</Button>
        </Link>
      </div>
      {list.map((s, i) => (
        <SongRow
          key={s.id}
          song={s}
          list={list}
          index={i}
          source="Your uploads"
          extraMenu={[{ label: 'Edit details', onClick: () => setEditing(s) }]}
        />
      ))}
      {down.size > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-base">Taken down</h2>
          <p className="mb-4 text-[13px] text-muted">
            Only you can see these. If you think we got it wrong, write to wavee@kaivon.app. See the{' '}
            <Link to="/copyright" className="link">copyright policy</Link> and{' '}
            <Link to="/guidelines" className="link">guidelines</Link>.
          </p>
          {takenDown.data!.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 text-sm odd:bg-line/[0.02]">
              <span className="truncate">{s.title}</span>
              <span className={clsx('shrink-0 rounded-full px-2.5 py-0.5 text-[12px]', s.status === 'removed' ? 'bg-danger/15 text-danger' : 'bg-warn/15 text-warn')}>
                {s.status === 'removed' ? 'Removed' : 'Hidden'}
              </span>
            </div>
          ))}
        </section>
      )}
      {editing && <EditSong song={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Songs you've been asked to feature on, and songs you're credited on. */
function Credits({ userId }: { userId: string }) {
  const client = useQueryClient();
  const invites = useFeatureInvites();
  const appearances = useAppearances(userId);
  const [busy, setBusy] = useState<string | null>(null);

  const answer = async (song: Song, accept: boolean) => {
    setBusy(song.id);
    try {
      await api.respondToFeature(song.id, accept);
      void client.invalidateQueries({ queryKey: keys.invites });
      void client.invalidateQueries({ queryKey: keys.appearances(userId) });
      void client.invalidateQueries({ queryKey: keys.song(song.id) });
      toast(accept ? `You’re on “${song.title}” now` : 'Done', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (invites.isLoading || appearances.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  const pending = invites.data ?? [];
  const mine = appearances.data ?? [];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-base">Asked to feature</h2>
        <p className="mb-4 text-[13px] text-muted">Accept and your name shows on the song, and the song on your page.</p>
        {pending.length ? (
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-3 p-3">
                <Cover src={s.cover_image_url} title={s.title} className="h-12 w-12" rounded="rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link to={`/songs/${s.id}`} className="block truncate font-medium hover:underline">{s.title}</Link>
                  <p className="truncate text-[13px] text-muted">by {s.artist_display_name || s.artist_username}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => void answer(s, false)}>
                    Decline
                  </Button>
                  <Button size="sm" variant="brand" loading={busy === s.id} onClick={() => void answer(s, true)}>
                    Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">No requests right now.</p>
        )}
      </section>
      <section>
        <h2 className="mb-4 text-base">Songs you’re on</h2>
        {mine.length ? (
          mine.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              list={mine}
              index={i}
              source="Songs you’re on"
              extraMenu={[{ label: 'Take my name off', danger: true, onClick: () => void answer(s, false) }]}
            />
          ))
        ) : (
          <p className="text-sm text-faint">When you accept a feature, the song shows here and on your page.</p>
        )}
      </section>
    </div>
  );
}
