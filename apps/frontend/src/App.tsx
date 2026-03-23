import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { Skeleton } from "@/components/ui/Skeleton";

const HomePage = lazy(() =>
  import("@/pages/Home/HomePage").then((m) => ({ default: m.HomePage })),
);
const SearchPage = lazy(() =>
  import("@/pages/Search/SearchPage").then((m) => ({ default: m.SearchPage })),
);
const UploadPage = lazy(() =>
  import("@/pages/Upload/UploadPage").then((m) => ({ default: m.UploadPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/Profile/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);
const PlaylistPage = lazy(() =>
  import("@/pages/Playlist/PlaylistPage").then((m) => ({
    default: m.PlaylistPage,
  })),
);
const PlayerPage = lazy(() =>
  import("@/pages/Player/PlayerPage").then((m) => ({
    default: m.PlayerPage,
  })),
);
const LoginPage = lazy(() =>
  import("@/pages/Auth/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SignupPage = lazy(() =>
  import("@/pages/Auth/SignupPage").then((m) => ({ default: m.SignupPage })),
);

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-wavee-bg">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/playlists" element={<PlaylistPage />} />
            <Route path="/player" element={<PlayerPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
