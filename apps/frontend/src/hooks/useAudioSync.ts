import { useEffect, useRef } from "react";
import { audioManager } from "@/lib/audioManager";
import { usePlayerStore } from "@/store/usePlayerStore";
import { httpService } from "@/services/httpService";
import { apiEndpoints } from "@/services/apiEndpoints";

export function useAudioSync() {
  const playSessionRef = useRef<{ songId: string; started: number } | null>(null);

  useEffect(() => {
    const store = usePlayerStore.getState;

    const syncDuration = () => {
      const d = audioManager.totalDuration;
      if (Number.isFinite(d) && d > 0) {
        store().setDuration(d);
      }
    };

    const reportPlay = (skipped: boolean) => {
      const session = playSessionRef.current;
      if (!session) return;
      const duration = audioManager.totalDuration;
      const listened = audioManager.time;
      if (listened > 3 && Number.isFinite(duration) && duration > 0) {
        void httpService
          .post(apiEndpoints.engagement.plays, {
            songId: session.songId,
            durationListened: listened,
            songDuration: duration,
            skipped,
            replayed: false,
          })
          .catch(() => {});
      }
      playSessionRef.current = null;
    };

    const onPlaybackBlocked = () => {
      store().setPlaying(false);
    };

    window.addEventListener("wavee:playback-blocked", onPlaybackBlocked);

    const unsubs = [
      audioManager.on("timeupdate", () => {
        store().setProgress(audioManager.time);
        syncDuration();
      }),
      audioManager.on("loadedmetadata", syncDuration),
      audioManager.on("durationchange", syncDuration),
      audioManager.on("playing", () => {
        syncDuration();
        const { currentSongId } = store();
        if (currentSongId && playSessionRef.current?.songId !== currentSongId) {
          reportPlay(true);
          playSessionRef.current = { songId: currentSongId, started: Date.now() };
        }
      }),
      audioManager.on("ended", () => {
        reportPlay(false);
        store().next();
      }),
    ];

    return () => {
      window.removeEventListener("wavee:playback-blocked", onPlaybackBlocked);
      unsubs.forEach((u) => u());
    };
  }, []);
}
