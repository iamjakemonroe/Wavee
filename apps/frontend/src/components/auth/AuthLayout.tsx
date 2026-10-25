import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bars, Logo } from '../ui';

/** The sign-in pages: a living equaliser on one side, the form on the
 * other (stacked on phones). */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_20%,rgb(var(--teal)/0.28),transparent_60%),radial-gradient(60%_60%_at_80%_80%,rgb(var(--violet)/0.35),transparent_60%),#06070a]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255/0.6)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_70%_at_50%_50%,black,transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" aria-label="Wavee home">
            <Logo />
          </Link>
          <div>
            <div className="mb-10 flex h-40 items-end gap-3">
              {Array.from({ length: 22 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-3 rounded-full"
                  style={{
                    background: `linear-gradient(to top, rgb(var(--teal)), rgb(var(--violet)))`,
                    opacity: 0.35 + (i % 5) * 0.12,
                  }}
                  animate={{ height: ['18%', `${40 + ((i * 37) % 60)}%`, '24%'] }}
                  transition={{ duration: 1.4 + (i % 4) * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
                />
              ))}
            </div>
            <p className="max-w-md text-[28px] font-semibold leading-tight tracking-tight">
              New music, straight from the artists.
              <br />
              <span className="text-brand">Hear it first.</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              From rising names to the biggest stars: drop your songs and videos where fans hear them first, climb the
              weekly charts, and build the playlists your friends steal.
            </p>
          </div>
          <p className="text-[12px] text-faint">Wavee is a Kaivon product.</p>
        </div>
      </aside>
      <main className="flex flex-col justify-center px-5 pb-[calc(2.5rem+var(--sab))] pt-[calc(2.5rem+var(--sat))] sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <Link to="/" className="mb-10 inline-flex lg:hidden" aria-label="Wavee home">
            <Logo />
          </Link>
          <div className="mb-8 hidden lg:block">
            <Bars className="h-9 w-9" />
          </div>
          <h1 className="text-[28px] leading-tight">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] text-muted">{subtitle}</div>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** "Weak", "Good", "Strong", from length and variety. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const s = Math.min(3, score) as 0 | 1 | 2 | 3;
  return { score: s, label: ['Too short', 'Weak', 'Good', 'Strong'][s] };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const colours = ['bg-danger', 'bg-warn', 'bg-teal', 'bg-teal'];
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition ${i < Math.max(1, score) ? colours[score] : 'bg-line/10'}`} />
        ))}
      </div>
      <span className="text-[12px] text-faint">{label}</span>
    </div>
  );
}

/** Supabase's messages, in plain words. */
export function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first. We can send the link again.';
  if (/already registered|already been registered/i.test(message)) return 'There’s already an account with that email. Try signing in.';
  if (/password should be at least/i.test(message)) return 'Use at least 8 characters for your password.';
  if (/should contain at least one character/i.test(message)) return 'Use both letters and numbers in your password.';
  if (/rate limit|too many/i.test(message)) return 'Too many tries. Please wait a minute and try again.';
  if (/same.*password|different from the old/i.test(message)) return 'Choose a password you haven’t used here before.';
  if (/network|fetch/i.test(message)) return 'You seem to be offline. Check your connection.';
  return message || 'Something went wrong. Please try again.';
}
