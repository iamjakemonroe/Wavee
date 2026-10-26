import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Bare, Shell } from './components/layout/Shell';
import { Spinner } from './components/ui';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

const loaders: (() => Promise<unknown>)[] = [];

/** A page loaded the first time it's needed. Every one is also fetched
 * while the app is idle, so it's usually there before anyone taps. */
function later<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  loaders.push(load);
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const loadAuth = () => import('./pages/auth');
const SignIn = later(loadAuth, 'SignIn');
const SignUp = later(loadAuth, 'SignUp');
const CheckEmail = later(loadAuth, 'CheckEmail');
const ForgotPassword = later(loadAuth, 'ForgotPassword');
const ResetPassword = later(loadAuth, 'ResetPassword');
const AuthCallback = later(loadAuth, 'AuthCallback');
const Feed = later(() => import('./pages/Feed'), 'Feed');
const Search = later(() => import('./pages/Search'), 'Search');
const Charts = later(() => import('./pages/Charts'), 'Charts');
const Library = later(() => import('./pages/Library'), 'Library');
const SongPage = later(() => import('./pages/SongPage'), 'SongPage');
const Artist = later(() => import('./pages/Artist'), 'Artist');
const PlaylistPage = later(() => import('./pages/PlaylistPage'), 'PlaylistPage');
const Upload = later(() => import('./pages/Upload'), 'Upload');
const Settings = later(() => import('./pages/Settings'), 'Settings');
const Admin = later(() => import('./pages/Admin'), 'Admin');
const BugReport = later(() => import('./pages/BugReport'), 'BugReport');
const Founding = later(() => import('./pages/Founding'), 'Founding');
const Apply = later(() => import('./pages/Apply'), 'Apply') as ComponentType<{ kind: 'founding' | 'verified' }>;
const Picks = later(() => import('./pages/Picks'), 'Picks');
const Stats = later(() => import('./pages/Stats'), 'Stats');
const Legal = later(() => import('./pages/Legal'), 'Legal') as ComponentType<{
  slug: 'terms' | 'privacy' | 'refunds' | 'copyright' | 'guidelines';
}>;

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-7 w-7 text-muted" />
    </div>
  );
}

/** Each page gets its own safety net, reset when you move to another page. */
function Page() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

function ShellLayout() {
  return (
    <Shell>
      <Page />
    </Shell>
  );
}

function BareLayout() {
  return (
    <Bare>
      <Page />
    </Bare>
  );
}

export function App() {
  useEffect(() => {
    const prefetch = () => loaders.forEach((load) => void load().catch(() => undefined));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <Routes>
      <Route element={<BareLayout />}>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/search" element={<Search />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/picks" element={<Picks />} />
        <Route path="/founding" element={<Founding />} />
        <Route path="/founding/apply" element={<Apply kind="founding" />} />
        <Route path="/verify" element={<Apply kind="verified" />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/library" element={<Library />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/songs/:id" element={<SongPage />} />
        <Route path="/u/:username" element={<Artist />} />
        <Route path="/playlists/:id" element={<PlaylistPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/report-a-bug" element={<BugReport />} />
        <Route path="/terms" element={<Legal slug="terms" />} />
        <Route path="/privacy" element={<Legal slug="privacy" />} />
        <Route path="/refunds" element={<Legal slug="refunds" />} />
        <Route path="/copyright" element={<Legal slug="copyright" />} />
        <Route path="/guidelines" element={<Legal slug="guidelines" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
