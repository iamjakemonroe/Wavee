/**
 * The one audio element the whole app plays through. It keeps playing
 * while you browse, and only the newest request wins: tap through songs
 * quickly and a slow, older load never starts playing over a newer one.
 */
type Listener = () => void;

export type AudioEvent = 'play' | 'pause' | 'ended' | 'error' | 'waiting' | 'playing' | 'time' | 'meta' | 'blocked';

class AudioEngine {
  readonly el: HTMLAudioElement;
  private listeners = new Map<AudioEvent, Set<Listener>>();
  private generation = 0;

  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.setAttribute('playsinline', '');
    const forward = (from: string, to: AudioEvent) =>
      this.el.addEventListener(from, () => this.emit(to));
    forward('play', 'play');
    forward('pause', 'pause');
    forward('ended', 'ended');
    forward('waiting', 'waiting');
    forward('playing', 'playing');
    forward('timeupdate', 'time');
    forward('durationchange', 'meta');
    forward('loadedmetadata', 'meta');
    this.el.addEventListener('error', () => {
      // An error while nothing is loaded (we cleared src) isn't one.
      if (this.el.getAttribute('src')) this.emit('error');
    });
  }

  on(event: AudioEvent, fn: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  private emit(event: AudioEvent) {
    this.listeners.get(event)?.forEach((fn) => fn());
  }

  get src() {
    return this.el.getAttribute('src');
  }

  get time() {
    return this.el.currentTime || 0;
  }

  get duration() {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }

  get paused() {
    return this.el.paused;
  }

  /** The share of the track that's downloaded (0 to 1). */
  get buffered() {
    const d = this.duration;
    if (!d || !this.el.buffered.length) return 0;
    return Math.min(1, this.el.buffered.end(this.el.buffered.length - 1) / d);
  }

  /** Loads [url] (from the start) and plays it, unless [autoplay] is off. */
  load(url: string, autoplay: boolean, startAt = 0) {
    const gen = ++this.generation;
    if (this.src !== url) {
      this.el.src = url;
    }
    if (startAt > 0) {
      const seek = () => {
        if (gen === this.generation) this.el.currentTime = startAt;
      };
      if (this.el.readyState >= 1) seek();
      else this.el.addEventListener('loadedmetadata', seek, { once: true });
    } else if (this.el.currentTime > 0) {
      this.el.currentTime = 0;
    }
    if (autoplay) this.play(gen);
  }

  play(gen = this.generation) {
    void this.el.play().catch((e: DOMException) => {
      // A newer load replaced this one, or a pause came first: not an error.
      if (gen !== this.generation || e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') this.emit('blocked');
    });
  }

  pause() {
    this.el.pause();
  }

  seek(seconds: number) {
    const d = this.duration;
    this.el.currentTime = Math.max(0, d ? Math.min(seconds, d - 0.05) : seconds);
  }

  setVolume(v: number) {
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  setMuted(m: boolean) {
    this.el.muted = m;
  }

  stop() {
    ++this.generation;
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }
}

export const audio = new AudioEngine();

/** This browser's listening session (for counting plays fairly without an
 * account). */
export function sessionId(): string {
  const key = 'wavee.session';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}
