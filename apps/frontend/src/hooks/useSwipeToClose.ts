import { animate, useMotionValue, type MotionValue } from 'framer-motion';
import { useEffect, useRef, useState, type RefObject } from 'react';

/** Whether a media query matches, kept up to date. */
export function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const change = () => setOn(m.matches);
    change();
    m.addEventListener('change', change);
    return () => m.removeEventListener('change', change);
  }, [query]);
  return on;
}

/** True on phones (where dialogs are bottom sheets). */
export const usePhone = () => useMediaQuery('(max-width: 639px)');

/** Pull a sheet down to close it, the way iOS sheets work: from anywhere on it while its content
 * is scrolled to the top, following the finger; let go far or fast enough and it closes,
 * otherwise it springs back. Scrolling the sheet's content still works as normal.
 * Returns the sheet's offset, to put on the element that moves. */
export function useSwipeToClose(
  scroller: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
): MotionValue<number> {
  const y = useMotionValue(0);
  // The latest onClose, without re-arming the gesture every render.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    y.set(0);
    const el = scroller.current;
    if (!el) return;
    let startY = 0;
    let startX = 0;
    let lastY = 0;
    let lastT = 0;
    let speed = 0;
    let atTop = false;
    let dragging = false;
    let decided = false;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startY = lastY = t.clientY;
      startX = t.clientX;
      lastT = performance.now();
      speed = 0;
      atTop = el.scrollTop <= 0;
      dragging = false;
      decided = false;
    };

    const move = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      if (!decided) {
        // Wait for a clear direction: down while at the top drags the sheet; anything else is a
        // normal scroll or a swipe on something inside.
        if (Math.abs(dy) < 6 && Math.abs(t.clientX - startX) < 6) return;
        decided = true;
        dragging = atTop && dy > 0 && Math.abs(dy) > Math.abs(t.clientX - startX);
      }
      if (!dragging) return;
      e.preventDefault();
      const now = performance.now();
      speed = (t.clientY - lastY) / Math.max(1, now - lastT);
      lastY = t.clientY;
      lastT = now;
      y.set(Math.max(0, dy));
    };

    const end = () => {
      if (!dragging) return;
      dragging = false;
      const height = el.getBoundingClientRect().height || window.innerHeight;
      if (y.get() > Math.min(140, height * 0.3) || speed > 0.55) {
        void animate(y, height, { type: 'tween', duration: 0.22, ease: 'easeIn' }).then(() => close.current());
      } else {
        void animate(y, 0, { type: 'spring', damping: 32, stiffness: 420 });
      }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [enabled, scroller, y]);

  return y;
}
