import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLoginPromptStore } from "@/store/useLoginPromptStore";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function LoginPromptModal() {
  const open = useLoginPromptStore((s) => s.open);
  const message = useLoginPromptStore((s) => s.message);
  const close = useLoginPromptStore((s) => s.close);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-prompt-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassPanel className="p-6 shadow-2xl" intensity="heavy">
              <h2 id="login-prompt-title" className="text-lg font-bold text-wavee-text">
                Sign in required
              </h2>
              <p className="mt-2 text-sm text-wavee-muted">
                {message ?? "Create an account or sign in to use this feature."}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={close}>
                  Not now
                </Button>
                <Link to="/login" className="w-full sm:w-auto" onClick={close}>
                  <Button type="button" className="w-full" size="lg">
                    Log in
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-wavee-muted">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-wavee-primary hover:underline" onClick={close}>
                  Sign up
                </Link>
              </p>
            </GlassPanel>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
