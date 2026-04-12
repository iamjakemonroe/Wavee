import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlobalPlayer } from "@/components/music/GlobalPlayer";
import { NowPlayingSheet } from "@/components/music/NowPlayingSheet";
import { WaveeLogo } from "@/components/ui/WaveeLogo";
import { useAudioSync } from "@/hooks/useAudioSync";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayerStore } from "@/store/usePlayerStore";

export function AppLayout() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const hasPlayer = Boolean(usePlayerStore((s) => s.currentSongId));
  useAudioSync();

  return (
    <div className="flex min-h-[100dvh] bg-wavee-bg text-wavee-text">
      <Sidebar />

      <div className="flex min-h-[100dvh] flex-1 flex-col pt-3">
        {/* Mobile header with safe-area-inset-top */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-wavee-bg/80 px-4 py-3 backdrop-blur-xl safe-top lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <WaveeLogo size={28} className="rounded-lg" />
            <h1 className="text-lg font-black tracking-tight text-gradient">
              Wavee
            </h1>
          </div>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="shrink-0 rounded-full border border-wavee-primary/35 bg-wavee-primary/10 px-3.5 py-1.5 text-sm font-semibold text-wavee-primary shadow-[0_0_20px_rgba(0,209,160,0.12)] transition-all hover:border-wavee-primary/55 hover:bg-wavee-primary/18 active:scale-[0.98]"
            >
              Sign in
            </Link>
          )}
        </header>

        <main
          className={
            location.pathname === "/"
              ? "relative flex-1 overflow-hidden"
              : "relative flex-1 overflow-y-auto"
          }
        >
          <div className="min-h-full bg-wavee-gradient">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`${location.pathname === "/" ? "p-0" : "p-4 sm:p-6"} ${hasPlayer
                  ? "pb-with-player-nav lg:pb-24"
                  : "pb-with-nav-only lg:pb-6"
                  }`}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <GlobalPlayer />
      <NowPlayingSheet />
      <MobileNav />
    </div>
  );
}
