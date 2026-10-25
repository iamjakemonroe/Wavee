import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { LuCamera, LuCheck, LuCopy, LuDownload, LuLaptopMinimal, LuLogOut, LuSettings, LuTrash2 } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { SignedOut } from '../components/auth/SignedOut';
import { passwordStrength, StrengthMeter, authMessage } from '../components/auth/AuthLayout';
import { SignOutConfirm } from '../components/auth/SignOutConfirm';
import { LinksEditor, linksValid } from '../components/music/Links';
import { Avatar, Bars, Button, Checkbox, Input, LoadError, Modal, Spinner, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { ROLES } from '../lib/format';
import { purgeMyMedia, uploadMedia } from '../lib/media';
import { payApi } from '../lib/pay';
import { ARTIST_PLATFORMS, type Links } from '../lib/platforms';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/auth';
import { installWay, useInstall } from '../store/install';
import { toast } from '../store/toast';
import { useMyPlan } from '../hooks/data';
import { useTitle } from '../hooks/useTitle';

const USERNAME = /^[a-z0-9_.]{3,30}$/;

function Panel({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="card grid gap-6 p-5 sm:p-7 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-base">{title}</h2>
        {text && <p className="mt-1 text-[13px] leading-5 text-muted">{text}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Settings() {
  useTitle('Settings');
  const session = useAuth((s) => s.session);
  const account = useAuth((s) => s.account);
  const loading = useAuth((s) => s.loading);
  const accountFailed = useAuth((s) => s.accountFailed);
  if (session && !account && accountFailed) {
    return <LoadError what="your account" onRetry={() => void useAuth.getState().refreshAccount()} />;
  }
  if (loading || (session && !account)) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
  if (!session || !account) {
    return (
      <SignedOut
        icon={<LuSettings />}
        title="Your settings live here"
        text="Your profile, your links, notifications and your account."
        next="/settings"
      />
    );
  }
  return (
    <div className="animate-rise space-y-5">
      <h1 className="mb-6 mt-2 text-3xl">Settings</h1>
      <GetTheApp />
      <ProfileForm key={account.id} />
      <LinksForm key={`links-${account.id}`} />
      <PasswordForm />
      <DangerZone />
    </div>
  );
}

function ProfileForm() {
  const account = useAuth((s) => s.account)!;
  const refreshAccount = useAuth((s) => s.refreshAccount);
  const client = useQueryClient();
  const [displayName, setDisplayName] = useState(account.display_name ?? '');
  const [username, setUsername] = useState(account.username);
  const [bio, setBio] = useState(account.bio ?? '');
  const [isArtist, setArtist] = useState(account.is_artist);
  // Roles are keys (singer, dj...); anything the database doesn't know is dropped, so a save never fails on it.
  const [roles, setRoles] = useState<string[]>((account.music_roles ?? []).filter((r) => ROLES.some(([k]) => k === r)));
  const [avatar, setAvatar] = useState(account.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const cleanName = username.trim().toLowerCase();
  const nameChanged = cleanName !== account.username;
  const nameValid = USERNAME.test(cleanName);

  useEffect(() => {
    setAvailable(null);
    if (!nameChanged || !nameValid) return;
    const t = window.setTimeout(() => {
      api.usernameAvailable(cleanName).then(setAvailable, () => setAvailable(null));
    }, 350);
    return () => window.clearTimeout(t);
  }, [cleanName, nameChanged, nameValid]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadMedia(file, 'avatar');
      setAvatar(url);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile(account.id, {
        display_name: displayName.trim() || null,
        username: cleanName,
        bio: bio.trim() || null,
        is_artist: isArtist,
        music_roles: isArtist ? roles : [],
        avatar_url: avatar,
      });
      await refreshAccount();
      void client.invalidateQueries({ queryKey: ['profile'] });
      toast('Profile saved', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const usernameError = !nameValid
    ? '3 to 30 lowercase letters, numbers, dots or underscores.'
    : nameChanged && available === false
      ? 'That username is taken.'
      : null;

  return (
    <Panel title="Profile" text="How you appear on Wavee. Your page is public.">
      <div className="flex items-center gap-5">
        <label className="group relative cursor-pointer">
          <Avatar src={avatar} name={displayName || username} className="h-20 w-20 text-2xl" />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-lg text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? <Spinner className="h-5 w-5" /> : <LuCamera />}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickAvatar(e.target.files?.[0])} />
        </label>
        <div className="text-[13px] text-muted">
          <p className="font-medium text-ink">Profile photo</p>
          <p>JPG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input label="Name" value={displayName} maxLength={50} onChange={(e) => setDisplayName(e.target.value)} />
        <Input
          label="Username"
          value={username}
          maxLength={30}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          error={usernameError}
          hint={
            nameChanged && nameValid && available ? (
              <span className="inline-flex items-center gap-1 text-teal"><LuCheck /> Available</span>
            ) : (
              `wavee.kaivon.app/u/${cleanName || 'you'}`
            )
          }
        />
      </div>
      <Textarea className="mt-4" label="Bio" value={bio} maxLength={300} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="A line or two about you and your music" />
      <div className="mt-5">
        <Checkbox checked={isArtist} onChange={setArtist}>I make music</Checkbox>
        {isArtist && (
          <div className="mt-4 flex flex-wrap gap-2 pl-7">
            {ROLES.map(([r, label]) => {
              const on = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
                  className={clsx(
                    'h-8 rounded-full border px-3 text-[13px] transition',
                    on ? 'border-teal/60 bg-teal/10 text-ink' : 'border-line/10 text-muted hover:border-line/25 hover:text-ink',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          loading={saving}
          disabled={uploading || !!usernameError || (nameChanged && available !== true)}
          onClick={() => void save()}
        >
          Save profile
        </Button>
      </div>
    </Panel>
  );
}

/** "Get the app", until it's on the home screen. */
function GetTheApp() {
  const installed = useInstall((s) => s.installed);
  const show = useInstall((s) => s.show);
  if (installed || installWay() === 'none') return null;
  return (
    <section className="card flex items-center gap-4 p-5 sm:p-6">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[radial-gradient(95%_95%_at_25%_15%,#1b1f2a,#0a0b10)] ring-1 ring-line/10">
        <Bars className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base">Get the Wavee app</h2>
        <p className="mt-0.5 text-[13px] text-muted">On your home screen: opens in one tap, full screen.</p>
      </div>
      <Button variant="brand" size="sm" icon={<LuDownload />} onClick={() => show()}>
        Install
      </Button>
    </section>
  );
}

/** Where else to find you, and your Wavee page as the one link for your bio. */
function LinksForm() {
  const account = useAuth((s) => s.account)!;
  const refreshAccount = useAuth((s) => s.refreshAccount);
  const client = useQueryClient();
  const [links, setLinks] = useState<Links>(account.links ?? {});
  const [saving, setSaving] = useState(false);
  const page = `wavee.kaivon.app/u/${account.username}`;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile(account.id, { links });
      await refreshAccount();
      void client.invalidateQueries({ queryKey: ['profile'] });
      toast('Links saved', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${page}`);
      toast('Link copied. Put it in your bio.');
    } catch {
      toast(`https://${page}`);
    }
  };

  return (
    <Panel title="Your links" text="Where else fans can find you. They show as buttons on your page.">
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-teal/20 bg-teal/[0.06] p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">One link for your bio</p>
          <p className="truncate text-[13px] text-muted">{page}</p>
          <p className="mt-1 text-[12px] text-faint">Put it on Instagram, TikTok and X: fans hear your music and find every platform from there.</p>
        </div>
        <Button size="sm" variant="secondary" icon={<LuCopy />} onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <LinksEditor platforms={ARTIST_PLATFORMS} value={links} onChange={setLinks} collapsedAfter={6} />
      <div className="mt-6 flex justify-end">
        <Button variant="primary" loading={saving} disabled={!linksValid(links)} onClick={() => void save()}>
          Save links
        </Button>
      </div>
    </Panel>
  );
}

function PasswordForm() {
  const account = useAuth((s) => s.account)!;
  const [signingOut, setSigningOut] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const strong = passwordStrength(password).score >= 2;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast(
        /same|different/i.test(error.message)
          ? 'Choose a password you haven’t used here before.'
          : /should be at least|should contain/i.test(error.message)
            ? authMessage(error.message)
            : 'We couldn’t change your password. Please try again.',
        'error',
      );
      return;
    }
    setPassword('');
    setConfirm('');
    toast('Password changed. Your other devices will ask you to sign in again.', 'success');
  };

  return (
    <Panel title="Account" text="Your sign-in details. Only you can see your email.">
      <Input label="Email" value={account.email} readOnly className="opacity-70" />
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm font-medium">Change password</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input type="password" autoComplete="new-password" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <StrengthMeter password={password} />
          </div>
          <Input
            type="password"
            autoComplete="new-password"
            label="Confirm it"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={confirm && confirm !== password ? 'The passwords don’t match.' : null}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            icon={<LuLogOut />}
            onClick={() => setSigningOut(true)}
          >
            Sign out
          </Button>
          <Button type="submit" variant="secondary" loading={saving} disabled={!strong || password !== confirm}>
            Change password
          </Button>
        </div>
      </form>
      <OtherDevices />
      <SignOutConfirm open={signingOut} onClose={() => setSigningOut(false)} />
    </Panel>
  );
}

/** You stay signed in on each device until you sign out there; this is for a lost phone or a
 * computer someone else uses. */
function OtherDevices() {
  const signOutOthers = useAuth((s) => s.signOutOthers);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await signOutOthers();
      setAsking(false);
      toast('Signed out everywhere else. You’re still signed in here.', 'success');
    } catch {
      toast('We couldn’t reach Wavee. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col items-start gap-3 border-t border-line/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <p className="text-sm font-medium">Your devices</p>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          You stay signed in on each phone and computer until you sign out there.
        </p>
      </div>
      <Button type="button" variant="ghost" icon={<LuLaptopMinimal />} onClick={() => setAsking(true)}>
        Sign out everywhere else
      </Button>
      <Modal open={asking} onClose={() => setAsking(false)} title="Sign out everywhere else?">
        <p className="text-sm leading-6 text-muted">
          Every other phone, computer and browser signed in as you will need to sign in again. You stay signed in here.
          Do this if you lost a device or signed in on someone else’s.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setAsking(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={() => void confirm()}>
            Sign them out
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DangerZone() {
  const account = useAuth((s) => s.account)!;
  const signOut = useAuth((s) => s.signOut);
  const plan = useMyPlan().data;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    // Artist Pro is cancelled with Flutterwave first, so the card is never charged for an account
    // that's gone. If that can't be done, nothing is deleted.
    if (plan?.pro_until) {
      try {
        await payApi.cancel();
      } catch {
        toast('We couldn’t cancel your Artist Pro plan, so nothing was deleted. Please try again.', 'error');
        setDeleting(false);
        return;
      }
    }
    try {
      await purgeMyMedia();
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await signOut();
      toast('Your account has been deleted. Thank you for being here.');
      navigate('/');
    } catch {
      toast('We couldn’t delete your account. Please try again, or write to wavee@kaivon.app.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Panel title="Delete account" text="This can’t be undone.">
      <p className="text-sm leading-6 text-muted">
        Deleting your account removes your profile, your songs and their files, your playlists, likes and follows. Anyone with a link to your songs will
        find them gone.{plan?.pro_until ? ' Your Artist Pro plan is cancelled first, so you’re never charged again.' : ''}
      </p>
      <Button variant="danger" className="mt-5" icon={<LuTrash2 />} onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <p className="text-sm leading-6 text-muted">
          Everything you’ve uploaded goes with it. To confirm, type your username, <b className="text-ink">{account.username}</b>.
        </p>
        <Input className="mt-4" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button variant="danger" className="flex-1" loading={deleting} disabled={typed.trim().toLowerCase() !== account.username} onClick={() => void remove()}>
            Delete forever
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
