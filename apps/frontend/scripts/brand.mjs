// Wavee's mark (five equaliser bars, teal to violet) as the favicon, app
// icons and the link-preview picture. Run: pnpm icons
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const pub = new URL('../public/', import.meta.url);
const heights = [0.45, 0.75, 1, 0.8, 0.55];
const teal = [24, 226, 176];
const violet = [132, 102, 255];
const mix = (t) => `rgb(${teal.map((c, i) => Math.round(c + (violet[i] - c) * t)).join(' ')})`;

/** The bars, centred in a box of [size], [scale] of it tall. */
function bars(size, scale, x0 = 0, y0 = 0) {
  const h = size * scale;
  const w = h * 0.13;
  const gap = h * 0.095;
  const total = w * 5 + gap * 4;
  return heights
    .map((k, i) => {
      const bh = h * k;
      const x = x0 + (size - total) / 2 + i * (w + gap);
      const y = y0 + (size - bh) / 2;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${bh.toFixed(2)}" rx="${(w / 2).toFixed(2)}" fill="${mix(i / 4)}"/>`;
    })
    .join('');
}

const tile = (size, { radius = 0.23, scale = 0.5 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><radialGradient id="g" cx="25%" cy="15%" r="95%"><stop offset="0" stop-color="#1b1f2a"/><stop offset="1" stop-color="#0a0b10"/></radialGradient></defs>
<rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#g)"/>${bars(size, scale)}</svg>`;

writeFileSync(new URL('favicon.svg', pub), tile(64, { scale: 0.56 }));
writeFileSync(new URL('wavee-mark.svg', pub), tile(512));
await sharp(Buffer.from(tile(192, { radius: 0 }))).png().toFile(new URL('icon-192.png', pub).pathname);
await sharp(Buffer.from(tile(512, { radius: 0 }))).png().toFile(new URL('icon-512.png', pub).pathname);
await sharp(Buffer.from(tile(512, { radius: 0, scale: 0.4 }))).png().toFile(new URL('icon-maskable.png', pub).pathname);
await sharp(Buffer.from(tile(180, { radius: 0 }))).png().toFile(new URL('apple-touch-icon.png', pub).pathname);

const W = 1200;
const H = 630;
const glowBars = Array.from({ length: 34 }, (_, i) => {
  const k = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.62) * Math.cos(i * 0.21));
  const bw = 16;
  const x = 600 + i * 18;
  const bh = 380 * k;
  return `<rect x="${x}" y="${(H - bh) / 2}" width="${bw - 6}" height="${bh}" rx="5" fill="${mix(i / 33)}" opacity="${(0.25 + 0.5 * k).toFixed(2)}"/>`;
}).join('');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="a" cx="20%" cy="10%" r="70%"><stop offset="0" stop-color="rgb(24 226 176 / 0.28)"/><stop offset="1" stop-color="rgb(24 226 176 / 0)"/></radialGradient>
<radialGradient id="b" cx="85%" cy="90%" r="70%"><stop offset="0" stop-color="rgb(132 102 255 / 0.38)"/><stop offset="1" stop-color="rgb(132 102 255 / 0)"/></radialGradient>
<linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="rgb(24 226 176)"/><stop offset="1" stop-color="rgb(132 102 255)"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#06070a"/><rect width="${W}" height="${H}" fill="url(#a)"/><rect width="${W}" height="${H}" fill="url(#b)"/>
${glowBars}
<g transform="translate(80 150)">${tile(96).replace(/<\/?svg[^>]*>/g, '').replace('id="g"', 'id="g2"').replace('url(#g)', 'url(#g2)')}</g>
<text x="80" y="340" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="92" font-weight="700" letter-spacing="-3" fill="#eef1f5">Wavee</text>
<text x="82" y="408" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="36" font-weight="500" fill="url(#t)">Hear it first.</text>
<text x="82" y="520" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="22" fill="#8a93a6">New music straight from the artists · wavee.kaivon.app</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(new URL('og.png', pub).pathname);
console.log('Wrote the favicon, icons and og.png in public/');
