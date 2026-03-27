const FADE_STEP = 0.08;

class AudioManager {
  private audio: HTMLAudioElement;
  private targetVolume = 1;
  private currentUrl: string | null = null;
  private fadeRaf: number | null = null;
  private generation = 0;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
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

  setVolume(v: number) {
    this.targetVolume = Math.max(0, Math.min(1, v));
    if (this.fadeRaf === null) {
      this.audio.volume = this.targetVolume;
    }
  }

  play(url: string) {
    this.cancelFade();
    this.audio.volume = 0;
    const gen = ++this.generation;

    if (this.currentUrl !== url) {
      this.currentUrl = url;
      this.audio.src = url;
    } else {
      this.audio.currentTime = 0;
    }

    this.audio
      .play()
      .then(() => {
        if (gen === this.generation) this.startFade("in");
      })
      .catch(() => {
        window.dispatchEvent(new CustomEvent("wavee:playback-blocked"));
      });
  }

  pause() {
    ++this.generation;
    this.cancelFade();
    // Pause immediately — volume fade used rAF; on mobile, throttled frames could delay
    // pause() indefinitely so audio kept playing while the UI showed “paused”.
    this.audio.pause();
    this.audio.volume = this.targetVolume;
  }

  resume() {
    this.cancelFade();
    const gen = ++this.generation;

    if (!this.audio.paused) {
      this.audio.volume = this.targetVolume;
      return;
    }

    this.audio.volume = 0;
    this.audio
      .play()
      .then(() => {
        if (gen === this.generation) this.startFade("in");
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
        this.fadeRaf = null;
        return;
      }

      this.audio.volume = Math.max(0, Math.min(1, next));
      this.fadeRaf = requestAnimationFrame(tick);
    };

    this.fadeRaf = requestAnimationFrame(tick);
  }

  private cancelFade() {
    if (this.fadeRaf !== null) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = null;
    }
  }
}

export const audioManager = new AudioManager();
