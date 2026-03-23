import { useEffect } from "react";
import { audioManager } from "@/lib/audioManager";
import { usePlayerStore } from "@/store/usePlayerStore";

export function useAudioSync() {
  useEffect(() => {
    const store = usePlayerStore.getState;

    const unsubs = [
      audioManager.on("timeupdate", () => {
        store().setProgress(audioManager.time);
      }),
      audioManager.on("loadedmetadata", () => {
        store().setDuration(audioManager.totalDuration);
      }),
      audioManager.on("ended", () => {
        store().next();
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);
}
