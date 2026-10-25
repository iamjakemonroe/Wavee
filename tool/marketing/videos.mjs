// Wavee ad videos: each is an HTML page whose look is a pure function of time (window.render(t)),
// filmed frame by frame and encoded with ffmpeg. 1080×1920, 30 fps, silent (add a sound in the
// TikTok/Instagram editor, or a founding artist's song with their permission).
// node wavee_videos.mjs <icons.json> <ffmpeg> <out dir> [only]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const [iconsPath, FFMPEG, out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const I = JSON.parse(readFileSync(iconsPath, 'utf8'));
const FONT = '/Users/iamjakemonroe/Desktop/Projects/ProjectX/Wavee/node_modules/.pnpm/@fontsource-variable+inter@5.3.0/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
const URL = 'wavee.kaivon.app/founding';
const FPS = 30;

const mark = (size) => {
  const bars = [[0.45, '#18e2b0'], [0.75, '#33c3c4'], [1, '#4ea4d8'], [0.8, '#6985eb'], [0.55, '#8466ff']];
  const w = size * 0.11, gap = size * 0.08, total = w * 5 + gap * 4;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bars
    .map(([k, c], i) => `<rect x="${(size - total) / 2 + i * (w + gap)}" y="${(size - size * k) / 2}" width="${w}" height="${size * k}" rx="${w / 2}" fill="${c}"/>`)
    .join('')}</svg>`;
};
const logo = (size = 56) =>
  `<div class="logo" style="font-size:${size * 0.62}px"><span class="tile" style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px">${mark(size * 0.78)}</span>Wavee</div>`;
const cover = (a, b, size, r = 28) =>
  `<div class="cover" style="width:${size}px;height:${size}px;border-radius:${r}px;background:radial-gradient(120% 120% at 15% 10%, ${a}, transparent 60%), radial-gradient(120% 120% at 90% 95%, ${b}, transparent 62%), #141824">${mark(size * 0.42)}</div>`;

/** Wraps an element that appears at [a] and leaves at [b] (seconds). */
const at = (a, b, html, fx = 'up', style = '') => `<div data-a="${a}" data-b="${b}" data-fx="${fx}" style="${style}">${html}</div>`;
const scene = (inner, style = '') => `<div class="scene" style="${style}">${inner}</div>`;

const css = `
@font-face { font-family: Inter; src: url("file://${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1920px; overflow: hidden; }
body { font-family: Inter, sans-serif; color: #eef1f5; background: #06070a; -webkit-font-smoothing: antialiased; }
#sky { position: absolute; inset: -10%; }
.scene { position: absolute; inset: 0; padding: 0 96px; display: flex; flex-direction: column; justify-content: center; }
[data-a] { opacity: 0; will-change: transform, opacity; }
.logo { display: inline-flex; align-items: center; gap: .45em; font-weight: 700; letter-spacing: -0.02em; }
.logo .tile { display: grid; place-items: center; background: radial-gradient(circle at 25% 15%, #1b1f2a, #0a0b10); box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
.cover { display: grid; place-items: center; box-shadow: 0 40px 80px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08); flex: none; }
h1 { font-weight: 800; letter-spacing: -0.04em; line-height: 1.02; }
.big { font-size: 150px; }
.mid { font-size: 104px; }
.brand { background: linear-gradient(115deg, #18e2b0, #8466ff); -webkit-background-clip: text; color: transparent; }
.teal { background: linear-gradient(115deg, #18e2b0, #36c5c9); -webkit-background-clip: text; color: transparent; }
.violet { background: linear-gradient(115deg, #a48cff, #8466ff); -webkit-background-clip: text; color: transparent; }
.goldtext { background: linear-gradient(115deg, #f7d98b, #e7a33e); -webkit-background-clip: text; color: transparent; }
.gold { background: linear-gradient(115deg, #f7d98b, #e7a33e); color: #1a1206; }
.muted { color: rgba(238,241,245,.72); }
.lead { font-size: 50px; line-height: 1.3; letter-spacing: -0.015em; }
.eyebrow { font-size: 32px; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; color: rgba(238,241,245,.6); }
.pill { display: inline-flex; align-items: center; gap: .5em; border-radius: 999px; font-weight: 700; }
.chip { display: inline-flex; align-items: center; gap: .45em; border-radius: 999px; font-weight: 700; }
.fb { font-size: 44px; padding: 22px 34px; border-radius: 999px; font-weight: 600; background: rgba(24,226,176,.14); color: #18e2b0; box-shadow: inset 0 0 0 2px rgba(24,226,176,.45); }
.grid { display: grid; grid-template-columns: repeat(10, 74px); gap: 12px; }
.grid span { height: 74px; border-radius: 18px; display: grid; place-items: center; font-weight: 700; font-size: 24px; }
.grid .a { background: rgba(24,226,176,.12); color: rgba(24,226,176,.85); box-shadow: inset 0 0 0 2px rgba(24,226,176,.3); }
.grid .l { background: rgba(132,102,255,.12); color: rgba(178,160,255,.85); box-shadow: inset 0 0 0 2px rgba(132,102,255,.3); }
.grid .me { background: linear-gradient(115deg, #f7d98b, #e7a33e); color: #1a1206; box-shadow: 0 0 50px rgba(231,163,62,.8); }
.wave { display: flex; align-items: center; gap: 10px; height: 220px; }
.wave i { flex: 1; border-radius: 99px; background: linear-gradient(180deg, #18e2b0, #8466ff); }
.row { display: flex; align-items: center; gap: 30px; font-size: 48px; font-weight: 700; letter-spacing: -0.02em; }
.row .ic { width: 104px; height: 104px; border-radius: 30px; display: grid; place-items: center; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 2px rgba(255,255,255,.09); color: #18e2b0; font-size: 52px; flex: none; }
.row small { display: block; font-size: 34px; font-weight: 500; color: rgba(238,241,245,.65); margin-top: 6px; letter-spacing: -0.01em; }
.cta { font-size: 46px; padding: 30px 56px; background: #eef1f5; color: #06070a; }
.url { font-size: 40px; font-weight: 600; color: rgba(238,241,245,.75); }
`;

