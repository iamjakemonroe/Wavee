import type { Founding, Picks } from '../../lib/api';
import { artistNames } from '../../lib/format';
import { weekLabel } from '../../lib/growth';
import { drawCover, FONT, H, lines, loadCover, mark, roundRect, TEAL, VIOLET, W } from '../../lib/canvas';

const INK = '#eef1f5';
const GOLD_A = '#f7d98b';
const GOLD_B = '#e7a33e';

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/png'),
  );
}

async function fonts() {
  await Promise.all([
    document.fonts.load(`800 120px ${FONT}`),
    document.fonts.load(`700 80px ${FONT}`),
    document.fonts.load(`500 40px ${FONT}`),
  ]).catch(() => undefined);
}

/** The night sky every card sits on: near-black with two soft lights. */
function sky(ctx: CanvasRenderingContext2D, a: string, b: string) {
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, W, H);
  const glowA = ctx.createRadialGradient(W * 0.12, H * 0.08, 0, W * 0.12, H * 0.08, W * 1.05);
  glowA.addColorStop(0, a);
  glowA.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);
  const glowB = ctx.createRadialGradient(W * 0.92, H * 0.88, 0, W * 0.92, H * 0.88, W * 1.1);
  glowB.addColorStop(0, b);
  glowB.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);
}

/** Wavee's mark and a line, centred, with the link under it. */
function signature(ctx: CanvasRenderingContext2D, label: string, link: string) {
  const markSize = 64;
  ctx.font = `700 44px ${FONT}`;
  const lw = ctx.measureText(label).width;
  const rowW = markSize + 22 + lw;
  const rx = (W - rowW) / 2;
  const ry = H - 190;
  mark(ctx, rx, ry - markSize + 14, markSize);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.fillText(label, rx + markSize + 22, ry);
  ctx.textAlign = 'center';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.6)';
  ctx.fillText(link, W / 2, ry + 66);
}

/** Spaced capitals, centred at y. */
function eyebrow(ctx: CanvasRenderingContext2D, text: string, y: number, color = 'rgba(238,241,245,0.7)') {
  ctx.font = `700 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.letterSpacing = '10px';
  ctx.fillText(text, W / 2 + 5, y);
  ctx.letterSpacing = '0px';
}

/** "I'm Founding Listener #12 on Wavee": the badge, made to post. */
export async function renderFoundingCard(person: {
  founding: Founding;
  name: string;
  username: string;
  avatar_url: string | null;
}): Promise<Blob> {
  await fonts();
  const avatar = await loadCover(person.avatar_url);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  sky(ctx, 'rgba(231,163,62,0.30)', 'rgba(132,102,255,0.38)');

  eyebrow(ctx, 'WAVEE FOUNDING 100', 250, GOLD_A);

  // The number, huge, in gold.
  const gold = ctx.createLinearGradient(W * 0.25, 300, W * 0.75, 640);
  gold.addColorStop(0, GOLD_A);
  gold.addColorStop(1, GOLD_B);
  ctx.fillStyle = gold;
  ctx.font = `800 300px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`#${person.founding.number}`, W / 2, 600);

  // Their picture in a gold ring.
  const r = 190;
  const cx = W / 2;
  const cy = 900;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 30;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#0f3d36');
    g.addColorStop(1, '#2a1f5c');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = INK;
    ctx.font = `700 150px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText((person.name.trim()[0] ?? 'W').toUpperCase(), cx, cy + 8);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Who, and what that means.
  ctx.fillStyle = INK;
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(lines(ctx, person.name, W - 160, 1)[0] ?? '', W / 2, 1220);
  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.6)';
  ctx.fillText(`@${person.username}`, W / 2, 1282);

  const role = person.founding.role === 'artist' ? 'Founding Artist' : 'Founding Listener';
  ctx.font = `700 42px ${FONT}`;
  const pw = ctx.measureText(role).width + 80;
  const px = (W - pw) / 2;
  ctx.fillStyle = gold;
  roundRect(ctx, px, 1340, pw, 84, 42);
  ctx.fill();
  ctx.fillStyle = '#1a1206';
  ctx.textBaseline = 'middle';
  ctx.fillText(role, W / 2, 1383);
  ctx.textBaseline = 'alphabetic';

  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.78)';
  const why =
    person.founding.role === 'artist'
      ? 'One of the first artists on Wavee. Hear my music first.'
      : 'One of the first 100 building Wavee: new music, heard first.';
  lines(ctx, why, W - 220, 2).forEach((l, i) => ctx.fillText(l, W / 2, 1520 + i * 54));

  signature(ctx, 'Join on Wavee', `wavee.kaivon.app/founding?ref=${person.username}`);
  return toBlob(canvas);
}

/** This week's Fresh Finds as one story: up to five songs, cover and name. */
export async function renderPicksCard(picks: Picks): Promise<Blob> {
  await fonts();
  const shown = picks.picks.slice(0, 5);
  const covers = await Promise.all(shown.map((p) => loadCover(p.song.cover_image_url)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  sky(ctx, 'rgba(24,226,176,0.30)', 'rgba(132,102,255,0.40)');

  eyebrow(ctx, weekLabel(picks.week).toUpperCase(), 210);
  const title = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  title.addColorStop(0, TEAL);
  title.addColorStop(1, VIOLET);
  ctx.fillStyle = title;
  ctx.font = `800 128px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Fresh Finds', W / 2, 350);
  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.7)';
  ctx.fillText('New music the Wavee team can’t stop playing', W / 2, 420);

  const size = 200;
  const gap = 36;
  const x = 110;
  let y = 520;
  shown.forEach((p, i) => {
    const cover = covers[i];
    ctx.save();
    roundRect(ctx, x, y, size, size, 30);
    ctx.clip();
    if (cover) {
      drawCover(ctx, cover, x, y, size, size);
    } else {
      const g = ctx.createLinearGradient(x, y, x + size, y + size);
      g.addColorStop(0, '#0f3d36');
      g.addColorStop(1, '#2a1f5c');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, size, size);
      mark(ctx, x + size * 0.3, y + size * 0.3, size * 0.4);
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `700 52px ${FONT}`;
    const tx = x + size + 44;
    const tw = W - tx - 100;
    ctx.fillText(lines(ctx, p.song.title, tw, 1)[0] ?? '', tx, y + 92);
    ctx.font = `500 38px ${FONT}`;
    ctx.fillStyle = 'rgba(238,241,245,0.66)';
    ctx.fillText(lines(ctx, artistNames(p.song), tw, 1)[0] ?? '', tx, y + 146);
    y += size + gap;
  });

  signature(ctx, 'Hear them first on Wavee', 'wavee.kaivon.app/picks');
  return toBlob(canvas);
}
