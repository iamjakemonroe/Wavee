import { useEffect } from 'react';
import { mayAsk, useInstall, visits } from '../../store/install';
import { usePlayer } from '../../store/player';

/** Where it's fine to be asked: browsing and listening, never mid-task. */
const CALM = /^\/($|feed|charts|search|songs\/|u\/|playlists\/|library)/;

/** Offers the app once someone is clearly enjoying Wavee: after about 45 seconds of listening,
 * or 20 seconds into a return visit. Once a visit at most, never over another sheet or mid-task,
 * and not again for two weeks after "Not now" (never after three). */
export function InstallPrompt() {
  useEffect(() => {
    let done = (() => {
      try {
        return sessionStorage.getItem('wavee.install.asked') === '1';
      } catch {
        return false;
      }
    })();
    if (done || !mayAsk()) return;
    const started = Date.now();
    let listened = 0;

    const tick = window.setInterval(() => {
      if (done) return;
      if (usePlayer.getState().playing) listened += 5;
      const ready = listened >= 45 || (visits() >= 2 && Date.now() - started >= 20_000);
      if (!ready) return;
      const busy = document.querySelector('[role="dialog"]') || !CALM.test(location.pathname);
      if (busy || !mayAsk()) return;
      done = true;
      try {
        sessionStorage.setItem('wavee.install.asked', '1');
      } catch {
        // Fine: it's still once per page load.
      }
      useInstall.getState().show(true);
    }, 5_000);
    return () => window.clearInterval(tick);
  }, []);

  // Nothing to draw: the sheet is <InstallSheet />.
  return null;
}
