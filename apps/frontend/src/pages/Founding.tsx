import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import {
  LuEar,
  LuGem,
  LuHeadphones,
  LuMessageSquareHeart,
  LuMicVocal,
  LuRadar,
  LuShare2,
  LuSparkles,
  LuUpload,
  LuUserPlus,
} from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { FoundingBadge, FoundingCardDialog, GOLD, InviteDialog } from '../components/growth/Founding';
import { Avatar, Button, Skeleton } from '../components/ui';
import { keys, useFounding, useUserSongs } from '../hooks/data';
import { api, type Founding as FoundingSpot } from '../lib/api';
import { useAuth, withAccount } from '../store/auth';
import { toast } from '../store/toast';

function Meter({ label, taken, cap, icon }: { label: string; taken: number; cap: number; icon: ReactNode }) {
  const left = Math.max(0, cap - taken);
  return (
    <div className="rounded-3xl border border-line/10 bg-line/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <span className="text-[18px] text-[#f0c060]">{icon}</span>
          {label}
        </p>
        <p className="text-[13px] tabular-nums text-muted">
          {taken} of {cap}
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line/10">
        <motion.div
          className={clsx('h-full rounded-full', GOLD)}
          initial={{ width: 0 }}
          animate={{ width: `${cap ? Math.min(100, (taken / cap) * 100) : 0}%` }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.1, 1] }}
        />
      </div>
      <p className="mt-2.5 text-[13px] text-muted">{left ? `${left} ${left === 1 ? 'spot' : 'spots'} left` : 'All taken'}</p>
    </div>
  );
}

function Perk({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-line/10 bg-line/[0.03] p-5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-line/[0.07] text-[19px] text-teal">{icon}</span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1.5 text-[14px] leading-6 text-muted">{children}</p>
    </div>
  );
}

/** Wavee Founding 100: the first 30 artists and 70 listeners, by name and number. The counts are
 * the real ones. */
