import { useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useLoginPromptStore } from "@/store/useLoginPromptStore";

/**
 * Runs `action` only when signed in; otherwise opens the login prompt modal.
 */
export function useRequireAuthAction() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openPrompt = useLoginPromptStore((s) => s.openPrompt);

  const run = useCallback(
    (action: () => void, message?: string) => {
      if (!isAuthenticated) {
        openPrompt(message ?? "Sign in to continue");
        return;
      }
      action();
    },
    [isAuthenticated, openPrompt],
  );

  return { run, isAuthenticated };
}