// The engine: every [data-a] element eases in at its start and out just before its end.
const engine = `
const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const hooks = [];
window.render = (t) => {
  for (const el of document.querySelectorAll('[data-a]')) {
    const a = +el.dataset.a, b = +el.dataset.b, fx = el.dataset.fx;
    const i = ease((t - a) / 0.7), o = ease((t - (b - 0.45)) / 0.45);
    el.style.opacity = (i * (1 - o)).toFixed(3);
    el.style.transform = fx === 'scale' ? 'scale(' + (0.9 + 0.1 * i - 0.04 * o) + ')'
      : fx === 'pop' ? 'scale(' + (0.6 + 0.4 * ease((t - a) / 0.35)) + ')'
      : fx === 'left' ? 'translateX(' + ((1 - i) * -80 + o * 60) + 'px)'
      : fx === 'none' ? ''
      : 'translateY(' + ((1 - i) * 60 - o * 40) + 'px)';
  }
  const sky = document.getElementById('sky');
  sky.style.background = 'radial-gradient(60% 40% at ' + (12 + 8 * Math.sin(t * 0.35)) + '% ' + (6 + 5 * Math.cos(t * 0.3)) + '%, ' + sky.dataset.ga + ', transparent 62%),'
    + 'radial-gradient(70% 45% at ' + (90 - 7 * Math.sin(t * 0.28)) + '% ' + (92 - 6 * Math.cos(t * 0.33)) + '%, ' + sky.dataset.gb + ', transparent 64%)';
  for (const h of hooks) h(t);
};
// A waveform that breathes.
hooks.push((t) => document.querySelectorAll('.wave').forEach((w) => [...w.children].forEach((bar, i) => {
  const k = 0.18 + 0.82 * Math.abs(Math.sin(i * 0.55 + t * 2.2) * Math.cos(i * 0.17 - t * 0.9));
  bar.style.height = (k * 100).toFixed(1) + '%';
  bar.style.opacity = (0.35 + 0.6 * k).toFixed(2);
})));
// Grid cells arrive one by one between data-from and data-to.
hooks.push((t) => document.querySelectorAll('.grid[data-from]').forEach((g) => {
  const from = +g.dataset.from, to = +g.dataset.to, cells = [...g.children];
  cells.forEach((c, i) => { const k = ease((t - from - (i / cells.length) * (to - from)) / 0.25); c.style.opacity = k; c.style.transform = 'scale(' + (0.5 + 0.5 * k) + ')'; });
}));
// Progress bars fill between data-from and data-to.
hooks.push((t) => document.querySelectorAll('[data-fill]').forEach((f) => {
  const [a, b, to] = f.dataset.fill.split(',').map(Number);
  f.style.width = (ease((t - a) / (b - a)) * to) + '%';
}));
// The hook marker slides along the song.
hooks.push((t) => document.querySelectorAll('[data-slide]').forEach((m) => {
  const [a, b, x0, x1] = m.dataset.slide.split(',').map(Number);
  m.style.left = (x0 + (x1 - x0) * ease((t - a) / (b - a))) + '%';
}));
`;

