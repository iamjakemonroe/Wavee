import { usePlayerStore } from "@/store/usePlayerStore";

/**
 * Derives play/pause/spinner UI from the audio element, not only `isPlaying`.
 * Matches GlobalPlayer / NowPlayingSheet `progressIndeterminate` semantics.
 */
export function usePlaybackUiState(trackId: string) {
  const currentSongId = usePlayerStore((s) => s.currentSongId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const audioElementPlaying = usePlayerStore((s) => s.audioElementPlaying);
  const audioBuffering = usePlayerStore((s) => s.audioBuffering);

  const isCurrent = currentSongId === trackId;
  const intentPlaying = isCurrent && isPlaying;
  const progressIndeterminate =
    intentPlaying && (!audioElementPlaying || audioBuffering);
  const showPauseIcon = intentPlaying && !progressIndeterminate;

  return {
    isCurrent,
    intentPlaying,
    progressIndeterminate,
    showPauseIcon,
  };
}
