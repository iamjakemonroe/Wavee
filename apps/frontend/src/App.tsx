import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";
import { WaveeRouteLoader } from "@/components/ui/WaveeLogo";
import { UploadPage } from "@/pages/Upload/UploadPage";

const HomePage = lazy(() =>
  import("@/pages/Home/HomePage").then((m) => ({ default: m.HomePage })),
);
const SearchPage = lazy(() =>
  import("@/pages/Search/SearchPage").then((m) => ({ default: m.SearchPage })),
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
const PlaylistDetailPage = lazy(() =>
  import("@/pages/Playlist/PlaylistDetailPage").then((m) => ({
    default: m.PlaylistDetailPage,
  })),
);
const UserDetailPage = lazy(() =>
  import("@/pages/User/UserDetailPage").then((m) => ({
    default: m.UserDetailPage,
  })),
);
const SongLinkPage = lazy(() =>
  import("@/pages/Song/SongLinkPage").then((m) => ({ default: m.SongLinkPage })),
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
const AuthCallbackPage = lazy(() =>
  import("@/pages/Auth/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);

function App() {
  return (
    <BrowserRouter>
      <LoginPromptModal />
      <Suspense fallback={<WaveeRouteLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/playlists" element={<PlaylistPage />} />
            <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
            <Route path="/users/:userId" element={<UserDetailPage />} />
            <Route path="/songs/:songId" element={<SongLinkPage />} />
            <Route path="/player" element={<PlayerPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
