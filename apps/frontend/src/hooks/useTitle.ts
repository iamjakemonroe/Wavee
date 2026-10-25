import { useEffect } from 'react';

const BASE = 'Wavee · Hear it first';

/** The browser tab's title for this page ("Charts · Wavee"); back to Wavee's own when it goes. */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Wavee` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [title]);
}
