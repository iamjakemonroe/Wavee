const FADE_STEP = 0.08;
const FADE_TICK_MS = 20;

class AudioManager {
  private audio: HTMLAudioElement;
  private targetVolume = 1;
  private currentUrl: string | null = null;
  /** `setTimeout` (not rAF) so volume fade still runs when the tab is backgrounded — rAF can pause and leave volume at 0. */
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "true");
    this.audio.setAttribute("webkit-playsinline", "true");
    if (typeof document !== "undefined") {
      this.audio.style.display = "none";
      const mount = () => {
        if (this.audio.parentNode !== document.body) document.body.appendChild(this.audio);
      };
      if (document.body) mount();
      else document.addEventListener("DOMContentLoaded", mount, { once: true });
    }
  }

  get time() {
    return this.audio.currentTime;
  }

  get totalDuration() {
    return this.audio.duration;
  }

  get paused() {
    return this.audio.paused;
  }

  get seeking() {
    return this.audio.seeking;
  }

  setVolume(v: number) {
    this.targetVolume = Math.max(0, Math.min(1, v));
    if (this.fadeTimeout === null) {
      this.audio.volume = this.targetVolume;
    }
  }

  play(url: string) {
    this.cancelFade();
    this.audio.volume = 0;
    const gen = ++this.generation;

    if (this.currentUrl !== url) {
      this.audio.pause();
      this.currentUrl = url;
      this.audio.src = url;
    } else {
      this.audio.currentTime = 0;
    }

    void this.audio
      .play()
      .then(() => {
        if (gen === this.generation) this.startFade("in");
      })
      .catch(() => {
        window.dispatchEvent(new CustomEvent("wavee:playback-blocked"));
      })
      .finally(() => {
        if (
          gen === this.generation &&
          !this.audio.paused &&
          this.audio.volume < 0.02 &&
          this.fadeTimeout === null
        ) {
          this.audio.volume = this.targetVolume;
        }
        window.setTimeout(() => {
          if (gen !== this.generation) return;
          if (this.audio.paused) return;
          if (this.audio.volume >= 0.99) return;
          this.cancelFade();
          this.audio.volume = this.targetVolume;
        }, 500);
      });
  }

  pause() {
    ++this.generation;
    this.cancelFade();
    // Pause immediately (fade uses setTimeout, but we cancel it here first).
    this.audio.pause();
    this.audio.volume = this.targetVolume;
  }

  /** Stop playback and clear the source (e.g. logout). */
  stop() {
    ++this.generation;
    this.cancelFade();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.currentUrl = null;
    this.audio.volume = this.targetVolume;
  }

  resume() {
    this.cancelFade();
    const gen = ++this.generation;

    if (!this.audio.paused) {
      this.audio.volume = this.targetVolume;
      return;
    }

    /** Full volume before play — do not ramp from 0 here. A volume fade after `play()`
     *  can be skipped if `generation` changes before the promise runs, leaving volume at 0
     *  while `currentTime` still advances (silent playback). New tracks still use fade in `play()`. */
    this.audio.volume = this.targetVolume;

    const kickDecoder = () => {
      if (gen !== this.generation) return;
      const t = this.audio.currentTime;
      const dur = this.audio.duration;
      if (!Number.isFinite(t) || t < 0) return;
      if (Number.isFinite(dur) && dur > 0 && t < dur - 0.02) {
        this.audio.currentTime = t + 1e-5;
      } else {
        this.audio.currentTime = t;
      }
    };

    void this.audio
      .play()
      .then(() => {
        if (gen !== this.generation) return;
        kickDecoder();
        if (this.audio.volume < 0.01) {
          this.audio.volume = this.targetVolume;
        }
      })
      .catch(() => {
        window.dispatchEvent(new CustomEvent("wavee:playback-blocked"));
      });
  }

  seek(time: number) {
    this.audio.currentTime = time;
  }

  preloadNext(url: string) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "fetch";
    link.href = url;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }

  on(event: string, callback: EventListener): () => void {
    this.audio.addEventListener(event, callback);
    return () => this.audio.removeEventListener(event, callback);
  }

  private startFade(direction: "in" | "out") {
    this.cancelFade();
    const step = direction === "in" ? FADE_STEP : -FADE_STEP;
    const target = direction === "in" ? this.targetVolume : 0;

    const tick = () => {
      const next = this.audio.volume + step;

      if (direction === "in" ? next >= target : next <= 0) {
        this.audio.volume = Math.max(0, Math.min(1, target));
        if (direction === "out") this.audio.pause();
        this.fadeTimeout = null;
        return;
      }

      this.audio.volume = Math.max(0, Math.min(1, next));
      this.fadeTimeout = window.setTimeout(tick, FADE_TICK_MS);
    };

    this.fadeTimeout = window.setTimeout(tick, FADE_TICK_MS);
  }

  private cancelFade() {
    if (this.fadeTimeout !== null) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
  }
}

export const audioManager = new AudioManager();
