import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LuFlag,
  LuImage,
  LuListEnd,
  LuListPlus,
  LuListStart,
  LuEllipsis,
  LuPlus,
  LuShare2,
  LuTrash2,
  LuUser,
} from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { keys, useMyPlaylists } from '../../hooks/data';
import { api, type ReportReason, type Song } from '../../lib/api';
import { deleteMedia } from '../../lib/media';
import { useAuth, withAccount } from '../../store/auth';
import { usePlayer } from '../../store/player';
import { toast } from '../../store/toast';
import { Button, Checkbox, Cover, IconButton, Input, Modal, Spinner, Textarea } from '../ui';
import { ShareCardDialog } from './ShareCard';

interface Item {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

/** A small menu anchored to its button (Escape or a click outside closes it). */
export function Menu({ label, items }: { label: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 230;
    const height = items.length * 44 + 12;
    const below = r.bottom + 6 + height < window.innerHeight;
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - height - 6),
      left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', () => setOpen(false), { once: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <>
      <IconButton
        ref={button}
        label={label}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <LuEllipsis />
      </IconButton>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[80] w-[230px] overflow-hidden rounded-2xl border border-line/10 bg-raised/95 p-1.5 shadow-lift backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={clsx(
                    'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition hover:bg-line/[0.07]',
                    item.danger ? 'text-danger' : 'text-ink',
                  )}
                >
                  <span className="text-[17px] text-muted">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export async function shareSong(song: Song) {
  const url = `${location.origin}/songs/${song.id}`;
  const text = `${song.title} by ${song.artist_display_name || song.artist_username} on Wavee`;
  try {
    if (navigator.share) {
      await navigator.share({ title: song.title, text, url });
      return;
    }
  } catch {
    return; // Closed the share sheet.
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast(url);
  }
}

/** Everything you can do with a song. */
export function SongMenu({
  song,
  extra,
}: {
  song: Song;
  extra?: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[];
}) {
  const navigate = useNavigate();
  const me = useAuth((s) => s.session?.user.id);
  const playNext = usePlayer((s) => s.playNext);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const [adding, setAdding] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [card, setCard] = useState(false);

  const items: Item[] = [
    { label: 'Play next', icon: <LuListStart />, onClick: () => playNext(song) },
    { label: 'Add to queue', icon: <LuListEnd />, onClick: () => addToQueue(song) },
    {
      label: 'Add to playlist',
      icon: <LuListPlus />,
      onClick: () => withAccount('Sign in to make playlists.', () => setAdding(true)),
    },
    { label: 'Share', icon: <LuShare2 />, onClick: () => void shareSong(song) },
    { label: 'Story card', icon: <LuImage />, onClick: () => setCard(true) },
    { label: 'Go to artist', icon: <LuUser />, onClick: () => navigate(`/u/${song.artist_username}`) },
    ...(extra ?? []).map((e) => ({ icon: <LuListEnd />, ...e })),
    ...(me === song.artist_id
      ? [{ label: 'Delete song', icon: <LuTrash2 />, danger: true, onClick: () => setDeleting(true) }]
      : [{ label: 'Report', icon: <LuFlag />, danger: true, onClick: () => setReporting(true) }]),
  ];

  return (
    <>
      <Menu label={`More for ${song.title}`} items={items} />
      <AddToPlaylist song={song} open={adding} onClose={() => setAdding(false)} />
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="song"
        targetId={song.id}
        targetName={song.title}
      />
      <DeleteSong song={song} open={deleting} onClose={() => setDeleting(false)} />
      {card && <ShareCardDialog song={song} open={card} onClose={() => setCard(false)} />}
    </>
  );
}

function AddToPlaylist({ song, open, onClose }: { song: Song; open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const me = useAuth((s) => s.session?.user.id);
  const playlists = useMyPlaylists();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const add = async (playlistId: string, playlistName: string) => {
    setBusy(playlistId);
    try {
      await api.addToPlaylist(playlistId, song.id);
      toast(`Added to ${playlistName}`, 'success');
      void client.invalidateQueries({ queryKey: keys.myPlaylists });
      void client.invalidateQueries({ queryKey: keys.playlistSongs(playlistId) });
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!me || !name.trim()) return;
    setBusy('new');
    try {
      const playlist = await api.createPlaylist(me, name.trim(), null, false);
      await add(playlist.id, playlist.name);
      setName('');
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to playlist">
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-line/[0.04] p-3">
        <Cover src={song.cover_image_url} title={song.title} className="h-12 w-12" rounded="rounded-lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{song.title}</p>
          <p className="truncate text-[13px] text-muted">{song.artist_display_name || song.artist_username}</p>
        </div>
      </div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input
          className="flex-1"
          placeholder="New playlist name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Button variant="primary" type="submit" loading={busy === 'new'} disabled={!name.trim()} icon={<LuPlus />}>
          Create
        </Button>
      </form>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {playlists.isLoading && <Spinner className="mx-auto my-6 block h-6 w-6 text-muted" />}
        {playlists.data?.map((p) => (
          <button
            key={p.id}
            onClick={() => void add(p.id, p.name)}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-line/[0.06]"
          >
            <Cover src={p.cover_image_url} title={p.name} className="h-11 w-11" rounded="rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="text-[12px] text-faint">
                {p.songs_count ?? 0} songs{p.is_private ? ' · Private' : ''}
              </span>
            </span>
            {busy === p.id && <Spinner className="h-4 w-4 text-muted" />}
          </button>
        ))}
        {playlists.data?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">No playlists yet. Name your first one above.</p>
        )}
      </div>
    </Modal>
  );
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'copyright', label: 'It’s my music, used without permission' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Something else' },
];

/** Report a song, person or playlist. Copyright claims ask for the owner's
 * details and a good-faith statement. */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetType: 'song' | 'user' | 'playlist';
  targetId: string;
  targetName: string;
}) {
  const account = useAuth((s) => s.account);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sworn, setSworn] = useState(false);
  const [sending, setSending] = useState(false);
  const copyright = reason === 'copyright';
  const contact = account?.email ?? email;

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await api.submitReport({
        targetType,
        targetId,
        reason,
        details,
        contactEmail: contact || null,
        claimantName: copyright ? name : null,
        sworn: copyright && sworn,
      });
      toast('Thanks. We’ll review it, usually within 48 hours.', 'success');
      onClose();
      setReason(null);
      setDetails('');
      setSworn(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const ready = reason && (!copyright || (name.trim() && contact && sworn && details.trim().length >= 10));

  return (
    <Modal open={open} onClose={onClose} title={`Report “${targetName}”`}>
      <div className="space-y-2">
        {REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={clsx(
              'flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm transition',
              reason === r.value ? 'border-violet/70 bg-violet/10 text-ink' : 'border-line/10 text-muted hover:border-line/25 hover:text-ink',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {reason && (
        <div className="mt-5 space-y-4">
          {copyright && (
            <p className="rounded-xl bg-warn/10 p-3 text-[13px] leading-5 text-warn">
              For copyright claims we need the rights owner’s name, a way to reach you, what work is being used,
              and your statement below. See our <a className="underline" href="/copyright" target="_blank">copyright policy</a>.
            </p>
          )}
          {copyright && (
            <Input label="Your full name (or the rights owner’s)" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          {!account && (
            <Input
              label={copyright ? 'Your email' : 'Your email (optional)'}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <Textarea
            label={copyright ? 'Which work of yours is this, and where can we see the original?' : 'Anything we should know? (optional)'}
            value={details}
            maxLength={2000}
            onChange={(e) => setDetails(e.target.value)}
          />
          {copyright && (
            <Checkbox checked={sworn} onChange={setSworn}>
              I believe in good faith that this use isn’t authorised by the owner, and the information here is
              accurate. I am the owner or am allowed to act for them.
            </Checkbox>
          )}
          <Button variant="primary" className="w-full" disabled={!ready} loading={sending} onClick={() => void send()}>
            Send report
          </Button>
        </div>
      )}
    </Modal>
  );
}

function DeleteSong({ song, open, onClose }: { song: Song; open: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const files = await api.deleteSong(song.id);
      await deleteMedia(files);
      toast('Song deleted', 'success');
      void client.invalidateQueries();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Delete this song?">
      <p className="text-sm text-muted">
        “{song.title}” and its plays, likes and files will be gone for good. This can’t be undone.
      </p>
      <div className="mt-6 flex gap-3">
        <Button className="flex-1" onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" className="flex-1" loading={busy} onClick={() => void remove()}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
