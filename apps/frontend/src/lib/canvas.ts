// Drawing helpers for the story cards (1080×1920 pictures made in the browser).

export const W = 1080;
export const H = 1920;
export const TEAL = '#18e2b0';
export const VIOLET = '#8466ff';
export const FONT = '"Inter Variable", Inter, "Helvetica Neue", Arial, sans-serif';

/** The cover, readable by a canvas (media.wavee.kaivon.app allows it; the query keeps a copy
 * cached without that permission from being reused). Null if it can't be had. */
export async function loadCover(url: string | null): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}card=1`, { mode: 'cors' });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws [image] to fill the box, cropping the overflow (like object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Splits [text] into at most [max] lines that fit [width], ending in … if it's cut. */
export function lines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  if (out.length > max) {
    const kept = out.slice(0, max);
    let last = kept[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[max - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return out;
}

/** Five equaliser bars, Wavee's mark, in a box of [size] at (x, y). */
export function mark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const heights = [0.45, 0.75, 1, 0.8, 0.55];
  const w = size * 0.11;
  const gap = size * 0.08;
  const total = w * 5 + gap * 4;
  heights.forEach((k, i) => {
    const h = size * k;
    const g = ctx.createLinearGradient(0, y, 0, y + size);
    g.addColorStop(0, i < 2 ? TEAL : VIOLET);
    g.addColorStop(1, i < 3 ? TEAL : VIOLET);
    ctx.fillStyle = g;
    roundRect(ctx, x + (size - total) / 2 + i * (w + gap), y + (size - h) / 2, w, h, w / 2);
    ctx.fill();
  });
}