const grid = (from, to) =>
  `<div class="grid" data-from="${from}" data-to="${to}">${Array.from({ length: 100 }, (_, i) =>
    `<span class="${i === 11 ? 'me' : i < 30 ? 'a' : 'l'}">${i + 1}</span>`).join('')}</div>`;
const wave = (n = 40) => `<div class="wave">${'<i></i>'.repeat(n)}</div>`;

const feedCard = (fill) => `
  <div style="width:640px;border-radius:56px;padding:38px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));box-shadow:0 60px 120px -40px rgba(0,0,0,.95), inset 0 0 0 2px rgba(255,255,255,.09)">
    ${cover('rgba(24,226,176,.95)', 'rgba(132,102,255,.95)', 564, 38)}
    <div style="margin-top:34px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:46px;font-weight:800;letter-spacing:-0.02em">Your song</div>
        <div class="muted" style="font-size:32px;margin-top:8px">You</div>
        <div class="chip" style="margin-top:18px;font-size:22px;padding:10px 18px;background:rgba(24,226,176,.16);color:#18e2b0;letter-spacing:.08em">NEW ARTIST</div>
      </div>
      <div style="font-size:54px">${I.LuHeart}</div>
    </div>
    <div style="margin-top:28px;height:10px;border-radius:99px;background:rgba(255,255,255,.1)"><div data-fill="${fill}" style="width:0;height:100%;border-radius:99px;background:linear-gradient(90deg,#18e2b0,#8466ff)"></div></div>
  </div>`;

const covers = (chip) => `
  <div style="position:relative;width:860px;height:600px">
    <div style="position:absolute;left:0;top:90px;transform:rotate(-9deg)">${cover('rgba(255,95,140,.9)', 'rgba(132,102,255,.9)', 400, 48)}</div>
    <div style="position:absolute;right:0;top:80px;transform:rotate(8deg)">${cover('rgba(245,170,80,.95)', 'rgba(24,226,176,.8)', 400, 48)}</div>
    <div style="position:absolute;left:200px;top:0;z-index:2">${cover('rgba(24,226,176,.95)', 'rgba(132,102,255,.95)', 460, 54)}
      <div class="chip gold" style="position:absolute;left:50%;transform:translateX(-50%);bottom:-30px;font-size:28px;padding:16px 28px;white-space:nowrap;box-shadow:0 14px 40px -10px rgba(231,163,62,.9)">${I.LuEar} ${chip}</div>
    </div>
  </div>`;

const cta = (label, a, b) => `
  ${at(a, b, `<div class="pill cta">${label}<span style="display:inline-flex">${I.LuArrowRight}</span></div>`, 'scale')}
  ${at(a + 0.35, b, `<div class="url" style="margin-top:30px">${URL}</div>`)}`;

const end = (a, b) => at(a + 0.7, b, `<div style="margin-top:110px">${logo(96)}</div>`, 'scale');

