import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { LuCheck, LuExternalLink, LuGem, LuImage, LuRadar, LuSearch, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { renderPicksCard } from '../components/growth/cards';
import { FoundingBadge } from '../components/growth/Founding';
import { LinkPills } from '../components/music/Links';
import { PictureDialog } from '../components/music/ShareCard';
import { PlayToggle } from '../components/music/Song';
import { Avatar, Button, Cover, EmptyState, Input, Skeleton, Spinner } from '../components/ui';
import { keys, useCollections, useFounding, usePicks } from '../hooks/data';
import { api, type NewArtist, type PulseWeek, type Song } from '../lib/api';
import { ago, artistName } from '../lib/format';
import { thisMonday, weekLabel } from '../lib/growth';
import { ARTIST_PLATFORMS } from '../lib/platforms';
import { toast } from '../store/toast';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function run<T>(fn: () => Promise<T>, done?: string): Promise<T | undefined> {
  try {
    const out = await fn();
    if (done) toast(done, 'success');
    return out;
  } catch (e) {
    toast((e as Error).message, 'error');
    return undefined;
  }
}

// ── Pulse ────────────────────────────────────────────────────────────────

const COLUMNS: [keyof PulseWeek, string, string][] = [
  ['accounts', 'Accounts', 'New accounts'],
  ['artists', 'Artists', 'Artists whose first song came this week'],
  ['songs', 'Songs', 'Songs uploaded'],
  ['listeners', 'Listeners', 'People who listened 30 s+ to someone else’s song'],
  ['returning', 'Came back', 'Listeners who also listened the week before'],
  ['plays', 'Plays', 'Plays of 30 s+, not the artist’s own'],
  ['new_songs_heard', 'Heard', 'New songs with 5+ listeners in their first week'],
  ['feedback', 'Feedback', 'Feedback sent to artists'],
  ['picks', 'Picks', 'Fresh Finds that week'],
];

/** The numbers that say whether Wavee is working, week by week. */
export function Pulse() {
  const pulse = useQuery({ queryKey: ['admin-pulse'], queryFn: () => api.adminPulse(8) });
  if (pulse.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const p = pulse.data;
  if (!p) return <EmptyState title="Couldn’t load the numbers" />;
  const t = p.totals;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ['Accounts', t.accounts],
            ['Artists with music', t.artists],
            ['Songs live', t.songs],
            ['Founding artists', t.founding_artists],
            ['Founding listeners', t.founding_listeners],
            ['Joined from invites', t.invited],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-line/[0.04] p-4">
            <p className="text-[24px] font-bold leading-none tabular-nums">{value.toLocaleString()}</p>
            <p className="mt-1.5 text-[12px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line/10">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line/10 text-left text-[11.5px] uppercase tracking-wide text-faint">
              <th className="px-3 py-2.5 font-semibold">Week</th>
              {COLUMNS.map(([k, label, title]) => (
                <th key={k} className="px-3 py-2.5 text-right font-semibold" title={title}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.weeks.map((w, i) => (
              <tr key={w.week} className={clsx('border-b border-line/[0.06] last:border-0', i === 0 && 'bg-teal/[0.05]')}>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                  {i === 0 ? 'This week' : new Date(`${w.week}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </td>
                {COLUMNS.map(([k]) => (
                  <td key={k} className="px-3 py-2.5 text-right tabular-nums">
                    {k === 'new_songs_heard' ? `${w.new_songs_heard}/${w.songs}` : (w[k] as number).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-2xl text-[13px] leading-6 text-muted">
        Watch <b className="text-ink">Came back</b> (is the feed good enough to return to?) and <b className="text-ink">Heard</b>{' '}
        (does every new song find listeners?). Fifty people who come back every week beat a thousand accounts that never
        play a song.
      </p>
    </div>
  );
}

// ── New artists ──────────────────────────────────────────────────────────

function NewArtistCard({ a }: { a: NewArtist }) {
  const client = useQueryClient();
  const [note, setNote] = useState(a.welcome_note ?? '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const name = a.user.display_name || a.user.username;
  const act = async (label: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(label);
    await run(fn, done);
    setBusy(null);
    void client.invalidateQueries({ queryKey: ['admin-new-artists'] });
  };
  const fl = a.first_listens;
  return (
    <article className="card p-5">
      <div className="flex items-start gap-4">
        <Link to={`/u/${a.user.username}`}>
          <Avatar src={a.user.avatar_url} name={name} className="h-14 w-14 text-lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <Link to={`/u/${a.user.username}`} className="hover:underline">
              {name}
            </Link>
            {a.founding && <FoundingBadge founding={{ number: a.founding, role: 'artist' }} className="!px-2 !py-0.5 !text-[11px]" />}
            {a.picked && <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-semibold text-teal">Picked</span>}
            {a.welcomed_at && <span className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] font-semibold text-muted">Welcomed {ago(a.welcomed_at)}</span>}
          </p>
          <p className="text-[13px] text-muted">
            @{a.user.username} · first song {ago(a.first_at)} · {a.songs} {a.songs === 1 ? 'song' : 'songs'}
          </p>
          <LinkPills links={a.user.links} order={ARTIST_PLATFORMS} className="mt-2" />
        </div>
      </div>

      {a.song && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-line/[0.04] p-3">
          <div className="relative shrink-0">
            <Cover src={a.song.cover_image_url} title={a.song.title} className="h-12 w-12" />
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/songs/${a.song.id}`} className="block truncate font-medium hover:underline">
              {a.song.title}
            </Link>
            <p className="text-[12px] text-faint">Their first song</p>
          </div>
          <PlayToggle song={a.song} list={[a.song]} index={0} source={`New artist: ${name}`} className="h-10 w-10 text-base" />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-line/[0.04] p-2.5">
          <p className={clsx('text-lg font-bold', a.listeners === 0 && 'text-warn')}>{a.listeners}</p>
          <p className="text-[11px] text-muted">listeners, week 1</p>
        </div>
        <div className="rounded-xl bg-line/[0.04] p-2.5">
          <p className="text-lg font-bold">{fl ? `${fl.reached}/${fl.listeners}` : '–'}</p>
          <p className="text-[11px] text-muted">first listens</p>
        </div>
        <div className="rounded-xl bg-line/[0.04] p-2.5">
          <p className="text-lg font-bold">{a.feedback}</p>
          <p className="text-[11px] text-muted">feedback</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <Input className="min-w-0 flex-1" placeholder="How you welcomed them" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            variant="secondary"
            icon={<LuCheck />}
            loading={busy === 'welcome'}
            onClick={() => void act('welcome', () => api.adminWelcomeArtist(a.user.id, note), `Marked ${name} as welcomed`)}
          >
            {a.welcomed_at ? 'Update' : 'Welcomed'}
          </Button>
        </div>
        {a.song && (
          <div className="flex gap-2">
            <Input className="min-w-0 flex-1" placeholder="Why it’s a Fresh Find (shown to everyone)" value={why} onChange={(e) => setWhy(e.target.value)} />
            <Button
              variant="brand"
              icon={<LuRadar />}
              loading={busy === 'pick'}
              disabled={!why.trim()}
              onClick={() =>
                void act('pick', async () => {
                  await api.adminPick(a.song!.id, why.trim());
                  void client.invalidateQueries({ queryKey: ['picks'] });
                }, 'Added to this week’s Fresh Finds')
              }
            >
              Pick
            </Button>
          </div>
        )}
      </div>
      {!a.founding && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          icon={<LuGem />}
          loading={busy === 'founding'}
          onClick={() => void act('founding', () => api.adminSetFounding(a.user.id, 'artist'), `${name} is a founding artist`)}
        >
          Give a founding artist spot
        </Button>
      )}
    </article>
  );
}

/** Every artist whose first song came in the last month: nobody's first upload goes unheard. */
export function NewArtists() {
  const [days, setDays] = useState(30);
  const list = useQuery({ queryKey: ['admin-new-artists', days], queryFn: () => api.adminNewArtists(days) });
  const waiting = (list.data ?? []).filter((a) => !a.welcomed_at).length;
  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm leading-6 text-muted">
        When an artist joins: check the profile and the song, say hello (Instagram, WhatsApp), put a good song in Fresh
        Finds, and tell them what happened. Artists with no listeners yet are in orange.
      </p>
      <div className="mb-5 flex items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={clsx('h-8 rounded-full px-3.5 text-[13px] font-medium', days === d ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted')}
          >
            {d} days
          </button>
        ))}
        {list.data && <span className="ml-2 text-[13px] text-muted">{waiting} to welcome</span>}
      </div>
      {list.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : list.data?.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {list.data.map((a) => (
            <NewArtistCard key={a.user.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState title="No new artists" text="Nobody uploaded their first song in this time." />
      )}
    </div>
  );
}

// ── Fresh Finds ──────────────────────────────────────────────────────────


/** Pick this week's (or next week's) songs, each with a line on why, then post the story card. */
export function PicksAdmin() {
  const client = useQueryClient();
  const [ahead, setAhead] = useState(false);
  const week = thisMonday(ahead ? 1 : 0);
  const picks = usePicks(week);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [card, setCard] = useState(false);
  const p = picks.data;

  const refresh = () => void client.invalidateQueries({ queryKey: ['picks'] });

  const search = async () => {
    const q = query.trim();
    const id = q.match(UUID)?.[0];
    if (id) {
      const song = await run(() => api.song(id));
      setResults(song ? [song] : []);
    } else if (q.length >= 2) {
      setResults((await run(() => api.searchSongs(q, 12))) ?? []);
    }
  };

  const add = async (song: Song) => {
    const note = (notes[song.id] ?? '').trim();
    const done = await run(() => api.adminPick(song.id, note, p?.week ?? null), `Picked ${song.title}`);
    if (done) {
      refresh();
      setResults((r) => r?.filter((s) => s.id !== song.id) ?? null);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[false, true].map((next) => (
          <button
            key={String(next)}
            type="button"
            onClick={() => setAhead(next)}
            className={clsx('h-8 rounded-full px-3.5 text-[13px] font-medium', ahead === next ? 'bg-ink text-bg' : 'bg-line/[0.06] text-muted')}
          >
            {next ? 'Next week' : 'This week'}
          </button>
        ))}
        {p && <span className="text-[13px] text-muted">{weekLabel(p.week)}</span>}
        <Button size="sm" variant="secondary" className="ml-auto" icon={<LuImage />} disabled={!p?.picks.length} onClick={() => setCard(true)}>
          Story card to post
        </Button>
      </div>

      {picks.isLoading || !p ? (
        <Spinner className="h-6 w-6 text-muted" />
      ) : p.picks.length ? (
        <div className="space-y-2">
          {p.picks.map((x, i) => (
            <div key={x.song.id} className="card flex items-center gap-3 p-3">
              <span className="w-5 text-center text-[13px] text-faint">{i + 1}</span>
              <Cover src={x.song.cover_image_url} title={x.song.title} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {x.song.title} <span className="text-muted">· {artistName(x.song)}</span>
                </p>
                <p className="truncate text-[12.5px] text-muted">{x.note || 'No note yet'}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<LuTrash2 />}
                onClick={() => void run(() => api.adminUnpick(x.song.id, p.week), 'Taken out').then(refresh)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<LuRadar />} title="No picks yet" text="Three to five a week is plenty. Find songs below." />
      )}

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Input className="min-w-0 flex-1" placeholder="Search a song, or paste its link" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" variant="secondary" icon={<LuSearch />}>
          Find
        </Button>
      </form>
      {results && (
        <div className="mt-3 space-y-2">
          {results.length ? (
            results.map((s) => (
              <div key={s.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <Cover src={s.cover_image_url} title={s.title} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-[12.5px] text-muted">{artistName(s)}</p>
                  </div>
                  <Link to={`/songs/${s.id}`} className="text-muted hover:text-ink" aria-label="Open">
                    <LuExternalLink />
                  </Link>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Why it’s a Fresh Find, in one line"
                    maxLength={280}
                    value={notes[s.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                  <Button variant="brand" disabled={!(notes[s.id] ?? '').trim()} onClick={() => void add(s)}>
                    Pick
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Nothing found.</p>
          )}
        </div>
      )}

      {p && card && (
        <PictureDialog
          open={card}
          onClose={() => setCard(false)}
          title="Post this week’s Fresh Finds"
          hint="Post it on Wavee’s WhatsApp Status, Instagram and TikTok, and tag every artist."
          make={() => renderPicksCard(p)}
          name={`wavee-fresh-finds-${p.week}`}
          text="This week’s Fresh Finds on Wavee:"
          link={`${window.location.origin}/picks`}
          alt={`Fresh Finds, ${weekLabel(p.week)}`}
        />
      )}
    </div>
  );
}

// ── Founding 100 and collections ─────────────────────────────────────────

/** Give founding spots by hand (to the artists and listeners you recruit), or take one back. */
export function FoundingAdmin() {
  const client = useQueryClient();
  const status = useFounding().data;
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username), enabled: !!username });
  const p = profile.data;
  const set = async (role: 'artist' | 'listener' | null) => {
    if (!p) return;
    await run(() => api.adminSetFounding(p.id, role), role ? `${p.username} is a founding ${role}` : 'Spot taken back');
    void client.invalidateQueries({ queryKey: ['profile', username] });
    void client.invalidateQueries({ queryKey: keys.founding });
  };
  return (
    <div className="max-w-xl">
      {status && (
        <p className="mb-5 text-sm leading-6 text-muted">
          {status.artists.taken} of {status.artists.cap} artists and {status.listeners.taken} of {status.listeners.cap}{' '}
          listeners so far ({status.open ? 'open' : 'closed'}). Spots you give here go past the limits. To change the limits
          or close it: <code className="text-ink">update wavee_growth set founding_open = false;</code>
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setUsername(query.trim().replace(/^@/, '').toLowerCase());
        }}
      >
        <Input className="min-w-0 flex-1" placeholder="Username" autoCapitalize="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" variant="secondary">
          Look up
        </Button>
      </form>
      {username && (
        <div className="card mt-5 p-5">
          {profile.isLoading ? (
            <Spinner className="h-6 w-6 text-muted" />
          ) : p ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="font-medium">{p.display_name || p.username}</p>
                  <p className="text-[13px] text-muted">
                    @{p.username} · {p.songs_count} songs
                  </p>
                </div>
                {p.founding && <FoundingBadge founding={p.founding} className="ml-auto" />}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="brand" icon={<LuGem />} onClick={() => void set('artist')}>
                  Founding artist
                </Button>
                <Button variant="secondary" icon={<LuGem />} onClick={() => void set('listener')}>
                  Founding listener
                </Button>
                {p.founding && (
                  <Button variant="danger" onClick={() => void set(null)}>
                    Take it back
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Nobody has that username.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Feature public playlists on Home (make them as Wavee's own account: Hidden Gems, New Artists to Watch…). */
export function CollectionsAdmin() {
  const client = useQueryClient();
  const lists = useCollections().data;
  const [link, setLink] = useState('');
  const feature = async (id: string, on: boolean) => {
    const out = await run(() => api.adminFeaturePlaylist(id, on), on ? 'On Home now' : 'Taken off Home');
    if (out) client.setQueryData(keys.collections, out);
  };
  return (
    <div className="max-w-xl">
      <p className="mb-5 text-sm leading-6 text-muted">
        Make the playlist as Wavee’s own account (public), then paste its link here. Ideas: Hidden Gems, Fresh Nigerian
        Sounds, Upcoming Afrobeats, New Artists to Watch, Gospel Rising, Campus Heat.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = link.match(UUID)?.[0];
          if (!id) return toast('Paste a playlist link', 'error');
          void feature(id, true).then(() => setLink(''));
        }}
      >
        <Input className="min-w-0 flex-1" placeholder="Playlist link" value={link} onChange={(e) => setLink(e.target.value)} />
        <Button type="submit" variant="brand">
          Feature
        </Button>
      </form>
      <div className="mt-5 space-y-2">
        {lists?.length ? (
          lists.map((c) => (
            <div key={c.id} className="card flex items-center gap-3 p-3">
              <Cover src={c.cover_image_url ?? c.covers[0] ?? null} title={c.name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <Link to={`/playlists/${c.id}`} className="block truncate font-medium hover:underline">
                  {c.name}
                </Link>
                <p className="text-[12.5px] text-muted">
                  {c.songs_count} songs · by @{c.owner.username}
                </p>
              </div>
              <Button size="sm" variant="ghost" icon={<LuTrash2 />} onClick={() => void feature(c.id, false)}>
                Remove
              </Button>
            </div>
          ))
        ) : (
          <EmptyState title="No collections on Home yet" />
        )}
      </div>
    </div>
  );
}
