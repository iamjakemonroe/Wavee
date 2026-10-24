import { accessToken } from './supabase';

export type MediaKind = 'audio' | 'video' | 'cover' | 'avatar' | 'playlist' | 'bug';

/** What each kind accepts (the Worker checks the same, and the file's real
 * contents too). */
export const MEDIA_LIMITS: Record<MediaKind, { maxMb: number; accept: string; label: string }> = {
  audio: {
    maxMb: 50,
    accept: '.mp3,.m4a,.aac,.wav,.ogg,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg,audio/flac',
    label: 'MP3, M4A, WAV, OGG or FLAC, up to 50 MB',
  },
  video: { maxMb: 100, accept: '.mp4,.webm,video/mp4,video/webm', label: 'MP4 or WebM, up to 100 MB' },
  cover: { maxMb: 8, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', label: 'JPG, PNG or WebP (big photos are resized for you)' },
  avatar: { maxMb: 5, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', label: 'JPG, PNG or WebP (big photos are resized for you)' },
  playlist: { maxMb: 5, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', label: 'JPG, PNG or WebP (big photos are resized for you)' },
  bug: { maxMb: 5, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', label: 'JPG, PNG or WebP (big photos are resized for you)' },
};

const BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const NORMALISE: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-mp3': 'audio/mpeg',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/aac': 'audio/mp4',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-flac': 'audio/flac',
  'image/jpg': 'image/jpeg',
};

/** The file's type as the Worker expects it (some browsers leave it
 * blank, or use old names). */
export function mediaType(file: File): string {
  const declared = file.type.toLowerCase();
  if (declared && declared !== 'application/octet-stream') return NORMALISE[declared] ?? declared;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? declared;
}

/** Why [file] can't be uploaded as [kind], or null if it can. Pictures not yet shrunk
 * ([original]) may be big: what's uploaded is the shrunk copy. */
/** [pro]: Artist Pro members upload three times bigger audio and video. */
export function checkFile(file: File, kind: MediaKind, original = false, pro = false): string | null {
  const limit = MEDIA_LIMITS[kind];
  const big = kind === 'audio' || kind === 'video';
  const maxMb = original && !big ? 40 : big && pro ? limit.maxMb * 3 : limit.maxMb;
  if (file.size > maxMb * 1024 * 1024) {
    return `That file is too big. ${limit.label}${big && !pro ? ` (${limit.maxMb * 3} MB with Artist Pro)` : ''}.`;
  }
  const type = mediaType(file);
  const family = kind === 'audio' ? 'audio/' : kind === 'video' ? 'video/' : 'image/';
  if (!type.startsWith(family)) return `That isn’t a supported file. ${limit.label}.`;
  return null;
}

export interface Uploaded {
  key: string;
  url: string;
}

/** The longest side pictures are kept at: sharp on any screen they're shown on, and a fraction of
 * a phone photo's size, so lists and the feed load and scroll quickly. */
const MAX_SIDE: Partial<Record<MediaKind, number>> = { cover: 1400, playlist: 1200, avatar: 512, bug: 1800 };

/** A picture made no bigger than it needs to be, as WebP (JPEG where the browser can't write
 * WebP). Small pictures, and anything that can't be read, go up as they are. */
export async function shrinkImage(file: File, kind: MediaKind): Promise<File> {
  const max = MAX_SIDE[kind];
  if (!max || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close();
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const encode = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode('image/webp', 0.88);
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.9);
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type });
  } catch {
    return file;
  }
}

/** Uploads [file], reporting progress (0 to 1). Cancel with [signal]. */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Uploaded> {
  file = await shrinkImage(file, kind);
  const problem = checkFile(file, kind);
  if (problem) throw new Error(problem);
  const token = await accessToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?kind=${kind}`);
    xhr.setRequestHeader('Content-Type', mediaType(file));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: { key?: string; url?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON: a proxy or network page.
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.key && body.url) {
        onProgress?.(1);
        resolve({ key: body.key, url: body.url });
      } else {
        reject(new Error(body.error ?? 'The upload didn’t finish. Please try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('The upload stopped. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Deletes files you uploaded (quietly: a leftover file is harmless). */
export async function deleteMedia(keys: string[]): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  await Promise.all(
    keys.map((key) =>
      fetch(`/api/object?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined),
    ),
  );
}

/** Deletes everything you've uploaded (when your account is deleted). */
export async function purgeMyMedia(): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error('Please sign in.');
  const res = await fetch('/api/media/mine', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('We couldn’t remove your files. Please try again.');
}

/** How long an audio or video file plays, in whole seconds (or null). */
export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      resolve(value);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}
