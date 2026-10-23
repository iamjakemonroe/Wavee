import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { LuCheck, LuFilm, LuImage, LuMusic, LuRefreshCw, LuUpload, LuX } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { FeaturePicker, type Person } from '../components/music/FeaturePicker';
import { GenrePicker } from '../components/music/GenrePicker';
import { HookPicker } from '../components/music/HookPicker';
import { LinksEditor, linksValid } from '../components/music/Links';
import { Avatar, Button, Checkbox, Cover, EmptyState, Input, Textarea } from '../components/ui';
import { keys } from '../hooks/data';
import { api } from '../lib/api';
import { duration } from '../lib/format';
import { checkFile, deleteMedia, MEDIA_LIMITS, readDuration, uploadMedia, type MediaKind, type Uploaded } from '../lib/media';
import { SONG_PLATFORMS, type Links } from '../lib/platforms';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';

/** One file on its way up: picked, uploading (with progress), done or
 * failed. Uploads start the moment a file is picked, so they're usually
 * finished by the time the details are. */
interface Slot {
  file: File;
  preview: string | null;
  progress: number;
  done: Uploaded | null;
  error: string | null;
  cancel: AbortController;
}

function useSlot(kind: MediaKind, keep: { current: boolean }) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const current = useRef<Slot | null>(null);
  const uploaded = useRef<string[]>([]);

  // Leaving without publishing: the upload stops and its files go.
  useEffect(
    () => () => {
      if (keep.current) return;
      current.current?.cancel.abort();
      if (uploaded.current.length) void deleteMedia(uploaded.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = (file: File) => {
    const problem = checkFile(file, kind, true);
    if (problem) {
      toast(problem, 'error');
      return false;
    }
    clear();
    const next: Slot = {
      file,
      preview: kind === 'audio' ? null : URL.createObjectURL(file),
      progress: 0,
      done: null,
      error: null,
      cancel: new AbortController(),
    };
    current.current = next;
    setSlot(next);
    const update = (changes: Partial<Slot>) => {
      if (current.current !== next) return;
      Object.assign(next, changes);
      setSlot({ ...next });
    };
    uploadMedia(file, kind, (progress) => update({ progress }), next.cancel.signal)
      .then((done) => {
        uploaded.current.push(done.key);
        if (current.current !== next) {
          void deleteMedia([done.key]);
          return;
        }
        update({ done, progress: 1 });
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') update({ error: e.message });
      });
    return true;
  };

  const clear = () => {
    const was = current.current;
    if (!was) return;
    was.cancel.abort();
    if (was.preview) URL.revokeObjectURL(was.preview);
    if (was.done) void deleteMedia([was.done.key]);
    current.current = null;
    setSlot(null);
  };

  const retry = () => {
    if (current.current) start(current.current.file);
  };

  return { slot, start, clear, retry };
}

function Drop({
  kind,
  onFile,
  children,
  className,
}: {
  kind: MediaKind;
  onFile: (file: File) => void;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={clsx(
        'cursor-pointer rounded-3xl border border-dashed transition duration-300',
        over ? 'border-teal bg-teal/[0.06]' : 'border-line/15 bg-line/[0.02] hover:border-line/30 hover:bg-line/[0.04]',
        className,
      )}
    >
      {children}
      <input
        ref={input}
        type="file"
        accept={MEDIA_LIMITS[kind].accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Progress({ slot, onRetry, onRemove }: { slot: Slot; onRetry: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="truncate text-ink">{slot.file.name}</span>
          <span className={clsx('shrink-0', slot.error ? 'text-danger' : slot.done ? 'text-teal' : 'text-muted')}>
            {slot.error ? 'Didn’t upload' : slot.done ? 'Uploaded' : `${Math.round(slot.progress * 100)}%`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/[0.08]">
          <div
            className={clsx('h-full rounded-full transition-[width] duration-300', slot.error ? 'bg-danger' : 'bg-gradient-to-r from-teal to-violet')}
            style={{ width: `${Math.max(3, slot.progress * 100)}%` }}
          />
        </div>
        {slot.error && <p className="mt-2 text-[12px] text-danger">{slot.error}</p>}
      </div>
      {slot.error && (
        <button onClick={onRetry} aria-label="Try again" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink">
          <LuRefreshCw />
        </button>
      )}
      <button onClick={onRemove} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-line/[0.06] hover:text-ink">
        <LuX />
      </button>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-base">
        <span
          className={clsx(
            'grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold transition',
            done ? 'bg-teal text-bg' : 'bg-line/[0.08] text-muted',
          )}
        >
          {done ? <LuCheck /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function titleFrom(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function Upload() {
  const session = useAuth((s) => s.session);
  const account = useAuth((s) => s.account);
  const navigate = useNavigate();
  const client = useQueryClient();
  const published = useRef(false);
  const audio = useSlot('audio', published);
  const cover = useSlot('cover', published);
  const video = useSlot('video', published);
  const [title, setTitle] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [explicit, setExplicit] = useState(false);
  const [madeWithAi, setMadeWithAi] = useState(false);
  const [featuring, setFeaturing] = useState<Person[]>([]);
  const [rights, setRights] = useState(false);
  const [length, setLength] = useState<number | null>(null);
  const [hook, setHook] = useState<number | null>(null);
  const [links, setLinks] = useState<Links>({});
  const [listen, setListen] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const uploading = [audio, cover, video].some((s) => s.slot && !s.slot.done && !s.slot.error);

  // A local copy of the track, to preview the hook before it's uploaded.
  useEffect(() => () => {
    if (listen) URL.revokeObjectURL(listen);
  }, [listen]);

  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  if (!session) {
    return (
      <EmptyState
        icon={<LuUpload />}
        title="Share your music with the world"
        text="Create a free account to upload songs, cover art and music videos."
        action={
          <div className="flex gap-3">
            <Link to="/signin?next=/upload"><Button variant="secondary">Sign in</Button></Link>
            <Link to="/signup?next=/upload"><Button variant="brand">Create an account</Button></Link>
          </div>
        }
      />
    );
  }

  const pickAudio = (file: File) => {
    if (!audio.start(file)) return;
    if (!title.trim()) setTitle(titleFrom(file.name));
    setHook(null);
    setListen(URL.createObjectURL(file));
    void readDuration(file).then(setLength);
  };

  const ready =
    !!audio.slot?.done && !!title.trim() && genres.length > 0 && rights && !uploading && !cover.slot?.error && !video.slot?.error && linksValid(links);

  const publish = async () => {
    if (!ready || !audio.slot?.done) return;
    setPublishing(true);
    try {
      const id = await api.createSong({
        title: title.trim(),
        genre: genres[0],
        // A single genre needs only `genre`; several go as `genres` too.
        ...(genres.length > 1 ? { genres } : {}),
        description: description.trim() || null,
        explicit,
        duration_seconds: length,
        audio_url: audio.slot.done.url,
        audio_key: audio.slot.done.key,
        cover_image_url: cover.slot?.done?.url ?? null,
        cover_key: cover.slot?.done?.key ?? null,
        video_url: video.slot?.done?.url ?? null,
        video_key: video.slot?.done?.key ?? null,
        user_id: session.user.id,
        ...(hook !== null && length && hook < length ? { hook_start: hook } : {}),
        ...(Object.keys(links).length ? { links } : {}),
        ...(madeWithAi ? { made_with_ai: true } : {}),
      });
      if (featuring.length) {
        // The song is up either way; asking the featured artists is a second step.
        await api.setSongFeatures(id, featuring.map((p) => p.id)).catch(() =>
          toast('Your song is live, but we couldn’t ask the featured artists. Try again from Edit.', 'error'),
        );
      }
      published.current = true;
      void client.invalidateQueries({ queryKey: keys.userSongs(session.user.id) });
      void client.invalidateQueries({ queryKey: keys.fresh });
      void client.invalidateQueries({ queryKey: keys.feed });
      toast('Your song is live', 'success');
      navigate(`/songs/${id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const name = account?.display_name || account?.username || 'You';

  return (
    <div className="animate-rise">
      <header className="mb-8 mt-2">
        <p className="label">Upload</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Share a new song</h1>
        <p className="mt-2 text-muted">Free, in a few minutes. Your files start uploading as soon as you pick them.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Step n={1} title="Your song" done={!!audio.slot?.done}>
            {audio.slot ? (
              <Progress slot={audio.slot} onRetry={audio.retry} onRemove={audio.clear} />
            ) : (
              <Drop kind="audio" onFile={pickAudio} className="px-6 py-12 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal/25 to-violet/25 text-2xl text-ink">
                  <LuMusic />
                </div>
                <p className="font-medium">Drop your track here, or click to choose</p>
                <p className="mt-1 text-[13px] text-faint">{MEDIA_LIMITS.audio.label}</p>
              </Drop>
            )}
          </Step>

          <Step n={2} title="Details" done={!!title.trim() && genres.length > 0}>
            <div className="space-y-4">
              <Input label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="What’s it called?" />
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">Genres</p>
                <GenrePicker value={genres} onChange={setGenres} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Checkbox checked={explicit} onChange={setExplicit}>Explicit lyrics</Checkbox>
                <Checkbox checked={madeWithAi} onChange={setMadeWithAi}>Made with AI tools (like Suno)</Checkbox>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">Featuring (optional)</p>
                <FeaturePicker value={featuring} onChange={setFeaturing} exclude={session.user.id} />
              </div>
              <Textarea
                label="About this song (optional)"
                value={description}
                maxLength={1000}
                rows={4}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="The story behind it, who you made it with, the lyrics…"
              />
            </div>
          </Step>

          <Step n={3} title="The hook" done={hook !== null}>
            <p className="-mt-2 mb-5 text-[13px] leading-5 text-muted">
              Where does it get good? The feed plays your song from here, so new listeners hear the best part first.
            </p>
            {listen && length ? (
              <HookPicker src={listen} length={length} value={hook} onChange={setHook} />
            ) : (
              <p className="text-[13px] text-faint">Add your track first.</p>
            )}
          </Step>

          <Step n={4} title="Cover art and music video" done={!!cover.slot?.done}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">Cover art (recommended)</p>
                {cover.slot ? (
                  <div className="space-y-3">
                    <img src={cover.slot.preview ?? ''} alt="" className="aspect-square w-full rounded-2xl object-cover" />
                    <Progress slot={cover.slot} onRetry={cover.retry} onRemove={cover.clear} />
                  </div>
                ) : (
                  <Drop kind="cover" onFile={(f) => cover.start(f)} className="grid aspect-square place-items-center p-6 text-center">
                    <span>
                      <LuImage className="mx-auto mb-3 text-2xl text-muted" />
                      <span className="block text-sm font-medium">Add cover art</span>
                      <span className="mt-1 block text-[12px] text-faint">Square works best. {MEDIA_LIMITS.cover.label}</span>
                    </span>
                  </Drop>
                )}
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">Music video (optional)</p>
                {video.slot ? (
                  <div className="space-y-3">
                    <video src={video.slot.preview ?? undefined} muted playsInline controls className="aspect-video w-full rounded-2xl bg-black object-cover" />
                    <Progress slot={video.slot} onRetry={video.retry} onRemove={video.clear} />
                  </div>
                ) : (
                  <Drop kind="video" onFile={(f) => video.start(f)} className="grid aspect-square place-items-center p-6 text-center">
                    <span>
                      <LuFilm className="mx-auto mb-3 text-2xl text-muted" />
                      <span className="block text-sm font-medium">Add a music video</span>
                      <span className="mt-1 block text-[12px] text-faint">{MEDIA_LIMITS.video.label}</span>
                    </span>
                  </Drop>
                )}
              </div>
            </div>
          </Step>

          <Step n={5} title="Also on (optional)" done={Object.keys(links).length > 0}>
            <p className="-mt-2 mb-5 text-[13px] leading-5 text-muted">
              Out on other platforms, or coming soon? Add the links, or a pre-save link such as DistroKid’s HyperFollow,
              and they show on the song’s page.
            </p>
            <LinksEditor platforms={SONG_PLATFORMS} value={links} onChange={setLinks} collapsedAfter={4} />
          </Step>

          <Step n={6} title="Your rights" done={rights}>
            <Checkbox checked={rights} onChange={setRights}>
              I wrote this music or have permission to share it, including any samples, beats, artwork and video. I’ve read the{' '}
              <Link to="/copyright" target="_blank" className="link">copyright policy</Link> and the{' '}
              <Link to="/guidelines" target="_blank" className="link">community guidelines</Link>.
            </Checkbox>
            <p className="mt-3 text-[12px] leading-5 text-faint">
              Uploading someone else’s music without permission can get your account closed. Rights holders can ask us to take a song down.
            </p>
          </Step>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="card overflow-hidden">
            <div className="relative">
              <Cover src={cover.slot?.preview} title={title || 'New song'} className="aspect-square w-full" rounded="rounded-none" />
              <AnimatePresence>
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-[13px] text-white/90"
                  >
                    Uploading…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="p-5">
              <p className="truncate text-lg font-semibold">{title || 'Untitled'}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Avatar src={account?.avatar_url} name={name} className="h-5 w-5 text-[9px]" />
                {name}
              </div>
              <p className="mt-3 text-[13px] text-faint">
                {genres.join(', ') || 'No genre yet'}
                {length ? ` · ${duration(length)}` : ''}
                {explicit ? ' · Explicit' : ''}
                {hook !== null ? ` · Hook at ${duration(hook)}` : ''}
                {video.slot?.done ? ' · With video' : ''}
              </p>
              <Button variant="brand" size="lg" className="mt-5 w-full" disabled={!ready} loading={publishing} onClick={() => void publish()}>
                Publish
              </Button>
              {!ready && (
                <p className="mt-3 text-center text-[12px] text-faint">
                  {!audio.slot
                    ? 'Add your track to begin.'
                    : uploading
                      ? 'Waiting for your files to finish uploading.'
                      : !title.trim()
                        ? 'Give your song a title.'
                        : !genres.length
                          ? 'Pick at least one genre.'
                        : !rights
                          ? 'Confirm you have the rights to share it.'
                          : !linksValid(links)
                            ? 'Fix the links above to continue.'
                            : 'Fix the upload above to continue.'}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
