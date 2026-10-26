import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LuBadgeCheck,
  LuCheck,
  LuClock,
  LuCopy,
  LuEar,
  LuFingerprint,
  LuFlame,
  LuGem,
  LuShare2,
  LuSprout,
  LuStar,
  LuUpload,
} from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { SignedOut } from '../components/auth/SignedOut';
import { FoundingBadge, FoundingCardDialog } from '../components/growth/Founding';
import { LinksEditor, linksValid } from '../components/music/Links';
import { Verified } from '../components/music/Verified';
import { Button, Checkbox, Cover, Input, LoadError, Skeleton, Step, Textarea } from '../components/ui';
import { keys, useFounding, useMyApplications, useUserSongs } from '../hooks/data';
import { useTitle } from '../hooks/useTitle';
import { api, type Account, type Application, type ApplicationKind, type ApplicationTrack, type Song } from '../lib/api';
import { ago, count } from '../lib/format';
import { markDecisionSeen } from '../lib/growth';
import { ARTIST_PLATFORMS, PLATFORMS, presentLinks, tidyLink, type Links, type Platform } from '../lib/platforms';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';

const MIN_ABOUT = 40;
const MAX_ABOUT = 800;
const MAX_SONGS = 3;
// The same rule as the database: a full web address.
const WEB = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:443)?([/?#][^\s"'<>\\]*)?$/i;

const TRACKS: { id: ApplicationTrack; icon: ReactNode; title: string; text: string }[] = [
  {
    id: 'emerging',
    icon: <LuSprout />,
    title: 'I’m new or growing',
    text: 'Show us the music is yours, and let listeners who’ve never heard of you decide.',
  },
  {
    id: 'known',
    icon: <LuStar />,
    title: 'I’m already known',
    text: 'You have fans elsewhere. Prove it’s you, and you’re verified at the same time.',
  },
];

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('card relative overflow-hidden p-5 sm:p-7', className)}>{children}</div>;
}

