import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LuImage } from 'react-icons/lu';
import { HookPicker } from '../components/music/HookPicker';
import { LinksEditor, linksValid } from '../components/music/Links';
import { Button, Checkbox, Cover, Input, Modal, Select, Textarea } from '../components/ui';
import { keys, patchSong, useSong } from '../hooks/data';
import { api, type Song } from '../lib/api';
import { GENRES } from '../lib/format';
import { deleteMedia, uploadMedia } from '../lib/media';
import { SONG_PLATFORMS, type Links } from '../lib/platforms';
import { toast } from '../store/toast';

/** Change a song's details or cover after it's up. */
export function EditSong({ song, onClose }: { song: Song; onClose: () => void }) {
  const client = useQueryClient();
  const [title, setTitle] = useState(song.title);
  const [genre, setGenre] = useState(song.genre);
  const [description, setDescription] = useState(song.description ?? '');
  const [explicit, setExplicit] = useState(song.explicit);
  const [hook, setHook] = useState<number | null>(song.hook_start ?? null);
  // Lists don't carry a song's links: read them from the song itself.
  const full = useSong(song.id);
  const [links, setLinks] = useState<Links | null>(null);
  useEffect(() => {
    if (full.data && links === null) setLinks(full.data.links ?? {});
  }, [full.data, links]);
  // Older songs were saved without their length: learn it from the file (and keep it).
  const [length, setLength] = useState<number | null>(song.duration_seconds);
  useEffect(() => {
    if (length) return;
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) setLength(Math.round(probe.duration));
    };
    probe.src = song.audio_url;
    return () => {
      probe.onloadedmetadata = null;
      probe.removeAttribute('src');
    };
  }, [length, song.audio_url]);
  const [cover, setCover] = useState<{ url: string; key: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      if (cover) void deleteMedia([cover.key]);
      setCover(await uploadMedia(file, 'cover'));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const changes = {
        title: title.trim(),
        genre,
        description: description.trim() || null,
        explicit,
        ...(hook !== (song.hook_start ?? null) ? { hook_start: hook !== null && length && hook < length ? hook : null } : {}),
        ...(!song.duration_seconds && length ? { duration_seconds: length } : {}),
        ...(links && JSON.stringify(links) !== JSON.stringify(full.data?.links ?? {}) ? { links } : {}),
        ...(cover ? { cover_image_url: cover.url, cover_key: cover.key } : {}),
      };
      await api.updateSong(song.id, changes);
      patchSong(client, song.id, {
        title: changes.title,
        genre,
        description: changes.description,
        explicit,
        hook_start: 'hook_start' in changes ? (changes.hook_start ?? null) : (song.hook_start ?? null),
        ...(changes.duration_seconds ? { duration_seconds: changes.duration_seconds } : {}),
        ...(cover ? { cover_image_url: cover.url } : {}),
      });
      void client.invalidateQueries({ queryKey: keys.song(song.id) });
      toast('Song updated', 'success');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    // A cover picked but not saved isn't needed.
    if (cover && !saving) void deleteMedia([cover.key]);
    onClose();
  };

  return (
    <Modal open onClose={close} title="Edit song">
      <div className="flex gap-4">
        <label className="group relative h-28 w-28 shrink-0 cursor-pointer">
          <Cover src={cover?.url ?? song.cover_image_url} title={title} className="h-28 w-28" rounded="rounded-2xl" />
          <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-xl opacity-0 transition group-hover:opacity-100">
            {uploading ? '…' : <LuImage />}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickCover(e.target.files?.[0])} />
        </label>
        <div className="flex-1 space-y-3">
          <Input label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 space-y-4">
        <Select label="Genre" value={genre} onChange={setGenre} options={GENRES.includes(genre as (typeof GENRES)[number]) ? GENRES : [genre, ...GENRES]} />
        <Textarea label="About this song" value={description} maxLength={1000} rows={4} onChange={(e) => setDescription(e.target.value)} />
        <Checkbox checked={explicit} onChange={setExplicit}>Explicit lyrics</Checkbox>
        {length ? (
          <div>
            <p className="mb-3 text-[13px] font-medium text-muted">The hook: where the feed starts it</p>
            <HookPicker src={song.audio_url} length={length} value={hook} onChange={setHook} />
          </div>
        ) : null}
        <div>
          <p className="mb-3 text-[13px] font-medium text-muted">Also on</p>
          {links ? (
            <LinksEditor platforms={SONG_PLATFORMS} value={links} onChange={setLinks} collapsedAfter={4} />
          ) : (
            <p className="text-[13px] text-faint">Loading…</p>
          )}
        </div>
      </div>
      <Button variant="primary" className="mt-6 w-full" loading={saving} disabled={!title.trim() || uploading || (links !== null && !linksValid(links))} onClick={() => void save()}>
        Save changes
      </Button>
    </Modal>
  );
}
