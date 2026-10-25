// Wavee growth ads: each picture is a small HTML page, rendered to PNG at its exact size.
// node wavee_ads.mjs <icons.json> <out dir> [only]
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import QR from 'qrcode';

const [iconsPath, out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const I = JSON.parse(readFileSync(iconsPath, 'utf8'));
const FONT = '/Users/iamjakemonroe/Desktop/Projects/ProjectX/Wavee/node_modules/.pnpm/@fontsource-variable+inter@5.3.0/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
const URL_FOUNDING = 'wavee.kaivon.app/founding';

const mark = (size) => {
  const bars = [[0.45, '#18e2b0'], [0.75, '#33c3c4'], [1, '#4ea4d8'], [0.8, '#6985eb'], [0.55, '#8466ff']];
  const w = size * 0.11, gap = size * 0.08, total = w * 5 + gap * 4;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bars
    .map(([k, c], i) => `<rect x="${(size - total) / 2 + i * (w + gap)}" y="${(size - size * k) / 2}" width="${w}" height="${size * k}" rx="${w / 2}" fill="${c}"/>`)
    .join('')}</svg>`;
};
const logo = (size = 56) =>
  `<div class="logo" style="font-size:${size * 0.62}px"><span class="tile" style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px">${mark(size * 0.78)}</span>Wavee</div>`;

/** A song cover with no real artwork: a soft gradient and the mark. */
const cover = (a, b, size, r = 28) =>
  `<div class="cover" style="width:${size}px;height:${size}px;border-radius:${r}px;background:radial-gradient(120% 120% at 15% 10%, ${a}, transparent 60%), radial-gradient(120% 120% at 90% 95%, ${b}, transparent 62%), #141824">${mark(size * 0.42)}</div>`;

const wave = (n, h, k0 = 0.7) =>
  `<div class="wave" style="height:${h}px">${Array.from({ length: n }, (_, i) => {
    const k = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.55 + k0) * Math.cos(i * 0.17));
    return `<i style="height:${Math.round(k * 100)}%;opacity:${(0.35 + 0.6 * k).toFixed(2)}"></i>`;
  }).join('')}</div>`;

/** 100 numbered spots; one glows. */
const grid = (cell, gap, glow = 0) =>
  `<div class="grid" style="grid-template-columns:repeat(10,${cell}px);gap:${gap}px">${Array.from({ length: 100 }, (_, i) =>
    `<span class="${i === glow ? 'me' : i < 30 ? 'a' : 'l'}" style="height:${cell}px;font-size:${cell * 0.32}px">${i + 1}</span>`).join('')}</div>`;

const css = `
@font-face { font-family: Inter; src: url("file://${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body { font-family: Inter, sans-serif; color: #eef1f5; background: #06070a; overflow: hidden; -webkit-font-smoothing: antialiased; }
.page { position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.glow { position: absolute; inset: 0; pointer-events: none; }
.logo { display: inline-flex; align-items: center; gap: .45em; font-weight: 700; letter-spacing: -0.02em; }
.logo .tile { display: grid; place-items: center; background: radial-gradient(circle at 25% 15%, #1b1f2a, #0a0b10); box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
.cover { display: grid; place-items: center; box-shadow: 0 40px 80px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.08); flex: none; }
.eyebrow { font-weight: 700; letter-spacing: .32em; text-transform: uppercase; }
.gold { background: linear-gradient(115deg, #f7d98b, #e7a33e); color: #1a1206; }
.goldtext { background: linear-gradient(115deg, #f7d98b, #e7a33e); -webkit-background-clip: text; color: transparent; }
.brand { background: linear-gradient(115deg, #18e2b0, #8466ff); -webkit-background-clip: text; color: transparent; }
.pill { display: inline-flex; align-items: center; gap: .5em; border-radius: 999px; font-weight: 700; }
h1 { font-weight: 800; letter-spacing: -0.035em; line-height: 1.02; }
.muted { color: rgba(238,241,245,.7); }
.faint { color: rgba(238,241,245,.5); }
.wave { display: flex; align-items: center; gap: 9px; }
.wave i { flex: 1; border-radius: 99px; background: linear-gradient(90deg, #18e2b0, #8466ff); background-size: 1200px 100%; }
.grid { display: grid; }
.grid span { display: grid; place-items: center; border-radius: 22%; font-weight: 700; font-variant-numeric: tabular-nums; }
.grid .a { background: rgba(24,226,176,.10); color: rgba(24,226,176,.75); box-shadow: inset 0 0 0 1.5px rgba(24,226,176,.28); }
.grid .l { background: rgba(132,102,255,.10); color: rgba(178,160,255,.75); box-shadow: inset 0 0 0 1.5px rgba(132,102,255,.28); }
.grid .me { background: linear-gradient(115deg, #f7d98b, #e7a33e); color: #1a1206; box-shadow: 0 0 40px rgba(231,163,62,.75); }
.perk { display: flex; gap: 28px; align-items: flex-start; }
.perk .ic { flex: none; display: grid; place-items: center; border-radius: 26px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.08); color: #18e2b0; }
.perk b { display: block; font-weight: 700; letter-spacing: -0.015em; }
.chip { display: inline-flex; align-items: center; gap: .4em; border-radius: 999px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.qr { background: #fff; border-radius: 32px; display: grid; place-items: center; }
`;

const sky = (a, b) =>
  `<div class="glow" style="background: radial-gradient(70% 45% at 8% 4%, ${a}, transparent 62%), radial-gradient(75% 50% at 96% 96%, ${b}, transparent 64%)"></div>`;

const cta = (label, url, size = 40) => `
  <div style="display:flex;flex-direction:column;align-items:center;gap:${size * 0.55}px">
    <div class="pill" style="font-size:${size}px;padding:${size * 0.55}px ${size * 1.1}px;background:#eef1f5;color:#06070a">${label}<span style="font-size:1.05em;display:inline-flex">${I.LuArrowRight}</span></div>
    <div class="muted" style="font-size:${size * 0.85}px;font-weight:600;letter-spacing:-0.01em">${url}</div>
  </div>`;

const perks = (items, size) =>
  items.map(([icon, title, text]) => `
    <div class="perk">
      <span class="ic" style="width:${size * 2.3}px;height:${size * 2.3}px;font-size:${size * 1.15}px">${I[icon]}</span>
      <div><b style="font-size:${size * 1.08}px">${title}</b><span class="muted" style="font-size:${size * 0.86}px;line-height:1.4;display:block;margin-top:6px">${text}</span></div>
    </div>`).join('');

/** The feed card, drawn simply: a new artist's song with its chip. No numbers. */
const feedCard = (scale = 1) => `
  <div style="width:${560 * scale}px;border-radius:${48 * scale}px;padding:${34 * scale}px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));box-shadow:0 60px 120px -40px rgba(0,0,0,.95), inset 0 0 0 1.5px rgba(255,255,255,.09)">
    ${cover('rgba(24,226,176,.95)', 'rgba(132,102,255,.95)', 492 * scale, 34 * scale)}
    <div style="margin-top:${30 * scale}px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:${40 * scale}px;font-weight:800;letter-spacing:-0.02em">Your song</div>
        <div class="muted" style="font-size:${28 * scale}px;margin-top:${6 * scale}px">You</div>
        <div class="chip" style="margin-top:${16 * scale}px;font-size:${19 * scale}px;padding:${8 * scale}px ${16 * scale}px;background:rgba(24,226,176,.16);color:#18e2b0">New artist</div>
      </div>
      <div style="font-size:${46 * scale}px;color:#eef1f5;opacity:.9">${I.LuHeart}</div>
    </div>
    <div style="margin-top:${24 * scale}px;height:${8 * scale}px;border-radius:99px;background:rgba(255,255,255,.1)"><div style="width:42%;height:100%;border-radius:99px;background:linear-gradient(90deg,#18e2b0,#8466ff)"></div></div>
  </div>`;

const covers = (scale = 1) => `
  <div style="position:relative;width:${700 * scale}px;height:${520 * scale}px">
    <div style="position:absolute;left:0;top:${70 * scale}px;transform:rotate(-9deg)">${cover('rgba(255,95,140,.9)', 'rgba(132,102,255,.9)', 340 * scale, 40 * scale)}</div>
    <div style="position:absolute;right:0;top:${60 * scale}px;transform:rotate(8deg)">${cover('rgba(245,170,80,.95)', 'rgba(24,226,176,.8)', 340 * scale, 40 * scale)}</div>
    <div style="position:absolute;left:${170 * scale}px;top:0;z-index:2">${cover('rgba(24,226,176,.95)', 'rgba(132,102,255,.95)', 380 * scale, 44 * scale)}
      <div class="chip gold" style="position:absolute;left:50%;transform:translateX(-50%);bottom:${-26 * scale}px;font-size:${22 * scale}px;padding:${12 * scale}px ${22 * scale}px;white-space:nowrap;box-shadow:0 14px 40px -10px rgba(231,163,62,.9)">${I.LuEar} You heard it first</div>
    </div>
  </div>`;

const ads = {
  // ── Founding 100 ──
  'founding-story': [1080, 1920, `
    ${sky('rgba(231,163,62,.30)', 'rgba(132,102,255,.40)')}
    <div class="page" style="padding:110px 90px 120px">
      ${logo(64)}
      <div style="margin-top:80px"><span class="pill gold" style="font-size:30px;padding:14px 28px">${I.LuGem} WAVEE FOUNDING 100</span></div>
      <h1 style="font-size:124px;margin-top:40px">Build Wavee<br><span class="brand">from day one.</span></h1>
      <p class="muted" style="font-size:44px;line-height:1.35;margin-top:30px;letter-spacing:-0.01em">30 artists. 70 listeners.<br>Numbered for good.</p>
      <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:70px">
        ${grid(64, 11, 11)}
        ${cta('Claim your spot', URL_FOUNDING, 42)}
      </div>
    </div>`],
  'founding-square': [1080, 1080, `
    ${sky('rgba(231,163,62,.28)', 'rgba(132,102,255,.36)')}
    <div class="page" style="padding:80px">
      <div style="display:flex;justify-content:space-between;align-items:center">${logo(52)}<span class="pill gold" style="font-size:24px;padding:12px 22px">${I.LuGem} FOUNDING 100</span></div>
      <div style="display:flex;gap:56px;align-items:center;margin-top:auto;margin-bottom:auto">
        <div style="flex:1">
          <h1 style="font-size:72px">Build Wavee<br><span class="brand">from day one.</span></h1>
          <p class="muted" style="font-size:32px;line-height:1.4;margin-top:26px">30 artists. 70 listeners.<br>Your number is yours for good.</p>
        </div>
        ${grid(30, 5, 11)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="pill" style="font-size:32px;padding:20px 36px;background:#eef1f5;color:#06070a">Claim your spot ${I.LuArrowRight}</div>
        <div class="muted" style="font-size:30px;font-weight:600">${URL_FOUNDING}</div>
      </div>
    </div>`],

  // ── Artists ──
  'artists-story': [1080, 1920, `
    ${sky('rgba(24,226,176,.26)', 'rgba(132,102,255,.42)')}
    <div class="page" style="padding:110px 90px 120px">
      ${logo(64)}
      <div class="eyebrow" style="font-size:28px;color:#18e2b0;margin-top:72px">For artists</div>
      <h1 style="font-size:104px;margin-top:22px">Make music?<br><span class="brand">Get heard<br>from day one.</span></h1>
      <div style="display:flex;justify-content:center;margin-top:56px">${feedCard(0.72)}</div>
      <div style="display:flex;flex-direction:column;gap:34px;margin-top:56px">
        ${perks([
          ['LuSparkles', 'First listens', 'Your first songs are played to real listeners in the feed.'],
          ['LuMessageSquareHeart', 'Honest feedback', 'Listeners tell you what worked, and what didn’t.'],
          ['LuRadar', 'Fresh Finds', 'Every week we pick new songs and shout them out.'],
        ], 36)}
      </div>
      <div style="margin-top:auto">${cta('Upload free', URL_FOUNDING, 42)}</div>
    </div>`],
  'artists-square': [1080, 1080, `
    ${sky('rgba(24,226,176,.24)', 'rgba(132,102,255,.40)')}
    <div class="page" style="padding:80px;flex-direction:row;gap:50px;align-items:center">
      <div style="flex:1;display:flex;flex-direction:column;height:100%">
        ${logo(50)}
        <h1 style="font-size:80px;margin-top:auto">Make music?<br><span class="brand">Get heard from day one.</span></h1>
        <div style="display:flex;flex-direction:column;gap:26px;margin-top:44px">
          ${perks([
            ['LuSparkles', 'First listens', 'Real listeners in the feed, from your first song.'],
            ['LuMessageSquareHeart', 'Honest feedback', 'What worked, and what didn’t.'],
          ], 27)}
        </div>
        <div style="margin-top:auto" class="muted"><span class="pill" style="font-size:28px;padding:16px 30px;background:#eef1f5;color:#06070a;margin-bottom:18px">Upload free ${I.LuArrowRight}</span><div style="font-size:26px;font-weight:600;margin-top:16px">${URL_FOUNDING}</div></div>
      </div>
      ${feedCard(0.62)}
    </div>`],

  // ── Listeners ──
  'listeners-story': [1080, 1920, `
    ${sky('rgba(132,102,255,.36)', 'rgba(24,226,176,.26)')}
    <div class="page" style="padding:110px 90px 120px">
      ${logo(64)}
      <div class="eyebrow" style="font-size:28px;color:#b6a6ff;margin-top:72px">For listeners</div>
      <h1 style="font-size:140px;margin-top:22px">Hear it<br><span class="brand">first.</span></h1>
      <p class="muted" style="font-size:44px;line-height:1.35;margin-top:30px">Find new artists before everyone else, and get the credit when they blow up.</p>
      <div style="display:flex;justify-content:center;margin-top:64px">${covers(0.95)}</div>
      <div style="display:flex;flex-direction:column;gap:34px;margin-top:76px">
        ${perks([
          ['LuRadar', 'Fresh Finds every week', 'New songs the team can’t stop playing.'],
          ['LuEar', 'Early Ear', 'Like a song early: your profile proves you found it first.'],
        ], 36)}
      </div>
      <div style="margin-top:auto">${cta('Be a founding listener', URL_FOUNDING, 42)}</div>
    </div>`],
  'listeners-square': [1080, 1080, `
    ${sky('rgba(132,102,255,.34)', 'rgba(24,226,176,.24)')}
    <div class="page" style="padding:80px">
      ${logo(50)}
      <div style="display:flex;align-items:center;gap:20px;margin-top:auto;margin-bottom:auto">
        <div style="flex:1">
          <h1 style="font-size:120px">Hear it<br><span class="brand">first.</span></h1>
          <p class="muted" style="font-size:32px;line-height:1.4;margin-top:24px">New artists before everyone else, and the credit when they blow up.</p>
        </div>
        <div style="width:460px;display:flex;justify-content:center">${covers(0.66)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="pill" style="font-size:30px;padding:18px 34px;background:#eef1f5;color:#06070a">Join the first 70 ${I.LuArrowRight}</div>
        <div class="muted" style="font-size:28px;font-weight:600">${URL_FOUNDING}</div>
      </div>
    </div>`],

  // ── Instagram carousel ──
  'carousel-1': [1080, 1350, `
    ${sky('rgba(24,226,176,.26)', 'rgba(132,102,255,.42)')}
    <div class="page" style="padding:90px">
      ${logo(56)}
      <div style="margin-top:auto">
        <div class="eyebrow faint" style="font-size:26px">How Wavee works</div>
        <h1 style="font-size:132px;margin-top:24px">New music,<br><span class="brand">heard first.</span></h1>
      </div>
      <div style="margin-top:70px">${wave(46, 150)}</div>
      <div class="muted" style="margin-top:70px;font-size:32px;font-weight:600;display:flex;align-items:center;gap:12px">Swipe ${I.LuChevronsRight}</div>
    </div>`],
  'carousel-2': [1080, 1350, `
    ${sky('rgba(24,226,176,.22)', 'rgba(132,102,255,.30)')}
    <div class="page" style="padding:90px">
      <div class="eyebrow" style="font-size:28px;color:#18e2b0">1 · Upload free</div>
      <h1 style="font-size:96px;margin-top:28px">Your song.<br><span class="brand">Best part first.</span></h1>
      <p class="muted" style="font-size:38px;line-height:1.4;margin-top:34px">Upload your song, cover and video. Mark the hook: the feed plays every song from its best part, so people know in seconds.</p>
      <div style="margin-top:auto;display:flex;justify-content:center">${feedCard(0.78)}</div>
    </div>`],
  'carousel-3': [1080, 1350, `
    ${sky('rgba(132,102,255,.30)', 'rgba(24,226,176,.24)')}
    <div class="page" style="padding:90px">
      <div class="eyebrow" style="font-size:28px;color:#18e2b0">2 · Heard from day one</div>
      <h1 style="font-size:96px;margin-top:28px">Nobody uploads<br><span class="brand">into silence.</span></h1>
      <div style="display:flex;flex-direction:column;gap:44px;margin-top:auto;margin-bottom:auto">
        ${perks([
          ['LuSparkles', 'First listens', 'Every new artist’s first songs are played to real listeners in the feed.'],
          ['LuMessageSquareHeart', 'Honest feedback', 'Listeners tell you what worked, and what didn’t. Privately.'],
          ['LuRadar', 'Fresh Finds', 'Every week the team picks new songs and says why.'],
          ['LuTrophy', 'Real charts', 'Only real listens count: never your own plays, never paid ones.'],
        ], 38)}
      </div>
    </div>`],
  'carousel-4': [1080, 1350, `
    ${sky('rgba(231,163,62,.28)', 'rgba(132,102,255,.40)')}
    <div class="page" style="padding:90px;align-items:center;text-align:center">
      <span class="pill gold" style="font-size:28px;padding:14px 26px">${I.LuGem} 3 · WAVEE FOUNDING 100</span>
      <h1 style="font-size:88px;margin-top:36px">Be one of<br><span class="goldtext">the first 100.</span></h1>
      <p class="muted" style="font-size:36px;line-height:1.4;margin-top:24px">30 artists and 70 listeners, numbered for good.</p>
      <div style="margin-top:auto;margin-bottom:auto">${grid(54, 9, 11)}</div>
      ${cta('Link in bio', URL_FOUNDING, 40)}
    </div>`],

  // ── Link previews (go in the app's public folder) ──
  'og-founding': [1200, 630, `
    ${sky('rgba(231,163,62,.30)', 'rgba(132,102,255,.40)')}
    <div class="page" style="padding:64px;flex-direction:row;align-items:center;gap:56px">
      <div style="flex:1;display:flex;flex-direction:column;height:100%">
        ${logo(46)}
        <div style="margin-top:auto"><span class="pill gold" style="font-size:20px;padding:10px 18px">${I.LuGem} WAVEE FOUNDING 100</span></div>
        <h1 style="font-size:72px;margin-top:22px">Build Wavee<br><span class="brand">from day one.</span></h1>
        <p class="muted" style="font-size:27px;margin-top:20px">30 artists. 70 listeners. Numbered for good.</p>
      </div>
      ${grid(40, 7, 11)}
    </div>`],
  'og-picks': [1200, 630, `
    ${sky('rgba(24,226,176,.28)', 'rgba(132,102,255,.42)')}
    <div class="page" style="padding:64px;flex-direction:row;align-items:center;gap:40px">
      <div style="flex:1;display:flex;flex-direction:column;height:100%">
        ${logo(46)}
        <div class="eyebrow faint" style="font-size:20px;margin-top:auto">This week on Wavee</div>
        <h1 style="font-size:92px;margin-top:16px"><span class="brand">Fresh Finds</span></h1>
        <p class="muted" style="font-size:28px;line-height:1.4;margin-top:18px">New songs the Wavee team can’t stop playing, and why.</p>
      </div>
      <div style="width:470px;display:flex;justify-content:center;transform:translateY(10px)">${covers(0.68).replace('You heard it first', 'Fresh Find')}</div>
    </div>`],
};

// ── Accounts: profile picture, X header, Instagram highlight covers ──
ads['profile-picture'] = [1080, 1080, `
  <div class="page" style="align-items:center;justify-content:center;background:radial-gradient(70% 70% at 25% 15%, #1b1f2a, #06070a)">
    ${sky('rgba(24,226,176,.22)', 'rgba(132,102,255,.30)')}
    <div style="position:relative">${mark(620)}</div>
  </div>`];
ads['x-header'] = [1500, 500, `
  ${sky('rgba(24,226,176,.26)', 'rgba(132,102,255,.40)')}
  <div class="page" style="padding:0 80px 0 520px;flex-direction:row;align-items:center;gap:50px">
    <div style="flex:1">
      <h1 style="font-size:96px">Hear it <span class="brand">first.</span></h1>
      <p class="muted" style="font-size:30px;margin-top:18px">New music, straight from the artists · wavee.kaivon.app</p>
    </div>
  </div>
  <div style="position:absolute;left:40px;right:40px;bottom:36px;opacity:.5">${wave(90, 70)}</div>`];
for (const [name, icon, color, label] of [
  ['highlight-founding', 'LuGem', 'linear-gradient(115deg,#f7d98b,#e7a33e)', 'Founding'],
  ['highlight-artists', 'LuMicVocal', 'linear-gradient(115deg,#18e2b0,#4ea4d8)', 'Artists'],
  ['highlight-finds', 'LuRadar', 'linear-gradient(115deg,#4ea4d8,#8466ff)', 'Fresh Finds'],
  ['highlight-how', 'LuCompass', 'linear-gradient(115deg,#18e2b0,#8466ff)', 'How it works'],
]) {
  ads[name] = [1080, 1920, `
    <div class="page" style="align-items:center;justify-content:center;background:#06070a">
      <div style="width:620px;height:620px;border-radius:50%;display:grid;place-items:center;background:${color};color:#06070a;font-size:300px" aria-label="${label}">${I[icon]}</div>
    </div>`];
}

// ── Explainers: what Wavee is, and what it gives artists ──
ads['explainer-what'] = [1080, 1350, `
  ${sky('rgba(24,226,176,.24)', 'rgba(132,102,255,.40)')}
  <div class="page" style="padding:90px">
    ${logo(56)}
    <h1 style="font-size:92px;margin-top:70px">What is <span class="brand">Wavee?</span></h1>
    <p class="muted" style="font-size:38px;line-height:1.4;margin-top:24px">A music app where new songs are heard first: artists drop them, fans find them before anyone else.</p>
    <div style="display:flex;flex-direction:column;gap:40px;margin-top:64px">
      ${perks([
        ['LuHeadphones', 'For listeners', 'A feed of new music that plays every song from its best part. Like early, get the credit.'],
        ['LuMicVocal', 'For artists', 'Upload free. Your first songs are played to real listeners, with honest feedback.'],
        ['LuTrophy', 'Honest by design', 'Charts count real listens only: never the artist’s own plays, never paid ones.'],
      ], 36)}
    </div>
    <div class="muted" style="margin-top:auto;font-size:32px;font-weight:600">wavee.kaivon.app</div>
  </div>`];
ads['explainer-artists'] = [1080, 1350, `
  ${sky('rgba(24,226,176,.24)', 'rgba(132,102,255,.40)')}
  <div class="page" style="padding:90px">
    ${logo(56)}
    <h1 style="font-size:84px;margin-top:60px">Wavee <span class="brand">for artists</span></h1>
    <div style="display:flex;flex-direction:column;gap:30px;margin-top:56px">
      ${perks([
        ['LuUpload', 'Upload free', 'Songs, cover art and video. Mark the hook; the feed plays from there.'],
        ['LuSparkles', 'First listens', 'Your first three songs go to real listeners in the feed.'],
        ['LuMessageSquareHeart', 'Honest feedback', 'Listeners tell you what worked, and what didn’t.'],
        ['LuRadar', 'Fresh Finds', 'Every week we pick new songs and shout them out.'],
        ['LuChartColumn', 'Your stats', 'Who’s listening, where plays come from, how you’re growing.'],
        ['LuLink', 'Your link in bio', 'One page with every platform you’re on.'],
      ], 30)}
    </div>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center">
      <div class="pill" style="font-size:30px;padding:18px 32px;background:#eef1f5;color:#06070a">Upload free ${I.LuArrowRight}</div>
      <div class="muted" style="font-size:28px;font-weight:600">${URL_FOUNDING}</div>
    </div>
  </div>`];

// ── The QR poster (A4) ──
const qrSvg = await QR.toString(`https://${URL_FOUNDING}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#06070a', light: '#ffffff' } });
ads['qr-poster'] = [1240, 1754, `
  ${sky('rgba(231,163,62,.26)', 'rgba(132,102,255,.40)')}
  <div class="page" style="padding:96px;align-items:center;text-align:center">
    ${logo(70)}
    <div class="eyebrow faint" style="font-size:28px;margin-top:80px">Make music? Love new music?</div>
    <h1 style="font-size:104px;margin-top:26px">Join the<br><span class="goldtext">Wavee Founding 100</span></h1>
    <p class="muted" style="font-size:36px;line-height:1.4;margin-top:28px;max-width:900px">The first 30 artists and 70 listeners, numbered for good. Your first songs heard from day one. New music, heard first.</p>
    <div class="qr" style="margin-top:70px;width:560px;height:560px;padding:48px;box-shadow:0 40px 120px -30px rgba(231,163,62,.55)">${qrSvg.replace('<svg', '<svg width="464" height="464"')}</div>
    <div style="margin-top:44px;font-size:40px;font-weight:800;display:flex;align-items:center;gap:14px">${I.LuScanLine} Scan to claim your spot</div>
    <div class="muted" style="margin-top:14px;font-size:32px;font-weight:600">${URL_FOUNDING}</div>
    <div style="margin-top:auto;display:flex;gap:28px;justify-content:center">
      ${[['LuSparkles', 'First listens'], ['LuMessageSquareHeart', 'Honest feedback'], ['LuRadar', 'Fresh Finds weekly']].map(([ic, t]) =>
        `<span class="pill" style="font-size:28px;padding:16px 26px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.1)"><span style="color:#18e2b0;display:inline-flex">${I[ic]}</span>${t}</span>`).join('')}
    </div>
  </div>`];

const b = await chromium.launch({ channel: 'chrome' });
for (const [name, [w, h, body]] of Object.entries(ads)) {
  if (only && !name.startsWith(only)) continue;
  const scale = name === 'qr-poster' ? 2 : 1;
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.close();
  console.log('made', name);
}
await b.close();
