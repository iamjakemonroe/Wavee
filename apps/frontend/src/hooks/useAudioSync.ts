import { useEffect, useRef } from "react";
import { audioManager } from "@/lib/audioManager";
import { usePlayerStore } from "@/store/usePlayerStore";
import { httpService } from "@/services/httpService";
import { apiEndpoints } from "@/services/apiEndpoints";

function scheduleSyncPlaybackFromMedia() {
  queueMicrotask(() => {
    if (audioManager.seeking) return;
    usePlayerStore.getState().syncPlaybackFromMediaElement();
  });
}

function updateMediaSessionFromState() {
  if (!("mediaSession" in navigator)) return;
  const state = usePlayerStore.getState();
  const song = state.currentSongId
    ? state.queue.find((s) => s.id === state.currentSongId)
    : undefined;

  if (song && state.currentSongId) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist_name ?? song.genre ?? "",
        album: "Wavee",
        artwork: song.cover_image_url
          ? [
              {
                src: song.cover_image_url,
                sizes: "512x512",
                type: "image/jpeg",
              },
            ]
          : [],
      });
    } catch {
      /* MediaMetadata unsupported or bad artwork URL */
    }
  } else {
    navigator.mediaSession.metadata = null;
  }

  const playing = Boolean(
    state.currentSongId && !audioManager.paused,
  );
  navigator.mediaSession.playbackState = playing ? "playing" : "paused";
}

export function useAudioSync() {
  const playSessionRef = useRef<{ songId: string; started: number } | null>(
    null,
  );

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

    /**
     * Do not pause on tab hide, minimize, or PWA background: iOS/Android often fire `pagehide`
     * (with `persisted: false`) when the app is only backgrounded, not closed — that was still stopping audio.
     * Rely on the browser/OS tearing down the document on real close; the `<audio>` element stops with it.
     */

    const unsubs = [
      audioManager.on("timeupdate", () => {
        store().setProgress(audioManager.time);
        syncDuration();
      }),
      audioManager.on("loadedmetadata", syncDuration),
      audioManager.on("durationchange", syncDuration),
      audioManager.on("loadstart", () => {
        store().setAudioPlaybackFlags({ audioElementPlaying: false });
      }),
      audioManager.on("playing", () => {
        store().setAudioPlaybackFlags({
          audioElementPlaying: true,
          audioBuffering: false,
        });
        syncDuration();
        const { currentSongId } = store();
        if (currentSongId && playSessionRef.current?.songId !== currentSongId) {
          reportPlay(true);
          playSessionRef.current = {
            songId: currentSongId,
            started: Date.now(),
          };
        }
        scheduleSyncPlaybackFromMedia();
        updateMediaSessionFromState();
      }),
      audioManager.on("pause", () => {
        store().setAudioPlaybackFlags({
          audioElementPlaying: false,
          audioBuffering: false,
        });
        scheduleSyncPlaybackFromMedia();
        updateMediaSessionFromState();
      }),
      audioManager.on("waiting", () => {
        store().setAudioPlaybackFlags({ audioBuffering: true });
      }),
      audioManager.on("ended", () => {
        reportPlay(false);
        store().next();
      }),
    ];

    const mediaSessionSupported = "mediaSession" in navigator;
    if (mediaSessionSupported) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!store().currentSongId) return;
        if (audioManager.paused) {
          usePlayerStore.setState({ isPlaying: true, userPaused: false });
          audioManager.resume();
        }
        updateMediaSessionFromState();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!store().currentSongId) return;
        audioManager.pause();
        usePlayerStore.setState({
          isPlaying: false,
          userPaused: true,
        });
        updateMediaSessionFromState();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        store().previous();
        updateMediaSessionFromState();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        store().next();
        updateMediaSessionFromState();
      });
    }

    updateMediaSessionFromState();
    let mediaSessionSig: string | null = null;
    const unsubStore = usePlayerStore.subscribe((state) => {
      const sig = `${state.currentSongId ?? ""}:${state.isPlaying}`;
      if (sig === mediaSessionSig) return;
      mediaSessionSig = sig;
      updateMediaSessionFromState();
    });

    return () => {
      window.removeEventListener("wavee:playback-blocked", onPlaybackBlocked);
      unsubs.forEach((u) => u());
      unsubStore();
      if (mediaSessionSupported) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    };
  }, []);
}
