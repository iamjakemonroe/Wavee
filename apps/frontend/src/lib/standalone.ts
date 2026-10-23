/** Installed to the home screen, Wavee should feel like an app: no pinch or double-tap zoom, no
 * text selection or long-press menus on buttons and pictures. In a browser tab nothing changes,
 * so people who need to zoom still can. */
export function standalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function startAppMode() {
  if (!standalone()) return;
  document.documentElement.classList.add('standalone');
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport && !/user-scalable/.test(viewport.content)) {
    viewport.content += ', maximum-scale=1, user-scalable=no';
  }
  // Safari zooms on a pinch even with user-scalable=no; its gesture events can stop it.
  const stop = (e: Event) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, stop, { passive: false });
  }
}
