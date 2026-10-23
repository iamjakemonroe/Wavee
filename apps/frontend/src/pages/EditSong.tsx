import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';
import { Button, Checkbox, Cover, Input, Modal, Select, Textarea } from '../components/ui';
import { keys, patchSong } from '../hooks/data';
import { api, type Song } from '../lib/api';
import { GENRES } from '../lib/format';
import { deleteMedia, uploadMedia } from '../lib/media';
import { toast } from '../store/toast';

/** Change a song's details or cover after it's up. */
export function EditSong({ song, onClose }: { song: Song; onClose: () => void }) {
  const client = useQueryClient();
  const [title, setTitle] = useState(song.title);
  const [genre, setGenre] = useState(song.genre);
  const [description, setDescription] = useState(song.description ?? '');
  const [explicit, setExplicit] = useState(song.explicit);
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
        ...(cover ? { cover_image_url: cover.url, cover_key: cover.key } : {}),
      };
      await api.updateSong(song.id, changes);
      patchSong(client, song.id, {
        title: changes.title,
        genre,
        description: changes.description,
        explicit,
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
      </div>
      <Button variant="primary" className="mt-6 w-full" loading={saving} disabled={!title.trim() || uploading} onClick={() => void save()}>
        Save changes
      </Button>
    </Modal>
  );
}