/** The team's words, set apart. */
function TeamNote({ text }: { text: string }) {
  return (
    <blockquote className="mt-4 rounded-2xl border-l-2 border-teal bg-line/[0.04] px-4 py-3 text-[14.5px] leading-6 text-ink/90">
      {text}
      <span className="mt-1.5 block text-[12px] text-faint">The Wavee team</span>
    </blockquote>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Press and hold the code to copy it', 'info');
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal/[0.06] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-teal">Your code</p>
        <p className="mt-0.5 select-all truncate font-mono text-[19px] font-semibold tracking-wide sm:text-[21px]">{code}</p>
      </div>
      <Button size="sm" variant="secondary" icon={copied ? <LuCheck /> : <LuCopy />} onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

/** Up to three of their songs, in the order they're chosen. */
function SongChooser({ songs, picked, onChange }: { songs: Song[]; picked: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    if (picked.includes(id)) onChange(picked.filter((x) => x !== id));
    else if (picked.length < MAX_SONGS) onChange([...picked, id]);
    else toast('Up to three: your best.', 'info');
  };
  return (
    <ul className="space-y-2">
      {songs.map((s) => {
        const n = picked.indexOf(s.id);
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={n >= 0}
              onClick={() => toggle(s.id)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition',
                n >= 0 ? 'border-teal/50 bg-teal/[0.07]' : 'border-line/10 bg-line/[0.03] hover:border-line/25',
              )}
            >
              <Cover src={s.cover_image_url} title={s.title} className="h-12 w-12" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.title}</span>
                <span className="block text-[12px] text-faint">
                  {count(s.plays_count)} plays · {ago(s.created_at)}
                </span>
              </span>
              <span
                className={clsx(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold',
                  n >= 0 ? 'bg-teal text-bg' : 'border border-line/20',
                )}
              >
                {n >= 0 ? n + 1 : ''}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** For the side: how founding artists are chosen, or what Verified means. */
function Why({ kind, cap }: { kind: ApplicationKind; cap: number }) {
  const rows: [ReactNode, string, string][] =
    kind === 'founding'
      ? [
          [<LuFingerprint key="f" />, 'It’s yours', 'We check: your code on a profile that carries your music, or you making it on video.'],
          [<LuEar key="e" />, 'People love it', 'We look at what listeners who’ve never heard of you do: do they finish it, come back, save it?'],
          [<LuFlame key="l" />, 'You’re serious', 'You release, you perform, you build. And you’ll bring your fans with you.'],
        ]
      : [
          [<LuBadgeCheck key="b" />, 'Identity only', 'The tick says this account really is the artist it names. It’s never for sale.'],
          [<LuFingerprint key="f" />, 'Proved, not claimed', 'Your code in the bio of an official account shows the account is yours.'],
          [<LuStar key="s" />, 'For known artists', 'For artists with fans elsewhere, who someone could pretend to be.'],
        ];
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="card p-5 sm:p-6">
        <p className="label">{kind === 'founding' ? 'How we choose' : 'What Verified means'}</p>
        <ul className="mt-4 space-y-4">
          {rows.map(([icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-line/[0.07] text-[17px] text-teal">{icon}</span>
              <span>
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-line/[0.08] pt-4 text-[12.5px] leading-5 text-faint">
          {kind === 'founding'
            ? `The Wavee team reads every application, usually within a week. ${cap} artists, chosen by hand.`
            : 'The Wavee team checks every request by hand, usually within a few days.'}
        </p>
      </div>
    </aside>
  );
}

function ApplyForm({
  kind,
  app,
  code,
  account,
  songs,
}: {
  kind: ApplicationKind;
  app: Application | null;
  code: string;
  account: Account;
  songs: Song[] | undefined;
}) {
  const client = useQueryClient();
  const editing = app?.status === 'pending';
  const [track, setTrack] = useState<ApplicationTrack>(app?.track ?? 'emerging');
  const [name, setName] = useState(app?.artist_name ?? account.display_name ?? account.username);
  const [picked, setPicked] = useState<string[]>(app?.songs ?? []);
  const [links, setLinks] = useState<Links>(app?.links ?? account.links ?? {});
  const [codeOn, setCodeOn] = useState<Platform | null>(app?.code_on ?? null);
  const [makingOf, setMakingOf] = useState(app?.making_of ?? '');
  const [about, setAbout] = useState(app?.about ?? '');
  const [audience, setAudience] = useState(app?.audience ?? '');
  const [promise, setPromise] = useState(editing);
  const [busy, setBusy] = useState(false);

  const known = kind === 'verified' || track === 'known';
  const listed = presentLinks(links, ARTIST_PLATFORMS).map(([p]) => p);
  // The code's place is forgotten when its link is cleared.
  const where = codeOn && links[codeOn] ? codeOn : null;
  const video = makingOf.trim() ? tidyLink(makingOf) : '';
  // Songs that were removed since drop out.
  const chosen = picked.filter((id) => !songs || songs.some((s) => s.id === id));
  const aboutLength = about.trim().length;

  const missing =
    !name.trim()
      ? 'Add the name you release music under.'
      : kind === 'founding' && !chosen.length
        ? 'Choose at least one of your songs.'
        : !linksValid(links)
          ? 'One of your links isn’t right.'
          : video && !WEB.test(video)
            ? 'The video link should be a full web address.'
            : known && !where
              ? 'Put your code in the bio of an official account, then choose it.'
              : !known && !where && !video
                ? 'Show us the music is yours: your code on a profile, or a video.'
                : aboutLength < MIN_ABOUT
                  ? 'Tell us a little more about you: a few sentences.'
                  : !promise
                    ? 'Tick the promise to send it.'
                    : null;

  const send = async () => {
    setBusy(true);
    try {
      await api.submitApplication({
        kind,
        track: known ? 'known' : 'emerging',
        artistName: name.trim(),
        songs: kind === 'founding' ? chosen : [],
        links,
        codeOn: where,
        makingOf: known ? '' : video,
        about: about.trim(),
        audience: audience.trim(),
        promise,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.myApplications }),
        client.invalidateQueries({ queryKey: keys.founding }),
      ]);
      toast(editing ? 'Changes saved' : 'Sent. The team will read it soon.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  let n = 0;
  return (
    <div className="space-y-5">
      {kind === 'founding' && (
        <Step n={++n} title="Where you are" done>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={track === t.id}
                onClick={() => setTrack(t.id)}
                className={clsx(
                  'rounded-2xl border p-4 text-left transition',
                  track === t.id ? 'border-teal/60 bg-teal/[0.07]' : 'border-line/10 bg-line/[0.03] hover:border-line/25',
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className={clsx('text-[18px]', track === t.id ? 'text-teal' : 'text-muted')}>{t.icon}</span>
                  {t.title}
                </span>
                <span className="mt-1.5 block text-[13px] leading-5 text-muted">{t.text}</span>
              </button>
            ))}
          </div>
        </Step>
      )}

      <Step n={++n} title={kind === 'founding' ? 'Your music' : 'Your name'} done={!!name.trim() && (kind !== 'founding' || chosen.length > 0)}>
        <Input
          label="The name you release music under"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        {kind === 'founding' && (
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-medium text-muted">Your best songs on Wavee (up to three, best first)</p>
            {songs === undefined ? (
              <Skeleton className="h-36 w-full rounded-2xl" />
            ) : songs.length ? (
              <>
                <SongChooser songs={songs} picked={chosen} onChange={setPicked} />
                <p className="mt-3 text-[12.5px] leading-5 text-faint">
                  What listeners do with these songs is part of how we choose, most of all people who’ve never heard of
                  you: your first three songs on Wavee are each played to 25 of them in the feed.
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-line/15 p-5 text-center">
                <p className="text-[14px] text-muted">Founding artists have music on Wavee. Upload your best song first, then come back.</p>
                <Link to="/upload" className="mt-4 inline-block">
                  <Button variant="secondary" icon={<LuUpload />}>
                    Upload a song
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </Step>

      <Step n={++n} title={known ? 'Prove it’s you' : 'Show us it’s yours'} done={known ? !!where : !!where || !!video}>
        <CodeBox code={code} />
        <p className="mt-3 text-[13.5px] leading-6 text-muted">
          {known
            ? 'Add this code to the bio of an official account, one your fans follow. Leave it there until we’ve looked, then take it off.'
            : 'Add this code to the bio of one of your profiles that carries your music (Spotify for Artists, Audiomack, YouTube, Instagram, TikTok…). Leave it there until we’ve looked, then take it off.'}
        </p>
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-muted">Where we can find you</p>
          <LinksEditor platforms={ARTIST_PLATFORMS} value={links} onChange={setLinks} collapsedAfter={6} />
        </div>
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-muted">Where did you put the code?</p>
          {listed.length ? (
            <div className="flex flex-wrap gap-2">
              {listed.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={where === p}
                  onClick={() => setCodeOn(where === p ? null : p)}
                  className={clsx(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition',
                    where === p ? 'border-teal/60 bg-teal/[0.1] text-ink' : 'border-line/10 bg-line/[0.04] text-muted hover:text-ink',
                  )}
                >
                  <span className="text-[15px]" style={{ color: PLATFORMS[p].color }}>
                    {PLATFORMS[p].icon}
                  </span>
                  {PLATFORMS[p].label}
                  {where === p && <LuCheck className="text-teal" />}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-faint">Add the profile above first.</p>
          )}
        </div>
        {!known && (
          <Input
            className="mt-5"
            label={where ? 'A video of you making or performing one of these songs (optional)' : 'Or: a video of you making or performing one of these songs'}
            hint="Instagram, TikTok, YouTube or a Google Drive link: in the studio, the project open on screen, or live."
            placeholder="https://"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={makingOf}
            maxLength={300}
            error={video && !WEB.test(video) ? 'That should be a full web address, starting with https://' : null}
            onChange={(e) => setMakingOf(e.target.value)}
          />
        )}
      </Step>

      <Step n={++n} title="About you" done={aboutLength >= MIN_ABOUT}>
        <Textarea
          label={kind === 'founding' ? 'Your story' : 'Who you are'}
          placeholder={
            kind === 'founding'
              ? 'Who you are, how you make your music, what you’ve released, where you perform…'
              : 'Your name, what you’ve released, who manages you, where fans know you from…'
          }
          value={about}
          maxLength={MAX_ABOUT}
          onChange={(e) => setAbout(e.target.value)}
          hint={aboutLength < MIN_ABOUT ? `A few sentences (${aboutLength}/${MIN_ABOUT} characters at least)` : `${aboutLength}/${MAX_ABOUT}`}
        />
        <Input
          className="mt-4"
          label="Your listeners now (optional)"
          placeholder="e.g. 12k on TikTok, 3k monthly listeners on Spotify, shows in Lagos"
          value={audience}
          maxLength={300}
          onChange={(e) => setAudience(e.target.value)}
        />
      </Step>

      <Step n={++n} title="Your word" done={promise}>
        <Checkbox checked={promise} onChange={setPromise}>
          {kind === 'founding'
            ? 'This music is mine: I wrote or performed it, or I have the rights to release it. Everything here is true, and if I’m chosen I’ll share my Wavee link with my fans.'
            : 'These accounts are mine or my team’s, and everything here is true.'}
        </Checkbox>
        <p className="mt-3 text-[12.5px] leading-5 text-faint">
          The team reads every application. The answer shows on this page, and we may email you at{' '}
          <span className="text-muted">{account.email}</span>.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button variant="brand" size="lg" disabled={!!missing} loading={busy} onClick={() => void send()}>
            {editing ? 'Save changes' : kind === 'founding' ? 'Send my application' : 'Ask to be verified'}
          </Button>
          {missing && <p className="text-[13px] text-muted">{missing}</p>}
        </div>
      </Step>
    </div>
  );
}

/** Where a sent application stands, above the form. */
function Pending({ app }: { app: Application }) {
  const client = useQueryClient();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    setBusy(true);
    try {
      client.setQueryData(keys.myApplications, await api.withdrawApplication(app.kind));
      void client.invalidateQueries({ queryKey: keys.founding });
      toast('Taken back', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mb-5 border-teal/25">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal/15 text-[20px] text-teal">
          <LuClock />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">With the team</h2>
          <p className="mt-1 text-[14px] leading-6 text-muted">
            Sent {ago(app.applied_at)}
            {app.updated_at !== app.applied_at && `, changed ${ago(app.updated_at)}`}. We read every one ourselves,
            usually within a week. You can still change it below.
          </p>
          <div className="mt-3">
            {sure ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="danger" loading={busy} onClick={() => void withdraw()}>
                  Take it back
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSure(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => setSure(true)} className="text-[13px] text-faint hover:text-ink">
                Take my application back
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Header({ kind, cap }: { kind: ApplicationKind; cap: number }) {
  return (
    <header className="mb-8 mt-2 max-w-2xl">
      <p className="label">{kind === 'founding' ? 'Founding artists' : 'Verification'}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">{kind === 'founding' ? 'Apply to be a founding artist' : 'Get verified'}</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted">
        {kind === 'founding'
          ? `Founding artists are chosen, not first come. We pick ${cap} by hand: artists whose music is theirs, and that listeners love.`
          : 'The tick next to your name tells fans it’s really you. It’s free, it’s never for sale, and it takes a code on one of your official accounts.'}
      </p>
    </header>
  );
}

/** Apply for a founding artist spot (/founding/apply) or ask for the Verified badge (/verify). */
export function Apply({ kind }: { kind: ApplicationKind }) {
  useTitle(kind === 'founding' ? 'Apply: founding artist' : 'Get verified');
  const session = useAuth((s) => s.session);
  const account = useAuth((s) => s.account);
  const mine = useMyApplications();
  const status = useFounding();
  const songs = useUserSongs(kind === 'founding' ? account?.id : undefined).data;
  const [card, setCard] = useState(false);
  const app = mine.data?.[kind] ?? null;
  const cap = status.data?.artists.cap ?? 30;

  // Once they've been here, Home stops pointing at the decision.
  useEffect(() => {
    if (app?.decided_at) markDecisionSeen(app.decided_at);
  }, [app?.decided_at]);

  if (!session) {
    return (
      <SignedOut
        icon={kind === 'founding' ? <LuGem /> : <LuBadgeCheck />}
        title={kind === 'founding' ? 'Apply to be a founding artist' : 'Get verified'}
        text="Applications come from your Wavee account, so the team can hear your music and reply."
        next={kind === 'founding' ? '/founding/apply' : '/verify'}
      />
    );
  }
  if (mine.isError) return <LoadError what="your application" onRetry={() => void mine.refetch()} />;
  if (!account || !mine.data || !status.data) {
    return (
      <div className="animate-rise">
        <Header kind={kind} cap={cap} />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  const s = status.data;
  const spot = s.me?.role === 'artist' ? s.me : null;
  const waitUntil = app?.status === 'not_yet' && app.again_at && new Date(app.again_at) > new Date() ? app.again_at : null;
  const full = !s.open || s.artists.taken >= s.artists.cap;

  let body: ReactNode;
  if (kind === 'founding' && spot) {
    body = (
      <Card>
        <div className={clsx('pointer-events-none absolute inset-0 opacity-60', 'bg-[radial-gradient(70%_100%_at_0%_0%,rgba(231,163,62,0.22),transparent_60%)]')} />
        <div className="relative">
          <FoundingBadge founding={spot} className="text-[13px]" />
          <h2 className="mt-4 text-2xl">You’re a founding artist.</h2>
          {app?.message ? (
            <TeamNote text={app.message} />
          ) : (
            <p className="mt-2 max-w-xl text-[15px] leading-7 text-muted">Your number is yours for good. Thank you for building Wavee with us.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="brand" icon={<LuShare2 />} onClick={() => setCard(true)}>
              Share your badge
            </Button>
            <Link to="/founding">
              <Button variant="secondary">The Founding 100</Button>
            </Link>
          </div>
        </div>
        <FoundingCardDialog founding={spot} open={card} onClose={() => setCard(false)} />
      </Card>
    );
  } else if (kind === 'verified' && mine.data.is_verified) {
    body = (
      <Card>
        <Verified className="h-12 w-12" />
        <h2 className="mt-4 text-2xl">You’re verified.</h2>
        {app?.message ? (
          <TeamNote text={app.message} />
        ) : (
          <p className="mt-2 text-[15px] leading-7 text-muted">Fans can tell your account from anyone pretending to be you.</p>
        )}
        <Link to={`/u/${account.username}`} className="mt-5 inline-block">
          <Button variant="secondary">See your page</Button>
        </Link>
      </Card>
    );
  } else if (app && waitUntil) {
    body = (
      <Card>
        <h2 className="text-2xl">Not yet</h2>
        <p className="mt-2 text-[15px] leading-7 text-muted">
          Thank you for applying. This time it isn’t a yes, and here’s why:
        </p>
        {app.message && <TeamNote text={app.message} />}
        <p className="mt-4 text-[14px] leading-6 text-muted">
          You can apply again from <b className="text-ink">{longDate(waitUntil)}</b>. Until then: keep releasing, share your
          songs, and read what listeners tell you in{' '}
          <Link to="/stats" className="link">
            your stats
          </Link>
          .
        </p>
      </Card>
    );
  } else if (kind === 'founding' && full && app?.status !== 'pending') {
    body = (
      <Card>
        <h2 className="text-2xl">{s.open ? 'All the founding artist spots are taken.' : 'The founding spots are closed.'}</h2>
        <p className="mt-2 text-[15px] leading-7 text-muted">
          Wavee is still free for every artist: upload, get your first listens, and climb the charts. Already known
          elsewhere? You can still get verified.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/upload">
            <Button variant="brand" icon={<LuUpload />}>
              Upload a song
            </Button>
          </Link>
          <Link to="/verify">
            <Button variant="secondary" icon={<LuBadgeCheck />}>
              Get verified
            </Button>
          </Link>
        </div>
      </Card>
    );
  } else {
    body = (
      <>
        {app?.status === 'pending' && <Pending app={app} />}
        {app?.status === 'not_yet' && (
          <Card className="mb-5">
            <h2 className="text-lg">You can apply again</h2>
            <p className="mt-1 text-[14px] leading-6 text-muted">Last time the team said:</p>
            {app.message && <TeamNote text={app.message} />}
          </Card>
        )}
        <ApplyForm key={app?.updated_at ?? 'new'} kind={kind} app={app} code={mine.data.code} account={account} songs={songs} />
        {kind === 'verified' && (
          <p className="mt-6 text-[13px] text-faint">
            Want a founding spot too?{' '}
            <Link to="/founding/apply" className="link">
              Apply as a founding artist
            </Link>
            : known artists chosen there are verified at the same time.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="animate-rise pb-6">
      <Header kind={kind} cap={cap} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">{body}</div>
        <Why kind={kind} cap={cap} />
      </div>
    </div>
  );
}