const videos = {
  'founding-teaser': [16, 'rgba(231,163,62,.30)', 'rgba(132,102,255,.42)', `
    ${scene(`
      ${at(0.3, 3.6, '<h1 class="big">Wavee<br>is new.</h1>')}
      ${at(1.1, 3.6, '<p class="lead muted" style="margin-top:44px">And we’re not pretending otherwise.</p>')}`)}
    ${scene(`
      ${at(3.8, 7.6, '<p class="eyebrow">We’re looking for</p>')}
      ${at(4.3, 7.6, '<h1 class="big teal" style="margin-top:40px">30 artists</h1>')}
      ${at(5.0, 7.6, '<h1 class="big violet" style="margin-top:10px">70 listeners</h1>')}
      ${at(5.8, 7.6, '<p class="lead muted" style="margin-top:50px">to build it with us,<br>from day one.</p>')}`)}
    ${scene(`
      ${at(7.8, 11.8, `<span class="pill gold" style="font-size:34px;padding:18px 32px">${I.LuGem} WAVEE FOUNDING 100</span>`, 'scale')}
      ${at(7.9, 11.8, `<div style="margin-top:60px;display:flex;justify-content:center">${grid(8.1, 10.0)}</div>`, 'none')}
      ${at(10.2, 11.8, '<p class="lead" style="margin-top:56px;text-align:center">Every spot numbered.<br><span class="goldtext" style="font-weight:800">Yours for good.</span></p>')}`)}
    ${scene(`
      ${at(12.0, 16.5, '<h1 class="mid">Claim your<br><span class="brand">spot.</span></h1>')}
      <div style="margin-top:70px">${cta('Join the Founding 100', 12.6, 16.5)}</div>
      ${end(12.6, 16.5)}`)}`],

  'for-artists': [17, 'rgba(24,226,176,.28)', 'rgba(132,102,255,.44)', `
    ${scene(`
      ${at(0.3, 3.4, '<h1 class="mid">Uploaded a song…</h1>')}
      ${at(1.2, 3.4, '<h1 class="mid muted" style="margin-top:30px">…and heard<br>nothing back?</h1>')}`)}
    ${scene(`
      ${at(3.5, 7.4, '<p class="eyebrow" style="text-align:center">On Wavee</p>')}
      ${at(3.7, 7.4, `<div style="margin-top:50px;display:flex;justify-content:center">${feedCard('4.2,7.2,78')}</div>`, 'scale')}
      ${at(4.6, 7.4, '<p class="lead" style="margin-top:60px;text-align:center">Your first songs are played to<br><b class="brand">real listeners. From day one.</b></p>')}`)}
    ${scene(`
      ${at(7.5, 11, '<h1 class="mid">They tell you<br><span class="brand">what worked.</span></h1>')}
      <div style="margin-top:70px;display:flex;flex-wrap:wrap;gap:24px">
        ${at(8.0, 11, '<span class="fb">The hook stuck</span>', 'pop')}
        ${at(8.35, 11, '<span class="fb">Great voice</span>', 'pop')}
        ${at(8.7, 11, '<span class="fb">I’d play it again</span>', 'pop')}
        ${at(9.05, 11, '<span class="fb">The beat hits</span>', 'pop')}
      </div>
      ${at(9.6, 11, '<p class="lead muted" style="margin-top:60px">Privately. Honestly.</p>')}`)}
    ${scene(`
      ${at(11.1, 13.6, '<h1 class="big brand" style="text-align:center">Fresh Finds</h1>')}
      ${at(11.4, 13.6, `<div style="margin-top:70px;display:flex;justify-content:center">${covers('Fresh Find')}</div>`, 'scale')}
      ${at(11.9, 13.6, '<p class="lead" style="margin-top:80px;text-align:center">Every week, we pick new songs<br>and shout them out.</p>')}`)}
    ${scene(`
      ${at(13.7, 17.5, '<h1 class="big">Upload<br><span class="brand">free.</span></h1>')}
      ${at(14.0, 17.5, '<p class="lead muted" style="margin-top:40px">Be one of the first 30<br>founding artists.</p>')}
      <div style="margin-top:60px">${cta('Get heard from day one', 14.3, 17.5)}</div>
      ${end(14.3, 17.5)}`)}`],

  'for-listeners': [13, 'rgba(132,102,255,.40)', 'rgba(24,226,176,.28)', `
    ${scene(`
      ${at(0.3, 3.0, '<h1 style="font-size:190px">Hear it</h1>')}
      ${at(0.8, 3.0, '<h1 class="brand" style="font-size:190px">first.</h1>')}`)}
    ${scene(`
      ${at(3.1, 6.7, `<div style="display:flex;justify-content:center">${covers('You heard it first')}</div>`, 'scale')}
      ${at(3.8, 6.7, '<p class="lead" style="margin-top:110px;text-align:center">Find new artists<br><b class="brand">before everyone else.</b></p>')}`)}
    ${scene(`
      ${at(6.8, 9.9, '<h1 class="mid">And your profile<br><span class="brand">proves it.</span></h1>')}
      <div style="margin-top:80px;display:flex;flex-direction:column;gap:44px">
        ${at(7.3, 9.9, `<div class="row"><span class="ic">${I.LuEar}</span><div>Early Ear<small>Liked it early? It counts when it blows up.</small></div></div>`, 'left')}
        ${at(7.8, 9.9, `<div class="row"><span class="ic">${I.LuFlame}</span><div>Explorer streak<small>3 new artists a week, every week.</small></div></div>`, 'left')}
        ${at(8.3, 9.9, `<div class="row"><span class="ic">${I.LuRadar}</span><div>Fresh Finds<small>New picks every Wednesday.</small></div></div>`, 'left')}
      </div>`)}
    ${scene(`
      ${at(10.0, 13.5, '<h1 class="mid">Be one of the first<br><span class="brand">70 listeners.</span></h1>')}
      <div style="margin-top:70px">${cta('Join the Founding 100', 10.4, 13.5)}</div>
      ${end(10.4, 13.5)}`)}`],

  'how-wavee-works': [24, 'rgba(24,226,176,.26)', 'rgba(132,102,255,.42)', `
    ${scene(`
      ${at(0.3, 3.3, '<p class="eyebrow">How Wavee works</p>')}
      ${at(0.6, 3.3, '<h1 class="big" style="margin-top:40px">New music,<br><span class="brand">heard first.</span></h1>')}
      ${at(1.0, 3.3, `<div style="margin-top:90px">${wave(40)}</div>`, 'none')}`)}
    ${scene(`
      ${at(3.4, 8.1, '<p class="eyebrow" style="color:#18e2b0">1 · Upload free</p>')}
      ${at(3.6, 8.1, '<h1 class="mid" style="margin-top:34px">Mark your<br><span class="brand">best part.</span></h1>')}
      ${at(4.0, 8.1, `<div style="position:relative;margin-top:90px">${wave(40)}<div data-slide="4.4,6.4,8,58" style="position:absolute;top:-30px;bottom:-30px;width:8px;border-radius:8px;background:#f7d98b;box-shadow:0 0 30px rgba(247,217,139,.9)"><div class="chip gold" style="position:absolute;top:-70px;left:50%;transform:translateX(-50%);font-size:26px;padding:10px 20px;white-space:nowrap">The hook</div></div></div>`, 'none')}
      ${at(5.2, 8.1, '<p class="lead muted" style="margin-top:80px">The feed plays every song from its hook, so people know in seconds.</p>')}`)}
    ${scene(`
      ${at(8.2, 13.1, '<p class="eyebrow" style="color:#18e2b0">2 · Heard from day one</p>')}
      ${at(8.4, 13.1, `<div style="margin-top:50px;display:flex;justify-content:center">${feedCard('8.9,12.6,82')}</div>`, 'scale')}
      ${at(9.2, 13.1, '<p class="lead" style="margin-top:60px;text-align:center">Every new artist’s first songs are played<br>to <b class="brand">real listeners</b> in the feed.</p>')}`)}
    ${scene(`
      ${at(13.2, 18.1, '<p class="eyebrow" style="color:#18e2b0">3 · Feedback and Fresh Finds</p>')}
      ${at(13.4, 18.1, '<h1 class="mid" style="margin-top:34px">Real notes,<br><span class="brand">not just numbers.</span></h1>')}
      <div style="margin-top:60px;display:flex;flex-wrap:wrap;gap:24px">
        ${at(14.0, 18.1, '<span class="fb">The hook stuck</span>', 'pop')}
        ${at(14.35, 18.1, '<span class="fb">Great voice</span>', 'pop')}
        ${at(14.7, 18.1, '<span class="fb">I’d share it</span>', 'pop')}
      </div>
      ${at(15.4, 18.1, '<p class="lead muted" style="margin-top:60px">And every week, the Wavee team picks new songs and shouts them out.</p>')}`)}
    ${scene(`
      ${at(18.2, 24.5, `<span class="pill gold" style="font-size:34px;padding:18px 32px">${I.LuGem} 4 · WAVEE FOUNDING 100</span>`, 'scale')}
      ${at(18.5, 24.5, '<h1 class="mid" style="margin-top:44px">30 artists. 70 listeners.<br><span class="goldtext">Numbered for good.</span></h1>')}
      <div style="margin-top:70px">${cta('Claim your spot', 19.4, 24.5)}</div>
      ${end(19.4, 24.5)}`)}`],
};

const b = await chromium.launch({ channel: 'chrome' });
for (const [name, [seconds, glowA, glowB, body]] of Object.entries(videos)) {
  if (only && name !== only) continue;
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div id="sky" data-ga="${glowA}" data-gb="${glowB}"></div>
    <div style="position:absolute;top:110px;left:96px;z-index:5">${logo(64)}</div>
    ${body}
    <script>${engine}</script></body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = `${out}/${name}.mp4`;
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', file]);
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code ? reject(new Error(`ffmpeg ${code}`)) : resolve())));
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f === Math.round(frames * 0.5)) await page.screenshot({ path: `${out}/${name}-mid.png` });
  }
  ff.stdin.end();
  await done;
  await page.close();
  console.log('made', name, `${seconds}s`);
}
await b.close();
