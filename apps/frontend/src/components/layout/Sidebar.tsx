import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiHome,
  FiSearch,
  FiUpload,
  FiUser,
  FiMusic,
  FiDisc,
  FiLogOut,
} from "react-icons/fi";
import { useAuthStore } from "@/store/useAuthStore";
import { WaveeLogo } from "@/components/ui/WaveeLogo";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { queryKeys } from "@/constants/queryKeys";

const navItems = [
  { to: "/", icon: FiHome, label: "Home" },
  { to: "/search", icon: FiSearch, label: "Search" },
  { to: "/upload", icon: FiUpload, label: "Upload" },
  { to: "/playlists", icon: FiMusic, label: "Playlists" },
  { to: "/player", icon: FiDisc, label: "Player" },
  { to: "/profile", icon: FiUser, label: "Profile" },
];

export function Sidebar() {
  const { isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    logout();
    void queryClient.removeQueries({ queryKey: queryKeys.profile });
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-wavee-bg/80 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <WaveeLogo size={32} className="rounded-lg" />
        <h1 className="text-xl font-black tracking-tight text-gradient">Wavee</h1>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-wavee-primary/10 text-wavee-primary shadow-neon"
                  : "text-wavee-muted hover:bg-white/[0.04] hover:text-wavee-text"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-wavee-muted transition-colors hover:bg-white/[0.04] hover:text-wavee-text"
            >
              <FiLogOut size={18} />
              Sign Out
            </button>
            <ConfirmationModal
              open={logoutOpen}
              onOpenChange={setLogoutOpen}
              title="Log out?"
              message="You'll need to sign in again to access your playlists, uploads, and profile."
              cancelLabel="Stay signed in"
              proceedLabel="Log out"
              onProceed={handleLogout}
            />
          </>
        ) : (
          <NavLink
            to="/login"
            className="flex w-full items-center gap-3 rounded-xl bg-wavee-primary/10 px-3 py-2.5 text-sm font-medium text-wavee-primary transition-colors hover:bg-wavee-primary/20"
          >
            <FiUser size={18} />
            Sign In
          </NavLink>
        )}
      </div>
    </aside>
  );
}
