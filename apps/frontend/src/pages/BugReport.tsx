import { useState } from 'react';
import { LuBug, LuCheck, LuImage, LuX } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { uploadMedia } from '../lib/media';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
import { useTitle } from '../hooks/useTitle';

export function BugReport() {
  useTitle('Report a problem');
  const account = useAuth((s) => s.account);
  const [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadMedia(file, 'bug');
      setShot({ url, preview: URL.createObjectURL(file) });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      await api.submitBugReport({
        message: message.trim(),
        page: params.get('from') || document.referrer || 'unknown',
        userAgent: navigator.userAgent,
        screenshotUrl: shot?.url ?? null,
        contactEmail: account?.email ?? (email.trim() || null),
      });
      setSent(true);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-rise mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-3xl text-teal">
          <LuCheck />
        </div>
        <h1 className="text-3xl">Thank you</h1>
        <p className="mt-3 text-muted">We read every report. If we need more details, we’ll write to you.</p>
        <Link to="/" className="mt-8 inline-block">
          <Button variant="secondary">Back to the music</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-rise mx-auto max-w-xl pb-10 pt-4">
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-line/[0.05] text-xl text-muted">
        <LuBug />
      </div>
      <h1 className="text-3xl">Report a bug</h1>
      <p className="mt-2 text-muted">Something not working as it should? Tell us what happened and we’ll fix it.</p>
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          label="What happened?"
          value={message}
          rows={6}
          maxLength={4000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What were you doing, what did you expect, and what happened instead?"
        />
        {!account && (
          <Input
            type="email"
            label="Your email (optional)"
            hint="Only if you’d like us to reply."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Screenshot (optional)</p>
          {!account ? (
            <p className="text-[13px] text-faint">Sign in to add a screenshot.</p>
          ) : shot ? (
            <div className="relative inline-block">
              <img src={shot.preview} alt="Your screenshot" className="max-h-48 rounded-xl border border-line/10" />
              <button
                type="button"
                onClick={() => setShot(null)}
                aria-label="Remove screenshot"
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-raised text-muted ring-1 ring-line/10 hover:text-ink"
              >
                <LuX />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line/15 px-4 py-3 text-sm text-muted transition hover:border-line/30 hover:text-ink">
              <LuImage /> {uploading ? 'Uploading…' : 'Add a screenshot'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
          )}
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={sending} disabled={message.trim().length < 10 || uploading}>
          Send report
        </Button>
        <p className="text-center text-[12px] text-faint">
          To report a song or a person instead, use Report in its ••• menu. Copyright owners: see the{' '}
          <Link to="/copyright" className="link">copyright policy</Link>.
        </p>
      </form>
    </div>
  );
}
