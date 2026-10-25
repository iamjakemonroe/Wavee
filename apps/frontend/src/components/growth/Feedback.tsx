import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { LuMessageSquareHeart } from 'react-icons/lu';
import { keys } from '../../hooks/data';
import { api, type Feedback, type FeedbackSummary, type FeedbackTag, type Song } from '../../lib/api';
import { ago, artistName } from '../../lib/format';
import { FEEDBACK, feedbackLabel } from '../../lib/growth';
import { usePlayer } from '../../store/player';
import { toast } from '../../store/toast';
import { Button, Cover, Modal, Spinner, Textarea } from '../ui';

const MAX_TAGS = 4;

function Tag({ label, on, good, onClick }: { label: string; on: boolean; good: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        'h-9 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[0.97]',
        on
          ? good
            ? 'border-teal/60 bg-teal/15 text-teal'
            : 'border-warn/60 bg-warn/15 text-warn'
          : 'border-line/10 bg-line/[0.04] text-ink/80 hover:bg-line/[0.08]',
      )}
    >
      {label}
    </button>
  );
}

/** The sheet's body: mounted fresh each time it opens, with what you said before. */
function FeedbackBody({ song, before, onDone }: { song: Song; before: Feedback | null; onDone: () => void }) {
  const client = useQueryClient();
  const [tags, setTags] = useState<FeedbackTag[]>(before?.tags ?? []);
  const [note, setNote] = useState(before?.note ?? '');
  const [sending, setSending] = useState(false);

  const flip = (tag: FeedbackTag) =>
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : t.length >= MAX_TAGS ? t : [...t, tag]));

  const send = async () => {
    setSending(true);
    try {
      const listened = usePlayer.getState().listenedTo(song.id);
      const saved = await api.giveFeedback(song.id, tags, note.trim(), listened);
      client.setQueryData(keys.myFeedback(song.id), saved);
      toast(`Sent to ${artistName(song)}`, 'success');
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-line/[0.04] p-3">
        <Cover src={song.cover_image_url} title={song.title} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{song.title}</p>
          <p className="truncate text-[13px] text-muted">{artistName(song)}</p>
        </div>
      </div>
      <p className="label mb-2.5">What worked</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK.filter((f) => f.good).map((f) => (
          <Tag key={f.tag} label={f.label} good on={tags.includes(f.tag)} onClick={() => flip(f.tag)} />
        ))}
      </div>
      <p className="label mb-2.5 mt-5">What could be better</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK.filter((f) => !f.good).map((f) => (
          <Tag key={f.tag} label={f.label} good={false} on={tags.includes(f.tag)} onClick={() => flip(f.tag)} />
        ))}
      </div>
      <Textarea
        className="mt-5"
        rows={3}
        maxLength={280}
        placeholder="Anything else? The line you loved, the moment it lost you… (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="mt-2 text-[12px] leading-5 text-faint">
        Only {artistName(song)} sees this, and not who sent it. Be honest and kind: it’s someone’s music.
      </p>
      <Button
        variant="brand"
        className="mt-5 w-full"
        loading={sending}
        disabled={!tags.length && !note.trim()}
        onClick={() => void send()}
      >
        {before ? 'Update my feedback' : 'Send to the artist'}
      </Button>
    </div>
  );
}

/** Tell an artist what worked, privately: a few taps and a line. */
export function FeedbackDialog({ song, open, onClose }: { song: Song; open: boolean; onClose: () => void }) {
  const mine = useQuery({
    queryKey: keys.myFeedback(song.id),
    queryFn: () => api.myFeedback(song.id),
    enabled: open,
    retry: false,
  });
  return (
    <Modal open={open} onClose={onClose} title="Feedback for the artist">
      {mine.isLoading ? (
        <Spinner className="mx-auto my-10 block h-6 w-6 text-muted" />
      ) : (
        <FeedbackBody song={song} before={mine.data ?? null} onDone={onClose} />
      )}
    </Modal>
  );
}

/** What listeners said about a song, for its artist (in the Stats sheet). */
export function FeedbackSummaryView({ songId }: { songId: string }) {
  const summary = useQuery({
    queryKey: keys.feedbackSummary(songId),
    queryFn: () => api.feedbackSummary(songId),
    retry: false,
  });
  const s: FeedbackSummary | undefined = summary.data;
  if (summary.isLoading) return <Spinner className="mx-auto my-6 block h-5 w-5 text-muted" />;
  if (!s) return null;
  const ranked = FEEDBACK.filter((f) => s.tags[f.tag]).sort((a, b) => (s.tags[b.tag] ?? 0) - (s.tags[a.tag] ?? 0));
  const top = Math.max(1, ...ranked.map((f) => s.tags[f.tag] ?? 0));
  return (
    <div className="mt-6">
      <p className="label mb-3 flex items-center gap-1.5">
        <LuMessageSquareHeart className="text-[14px]" /> What listeners said
      </p>
      {!s.count ? (
        <p className="rounded-2xl bg-line/[0.04] p-4 text-[13.5px] leading-6 text-muted">
          No feedback yet. Listeners can send it from the song’s menu after hearing it; share the song and ask your fans
          what they think.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted">
            From {s.count} {s.count === 1 ? 'listener' : 'listeners'}, anonymously.
          </p>
          <div className="space-y-2">
            {ranked.map((f) => (
              <div key={f.tag} className="flex items-center gap-3 text-[13.5px]">
                <span className="w-40 shrink-0 truncate">{f.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/10">
                  <span
                    className={clsx('block h-full rounded-full', f.good ? 'bg-teal' : 'bg-warn')}
                    style={{ width: `${((s.tags[f.tag] ?? 0) / top) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right tabular-nums text-muted">{s.tags[f.tag]}</span>
              </div>
            ))}
          </div>
          {s.notes.length > 0 && (
            <div className="mt-4 space-y-2">
              {s.notes.map((n, i) => (
                <blockquote key={i} className="rounded-2xl bg-line/[0.04] p-3.5 text-[13.5px] leading-6">
                  “{n.note}”
                  <footer className="mt-1 text-[11.5px] text-faint">
                    {[...n.tags.map(feedbackLabel), ago(n.at)].join(' · ')}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
