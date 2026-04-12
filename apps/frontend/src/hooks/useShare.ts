import { useCallback } from "react";

export type ShareData = {
  title?: string;
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

function buildClipboardText(data: ShareData): string {
  const title = data.title?.trim();
  const text = data.text.trim();
  const url = data.url.trim();
  return [title, text, url].filter(Boolean).join("\n\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Web Share with clipboard fallbacks (Safari / desktop / PWA often lack share or reject payloads).
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  const url = data.url.trim();
  const text = (data.text.trim() || "Listen on Wavee").trim();
  const title = data.title?.trim();

  const payload: { title?: string; text: string; url: string } = { text, url };
  if (title) payload.title = title;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare === "function") {
        if (!navigator.canShare(payload)) {
          return copyToClipboard(buildClipboardText({ ...data, url, text }));
        }
      }
      await navigator.share(payload);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return true;
      }
    }
  }

  return copyToClipboard(buildClipboardText({ ...data, url, text }));
}

export const useShare = () => {
  const handleShare = useCallback((shareData: ShareData) => {
    void shareContent(shareData);
  }, []);

  return { handleShare };
};
