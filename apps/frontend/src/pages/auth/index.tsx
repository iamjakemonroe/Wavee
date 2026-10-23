import { useEffect, useState } from 'react';
import { LuArrowRight, LuEye, LuEyeOff, LuMail } from 'react-icons/lu';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authMessage, AuthLayout, StrengthMeter, passwordStrength } from '../../components/auth/AuthLayout';
import { Button, Checkbox, Input, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';

const callback = (next = '/') => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string | null;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={shown ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        className="[&_input]:pr-12"
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-[38px] grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-ink"
      >
        {shown ? <LuEyeOff /> : <LuEye />}
      </button>
    </div>
  );
}

/** Where to go after signing in: where they came from, else home. */
function useReturnTo() {
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from ?? params.get('next') ?? '/';
  return from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export function SignIn() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const session = useAuth((s) => s.session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unconfirmed = error?.startsWith('Please confirm');

  useEffect(() => {
    if (session) navigate(returnTo, { replace: true });
  }, [session, navigate, returnTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(authMessage(err.message));
  };

  const resend = async () => {
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: callback(returnTo) },
    });
    toast(err ? authMessage(err.message) : 'We sent the confirmation link again.', err ? 'error' : 'success');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Wavee account."
      footer={
        <>
          New to Wavee?{' '}
          <Link to="/signup" state={{ from: returnTo }} className="font-medium text-ink hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" state={{ email }} className="text-[13px] text-muted hover:text-ink hover:underline">
            Forgot your password?
          </Link>
        </div>
        {error && (
          <div role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {error}{' '}
            {unconfirmed && (
              <button type="button" onClick={() => void resend()} className="font-semibold underline">
                Send it again
              </button>
            )}
          </div>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

const USERNAME = /^[a-z0-9_.]{3,30}$/;

export function SignUp() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cleanUsername = username.toLowerCase();
  const usernameError =
    username && !USERNAME.test(cleanUsername)
      ? '3–30 characters: letters, numbers, dots and underscores.'
      : available === false
        ? 'That username is taken.'
        : null;

  useEffect(() => {
    setAvailable(null);
    if (!USERNAME.test(cleanUsername)) return;
    const t = window.setTimeout(() => {
      api.usernameAvailable(cleanUsername).then(setAvailable).catch(() => setAvailable(null));
    }, 350);
    return () => window.clearTimeout(t);
  }, [cleanUsername]);

  const strong = passwordStrength(password).score >= 2;
  const ready = name.trim() && USERNAME.test(cleanUsername) && available !== false && /\S+@\S+\.\S+/.test(email) && strong && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callback(returnTo),
        data: { username: cleanUsername, display_name: name.trim() },
      },
    });
    setBusy(false);
    if (err) {
      setError(authMessage(err.message));
      return;
    }
    if (data.session) navigate(returnTo, { replace: true });
    else navigate(`/check-email?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(returnTo)}`);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free forever. Listen, upload and share."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" state={{ from: returnTo }} className="font-medium text-ink hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Input label="Your name" autoComplete="name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Username"
          autoComplete="username"
          value={username}
          maxLength={30}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
          error={usernameError}
          hint={available ? `wavee.kaivon.app/u/${cleanUsername} is yours to take.` : 'This is your page’s address.'}
        />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
          <StrengthMeter password={password} />
        </div>
        <Checkbox checked={agree} onChange={setAgree}>
          I agree to the{' '}
          <Link to="/terms" target="_blank" className="link">
            Terms
          </Link>{' '}
          and have read the{' '}
          <Link to="/privacy" target="_blank" className="link">
            Privacy Policy
          </Link>
          . I’m at least 13.
        </Checkbox>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!ready}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const next = params.get('next') ?? '/';
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: callback(next) } });
    setBusy(false);
    toast(error ? authMessage(error.message) : 'Sent. Check your inbox (and spam).', error ? 'error' : 'success');
  };
  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        <>
          We sent a link to <span className="text-ink">{email || 'your inbox'}</span>. Open it on this device to finish.
        </>
      }
      footer={
        <Link to="/signin" className="hover:text-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl text-bg shadow-glow">
        <LuMail />
      </div>
      <p className="mt-6 text-sm text-muted">Didn’t get it? It can take a minute, and sometimes it lands in spam.</p>
      <Button className="mt-6" onClick={() => void resend()} loading={busy} disabled={!email}>
        Send it again
      </Button>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) setError(authMessage(err.message));
    else setSent(true);
  };
  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={sent ? `If ${email} has a Wavee account, a reset link is on its way.` : 'We’ll email you a link to choose a new one.'}
      footer={
        <Link to="/signin" className="hover:text-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={submit} className="space-y-5">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(authMessage(err.message));
      return;
    }
    toast('Password updated. You’re signed in.', 'success');
    navigate('/', { replace: true });
  };
  if (loading) {
    return (
      <AuthLayout title="One moment…">
        <Spinner className="h-6 w-6 text-muted" />
      </AuthLayout>
    );
  }
  if (!session) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links work once, for a short while. Ask for a new one.">
        <Link to="/forgot-password">
          <Button variant="primary" icon={<LuArrowRight />}>
            Send a new link
          </Button>
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Choose a new password" subtitle="Make it something you don’t use anywhere else.">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" error={error} />
          <StrengthMeter password={password} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={passwordStrength(password).score < 2}>
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Where email links land: Supabase finishes signing in, then we go on. */
export function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useAuth((s) => s.session);
  const loading = useAuth((s) => s.loading);
  const failure = params.get('error_description') ?? new URLSearchParams(location.hash.slice(1)).get('error_description');
  const next = params.get('next') ?? '/';

  useEffect(() => {
    if (session) {
      toast('You’re in. Welcome to Wavee!', 'success');
      navigate(next.startsWith('/') ? next : '/', { replace: true });
    }
  }, [session, navigate, next]);

  if (failure || (!loading && !session)) {
    return (
      <AuthLayout
        title="That link didn’t work"
        subtitle={failure ?? 'It may have expired or been used already. Sign in, or ask for a new link.'}
      >
        <div className="flex gap-3">
          <Link to="/signin">
            <Button variant="primary">Sign in</Button>
          </Link>
          <Link to="/forgot-password">
            <Button>Reset password</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Signing you in…">
      <Spinner className="h-6 w-6 text-muted" />
    </AuthLayout>
  );
}
