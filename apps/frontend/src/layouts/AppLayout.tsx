import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { GlobalPlayer } from "@/components/music/GlobalPlayer";
import { useAudioSync } from "@/hooks/useAudioSync";

export function AppLayout() {
  const location = useLocation();
  useAudioSync();

  return (
    <div className="flex min-h-screen bg-wavee-bg text-wavee-text">
      <Sidebar />
      <main className="relative min-h-screen flex-1 overflow-y-auto">
        <div className="min-h-screen bg-wavee-gradient">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-6 pb-28"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <GlobalPlayer />
    </div>
  );
}
