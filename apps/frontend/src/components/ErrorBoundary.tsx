import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LuRefreshCw, LuTriangleAlert } from 'react-icons/lu';

/** A page that was open across a deploy asks for files that no longer exist: one reload fixes it. */
const STALE = /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch dynamically/i;

function reloadOnce() {
  try {
    if (sessionStorage.getItem('wavee.reloaded')) return false;
    sessionStorage.setItem('wavee.reloaded', '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  /** What to show instead: the page-level message by default, or nothing (`quiet`). */
  quiet?: boolean;
}

/** Keeps one broken part from taking the whole app down. Around each page it shows a calm message
 * with a way back; around an optional section (`quiet`) it simply leaves the section out. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (STALE.test(error.message) && reloadOnce()) return;
    console.error('Wavee caught an error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.quiet) return null;
    return (
      <div className="mx-auto grid min-h-[50vh] max-w-sm place-items-center text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-line/[0.06] text-[22px] text-warn">
            <LuTriangleAlert />
          </span>
          <h1 className="mt-4 text-xl">This page hit a snag</h1>
          <p className="mt-2 text-[14px] leading-6 text-muted">
            Something went wrong on our side. Reloading usually fixes it; if it doesn’t, tell us and we’ll sort it out.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg"
            >
              <LuRefreshCw /> Reload
            </button>
            <a
              href={`/report-a-bug?from=${encodeURIComponent(window.location.pathname)}`}
              className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-medium text-muted hover:text-ink"
            >
              Report it
            </a>
          </div>
        </div>
      </div>
    );
  }
}