export function Founding() {
  const status = useFounding();
  const account = useAuth((s) => s.account);
  const signedIn = !!useAuth((s) => s.session);
  const songs = useUserSongs(account?.id).data;
  const client = useQueryClient();
  const [busy, setBusy] = useState<FoundingSpot['role'] | null>(null);
  const [card, setCard] = useState(false);
  const [inviting, setInviting] = useState(false);
  const s = status.data;
  const me = s?.me ?? null;
  const left = s ? Math.max(0, s.artists.cap - s.artists.taken) + Math.max(0, s.listeners.cap - s.listeners.taken) : 0;
  const total = s ? s.artists.cap + s.listeners.cap : 100;

  const claim = (role: FoundingSpot['role']) =>
    withAccount('Make an account to take a founding spot.', async () => {
      setBusy(role);
      try {
        const spot = await api.claimFounding(role);
        await client.invalidateQueries({ queryKey: keys.founding });
        void client.invalidateQueries({ queryKey: ['profile'] });
        toast(`You’re Founding ${role === 'artist' ? 'Artist' : 'Listener'} #${spot.number}`, 'success');
        setCard(true);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setBusy(null);
      }
    });

  const hasSong = !!songs?.length;

  return (
    <div className="animate-rise pb-6">
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pb-10 pt-12 sm:-mx-6 sm:px-6 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_10%_0%,rgba(231,163,62,0.22),transparent_60%),radial-gradient(55%_75%_at_95%_20%,rgb(var(--violet)/0.26),transparent_62%)]" />
        <div className="relative max-w-2xl">
          <p className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#1a1206]', GOLD)}>
            <LuGem /> Wavee Founding {total}
          </p>
          <h1 className="mt-5 text-[40px] leading-[1.04] sm:text-[56px]">
            Build Wavee
            <br />
            <span className="text-brand">from day one.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-7 text-muted">
            Wavee is new, and we’re not pretending otherwise. We’re looking for {s?.artists.cap ?? 30} artists with music
            ready to share and {s?.listeners.cap ?? 70} listeners who love finding it first. Together you shape what Wavee
            becomes, and your profile says you were here first, for good.
          </p>
        </div>
      </section>

      {status.isLoading || !s ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Meter label="Founding artists" icon={<LuMicVocal />} taken={s.artists.taken} cap={s.artists.cap} />
            <Meter label="Founding listeners" icon={<LuHeadphones />} taken={s.listeners.taken} cap={s.listeners.cap} />
          </div>

          <div className="mt-6 rounded-4xl border border-line/10 bg-raised/60 p-6 sm:p-8">
            {me ? (
              <div className="flex flex-col items-start gap-4">
                <FoundingBadge founding={me} className="text-[13px]" />
                <h2 className="text-2xl">You’re one of the founders.</h2>
                <p className="max-w-xl text-[15px] leading-7 text-muted">
                  Thank you for being here first. Share your badge, bring someone who should be here, and tell us what
                  Wavee should do next: <a className="link" href="mailto:wavee@kaivon.app">wavee@kaivon.app</a>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="brand" icon={<LuShare2 />} onClick={() => setCard(true)}>
                    Share your badge
                  </Button>
                  <Button variant="secondary" icon={<LuUserPlus />} onClick={() => setInviting(true)}>
                    Bring someone
                  </Button>
                </div>
              </div>
            ) : !s.open || left === 0 ? (
              <div>
                <h2 className="text-2xl">The founding spots are closed.</h2>
                <p className="mt-2 text-[15px] leading-7 text-muted">
                  Thank you to everyone who built Wavee from day one. Wavee is still free to join: listen, upload, and
                  climb the charts.
                </p>
                <Link to={signedIn ? '/feed' : '/signup'} className="mt-5 inline-block">
                  <Button variant="brand">{signedIn ? 'Start listening' : 'Join Wavee'}</Button>
                </Link>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl">Take your spot</h2>
                <p className="mt-2 max-w-xl text-[15px] leading-7 text-muted">
                  It’s free. Spots are numbered in the order they’re taken, and the number is yours to keep.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-line/10 bg-line/[0.03] p-5">
                    <p className="flex items-center gap-2 font-semibold">
                      <LuMicVocal className="text-teal" /> I make music
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                      {signedIn && !hasSong
                        ? 'Founding artists have a song on Wavee. Upload your best one, then come back.'
                        : 'Singers, rappers, producers, bands, DJs: anyone with a song of their own.'}
                    </p>
                    {signedIn && !hasSong ? (
                      <Link to="/upload" className="mt-4 inline-block">
                        <Button variant="secondary" icon={<LuUpload />}>
                          Upload a song
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="mt-4"
                        variant="brand"
                        loading={busy === 'artist'}
                        disabled={s.artists.taken >= s.artists.cap}
                        onClick={() => claim('artist')}
                      >
                        {s.artists.taken >= s.artists.cap ? 'Artist spots taken' : 'Join as an artist'}
                      </Button>
                    )}
                  </div>
                  <div className="rounded-3xl border border-line/10 bg-line/[0.03] p-5">
                    <p className="flex items-center gap-2 font-semibold">
                      <LuHeadphones className="text-teal" /> I’m here to listen
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-muted">
                      You promise to explore new artists every week and tell them, honestly, what you think.
                    </p>
                    <Button
                      className="mt-4"
                      variant="primary"
                      loading={busy === 'listener'}
                      disabled={s.listeners.taken >= s.listeners.cap}
                      onClick={() => claim('listener')}
                    >
                      {s.listeners.taken >= s.listeners.cap ? 'Listener spots taken' : 'Join as a listener'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <h2 className="mt-12 text-xl sm:text-[22px]">What founders get</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Perk icon={<LuGem />} title="A numbered badge, for good">
          On your profile and everything you share. Nobody can join the first hundred later.
        </Perk>
        <Perk icon={<LuSparkles />} title="First listens for artists">
          Your first three songs are played to 25 real listeners each in the feed, free. Every new artist starts heard.
        </Perk>
        <Perk icon={<LuRadar />} title="Fresh Finds, every week">
          The Wavee team picks new songs each week and shares them on Wavee, WhatsApp, Instagram and TikTok.
        </Perk>
        <Perk icon={<LuMessageSquareHeart />} title="Honest feedback">
          Listeners tell artists what worked and what didn’t, privately. Real notes, not just numbers.
        </Perk>
        <Perk icon={<LuEar />} title="Credit for your ear">
          Like a song early and it blows up: your Early Ear record shows you heard it first.
        </Perk>
        <Perk icon={<LuUserPlus />} title="A direct line to us">
          Tell us what to build next at wavee@kaivon.app. Founders hear about new features before anyone.
        </Perk>
      </div>

      {s && s.members.length > 0 && (
        <>
          <h2 className="mt-12 text-xl sm:text-[22px]">The founders so far</h2>
          <div className="mt-5 flex flex-wrap gap-4">
            {s.members.map((m) => (
              <Link key={m.number} to={`/u/${m.username}`} className="group w-[84px] text-center">
                <span className={clsx('mx-auto block w-fit rounded-full p-[2px]', GOLD)}>
                  <Avatar src={m.avatar_url} name={m.display_name || m.username} className="h-16 w-16 ring-2 ring-bg" />
                </span>
                <span className="mt-2 block truncate text-[12.5px] font-medium">{m.display_name || m.username}</span>
                <span className="block text-[11px] text-faint">
                  #{m.number} · {m.role}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {signedIn && !me && (
        <button type="button" onClick={() => setInviting(true)} className="link mt-10 text-sm">
          Know an artist who should be here? Send them your link.
        </button>
      )}

      {me && <FoundingCardDialog founding={me} open={card} onClose={() => setCard(false)} />}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
