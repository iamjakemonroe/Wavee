import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LuImage, LuLock, LuPencil, LuPlay, LuShuffle, LuTrash2 } from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SongRow } from '../components/music/Song';
import { Avatar, Button, Checkbox, Cover, EmptyState, Input, Modal, Skeleton, Textarea } from '../components/ui';
import { keys, usePlaylist, usePlaylistSongs } from '../hooks/data';
import { api, type Playlist } from '../lib/api';
import { duration } from '../lib/format';
import { uploadMedia } from '../lib/media';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';
import { NotFound } from './NotFound';

export function PlaylistPage() {
  const { id = '' } = useParams();
  const me = useAuth((s) => s.session?.user.id);
  const playlist = usePlaylist(id);
  const songs = usePlaylistSongs(id);
  const client = useQueryClient();
  const playList = usePlayer((s) => s.playList);
  const [editing, setEditing] = useState(false);

  if (playlist.isLoading) return <Skeleton className="mt-6 h-56 w-full rounded-3xl" />;
  if (!playlist.data) return <NotFound what="playlist" />;
  const pl = playlist.data;
  const mine = me === pl.user_id;
  const list = songs.data ?? [];
  const total = list.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

  const remove = async (songId: string) => {
    try {
      await api.removeFromPlaylist(pl.id, songId);
      void client.invalidateQueries({ queryKey: keys.playlistSongs(pl.id) });
      void client.invalidateQueries({ queryKey: keys.myPlaylists });
      toast('Removed from the playlist');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="animate-rise">
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-10 pt-12 sm:-mx-6 sm:px-6">
        {pl.cover_image_url && <img src={pl.cover_image_url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
        <div className="relative grid items-end gap-8 md:grid-cols-[minmax(200px,260px)_1fr]">
          <Cover src={pl.cover_image_url} title={pl.name} className="aspect-square w-full max-w-[260px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]" rounded="rounded-3xl" />
          <div>
            <p className="label flex items-center gap-2">Playlist {pl.is_private && <><LuLock /> Private</>}</p>
            <h1 className="mt-3 break-words text-[34px] leading-tight sm:text-5xl">{pl.name}</h1>
            {pl.description && <p className="mt-3 max-w-2xl text-muted">{pl.description}</p>}
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              {pl.owner && (
                <Link to={`/u/${pl.owner.username}`} className="inline-flex items-center gap-2 font-medium text-ink hover:underline">
                  <Avatar src={pl.owner.avatar_url} name={pl.owner.display_name || pl.owner.username} className="h-6 w-6 text-[10px]" />
                  {pl.owner.display_name || pl.owner.username}
                </Link>
              )}
              <span>· {list.length} songs · {duration(total)}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" icon={<LuPlay className="fill-current" />} disabled={!list.length} onClick={() => playList(list, 0, pl.name)}>
                Play
              </Button>
              <Button
                icon={<LuShuffle />}
                disabled={!list.length}
                onClick={() => {
                  const shuffled = [...list].sort(() => Math.random() - 0.5);
                  playList(shuffled, 0, pl.name);
                }}
              >
                Shuffle
              </Button>
              {mine && (
                <Button variant="ghost" icon={<LuPencil />} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {songs.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : list.length ? (
        list.map((s, i) => (
          <SongRow
            key={`${s.id}-${i}`}
            song={s}
            list={list}
            index={i}
            source={pl.name}
            extraMenu={mine ? [{ label: 'Remove from this playlist', onClick: () => void remove(s.id), danger: true }] : undefined}
          />
        ))
      ) : (
        <EmptyState title="This playlist is empty" text={mine ? 'Use the ••• menu on any song to add it here.' : undefined} />
      )}

      {mine && <EditPlaylist playlist={pl} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditPlaylist({ playlist, open, onClose }: { playlist: Playlist; open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [isPrivate, setPrivate] = useState(playlist.is_private);
  const [cover, setCover] = useState(playlist.cover_image_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setCover((await uploadMedia(file, 'playlist')).url);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updatePlaylist(playlist.id, {
        name: name.trim(),
        description: description.trim() || null,
        is_private: isPrivate,
        cover_image_url: cover,
      });
      void client.invalidateQueries({ queryKey: keys.playlist(playlist.id) });
      void client.invalidateQueries({ queryKey: keys.myPlaylists });
      toast('Playlist saved', 'success');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deletePlaylist(playlist.id);
      void client.invalidateQueries({ queryKey: keys.myPlaylists });
      toast('Playlist deleted');
      navigate('/library?tab=playlists');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit playlist">
      <div className="flex gap-4">
        <label className="group relative h-28 w-28 shrink-0 cursor-pointer">
          <Cover src={cover} title={name} className="h-28 w-28" rounded="rounded-2xl" />
          <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-xl opacity-0 transition group-hover:opacity-100">
            {uploading ? '…' : <LuImage />}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickCover(e.target.files?.[0])} />
        </label>
        <div className="flex-1 space-y-3">
          <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <Textarea className="mt-4" label="Description" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      <div className="mt-4">
        <Checkbox checked={isPrivate} onChange={setPrivate}>Private: only you can see it</Checkbox>
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="danger" icon={<LuTrash2 />} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}>
          {confirmDelete ? 'Delete for good' : 'Delete'}
        </Button>
        <Button variant="primary" className="flex-1" loading={saving} disabled={!name.trim() || uploading} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
