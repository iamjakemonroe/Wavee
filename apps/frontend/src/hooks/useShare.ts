import { useCallback } from "react";

/** Same shape as Web Share / your example; named to avoid clashing with the DOM `ShareData` type. */
export type ShareData = {
  title: string | undefined;
  text: string;
  url: string;
};

export function getSongShareUrl(songId: string): string {
  const path = `/songs/${songId}`;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return `${window.location.origin}${path}`;
  }
}

export const useShare = () => {
  const handleShare = useCallback((shareData: ShareData) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share(shareData);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareData.url);
    }
  }, []);

  return { handleShare };
};
