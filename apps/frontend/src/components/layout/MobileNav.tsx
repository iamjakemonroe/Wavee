import { NavLink } from "react-router-dom";
import { FiHome, FiSearch, FiUpload, FiMusic, FiUser } from "react-icons/fi";

const tabs = [
  { to: "/", icon: FiHome, label: "Home" },
  { to: "/search", icon: FiSearch, label: "Search" },
  { to: "/upload", icon: FiUpload, label: "Upload" },
  { to: "/playlists", icon: FiMusic, label: "Library" },
  { to: "/profile", icon: FiUser, label: "Profile" },
];

export function MobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-wavee-bg/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-14 items-center justify-around px-2">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${isActive ? "text-wavee-primary" : "text-wavee-muted"
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
