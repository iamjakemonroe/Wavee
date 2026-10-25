import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Button, Spinner } from '../ui';

/** What a page that needs an account shows to someone signed out: one design everywhere, with a
 * way to join and a way back in. While sign-in is still being checked, a spinner (no flash). */
export function SignedOut({ icon, title, text, next }: { icon: ReactNode; title: string; text: string; next: string }) {
  const loading = useAuth((s) => s.loading);
  if (loading) return <Spinner className="mx-auto mt-24 block h-8 w-8 text-muted" />;
  const to = encodeURIComponent(next);
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-sm flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl border border-line/10 bg-line/[0.04] text-[28px] text-teal shadow-glow-teal">
        {icon}
      </span>
      <h1 className="mt-6 text-2xl">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-muted">{text}</p>
      <div className="mt-7 grid w-full gap-2">
        <Link to={`/signup?next=${to}`}>
          <Button variant="primary" className="w-full">
            Create a free account
          </Button>
        </Link>
        <Link to={`/signin?next=${to}`}>
          <Button variant="ghost" className="w-full">
            I have an account
          </Button>
        </Link>
      </div>
    </div>
  );
}
