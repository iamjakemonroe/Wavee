import { useEffect, useState } from "react";

/**
 * Reads {@link HTMLMediaElement.duration} from a separate Audio element with
 * preload="metadata", same idea as {@link useAudioSync} + {@link audioManager}.
 */
export function useAudioMetadataDuration(audioUrl: string | undefined): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setSeconds(null);
      return;
    }

    setSeconds(null);
    const el = new Audio();
    el.preload = "metadata";

    const sync = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        setSeconds(d);
      }
    };

    const onError = () => setSeconds(null);

    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    el.addEventListener("error", onError);
    el.src = audioUrl;

    return () => {
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
      el.removeEventListener("error", onError);
      el.removeAttribute("src");
      el.load();
    };
  }, [audioUrl]);

  return seconds;
}
