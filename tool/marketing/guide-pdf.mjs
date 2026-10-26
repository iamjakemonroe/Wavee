// The Wavee growth folder as one PDF (A5, for phones): every step, its messages, and its pictures.
// node wavee_guide_pdf.mjs <growth folder> <video stills dir>
import { chromium } from 'playwright';
import { marked } from 'marked';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [G, STILLS] = process.argv.slice(2);
const FONT = '/Users/iamjakemonroe/Desktop/Projects/ProjectX/Wavee/node_modules/.pnpm/@fontsource-variable+inter@5.3.0/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';
const md = (p) => marked.parse(readFileSync(`${G}/${p}`, 'utf8'));
const img = (p, caption, wide = false) => {
  const file = existsSync(`${G}/${p}`) ? `${G}/${p}` : p;
  return `<figure class="${wide ? 'wide' : ''}"><img src="${pathToFileURL(file).href}"><figcaption>${caption}</figcaption></figure>`;
};
const gallery = (title, items) => `<section class="gallery"><h3>${title}</h3><div class="grid">${items.join('')}</div></section>`;

const sections = [
  ['', md('00 Start here.md')],
  ['Step 1', md('01 Set up your accounts/Do this.md') + gallery('The pictures and video for step 1', [
    img('01 Set up your accounts/profile-picture.png', 'profile-picture.png'),
    img('01 Set up your accounts/highlight-founding.png', 'highlight-founding.png'),
    img('01 Set up your accounts/highlight-artists.png', 'highlight-artists.png'),
    img('01 Set up your accounts/highlight-finds.png', 'highlight-finds.png'),
    img('01 Set up your accounts/x-header.png', 'x-header.png', true),
    img('01 Set up your accounts/First posts/carousel-1.png', 'carousel-1.png'),
    img('01 Set up your accounts/First posts/carousel-2.png', 'carousel-2.png'),
    img('01 Set up your accounts/First posts/carousel-3.png', 'carousel-3.png'),
    img('01 Set up your accounts/First posts/carousel-4.png', 'carousel-4.png'),
    img('01 Set up your accounts/First posts/explainer-what.png', 'explainer-what.png'),
    img(`${STILLS}/how-wavee-works-mid.png`, 'Video: how-wavee-works.mp4 (24 s)'),
  ])],
  ['Step 2', md('02 Find your first artists/Do this.md') + md('02 Find your first artists/How we choose founding artists.md')
    + md('02 Find your first artists/What to offer known artists.md') + md('02 Find your first artists/Messages to artists.md') + gallery('Send with your message', [
    img('02 Find your first artists/Send with your message/explainer-artists.png', 'explainer-artists.png'),
    img('02 Find your first artists/Send with your message/artists-story.png', 'artists-story.png'),
    img('02 Find your first artists/Send with your message/artists-square.png', 'artists-square.png'),
    img(`${STILLS}/for-artists-mid.png`, 'Video: for-artists.mp4 (17 s)'),
  ])],
  ['Step 3', md('03 Find your first listeners/Do this.md') + md('03 Find your first listeners/Messages to listeners.md') + gallery('Send with your message', [
    img('03 Find your first listeners/Send with your message/listeners-story.png', 'listeners-story.png'),
    img('03 Find your first listeners/Send with your message/listeners-square.png', 'listeners-square.png'),
    img(`${STILLS}/for-listeners-mid.png`, 'Video: for-listeners.mp4 (13 s)'),
  ])],
  ['Step 4', md('04 Launch week/Do this.md') + gallery('The launch pictures and video', [
    img('04 Launch week/founding-story.png', 'founding-story.png'),
    img('04 Launch week/founding-square.png', 'founding-square.png'),
    img(`${STILLS}/founding-teaser-mid.png`, 'Video: founding-teaser.mp4 (16 s)'),
    img('04 Launch week/qr-poster.png', 'qr-poster.png (print A4)'),
  ])],
  ['Step 5', md('05 Every week/Do this.md')],
  ['Step 6', md('06 Grow to 1,000/Do this.md') + md('06 Grow to 1,000/Messages to partners.md')],
  ['Extras', md('Extras/Reply to your friend.md')],
];

const css = `
@font-face { font-family: Inter; src: url("file://${FONT}") format("woff2"); font-weight: 100 900; }
@page { size: A5; margin: 14mm 12mm 16mm; }
* { box-sizing: border-box; }
body { font-family: Inter, sans-serif; color: #15171c; font-size: 9.6pt; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.cover { height: 165mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover .tile { width: 22mm; height: 22mm; border-radius: 5mm; background: #0a0b10; display: grid; place-items: center; }
.cover h1 { font-size: 30pt; line-height: 1.05; letter-spacing: -0.03em; margin: 10mm 0 4mm; }
.cover h1 span { background: linear-gradient(115deg, #12b38c, #6f50f0); -webkit-background-clip: text; color: transparent; }
.cover p { color: #4b5263; font-size: 11pt; }
section.part { page-break-before: always; }
.cover + section.part { page-break-before: auto; }
.step { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #0f9e7b; margin-bottom: 1mm; }
h1 { font-size: 19pt; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 3mm; }
/* A step's second, third… file (its messages, its how-tos) starts on a page of its own. */
section.part h1 ~ h1 { page-break-before: always; }
h2 { font-size: 13pt; letter-spacing: -0.01em; margin: 7mm 0 2mm; page-break-after: avoid; }
h3 { font-size: 11pt; margin: 5mm 0 2mm; page-break-after: avoid; }
p, ul, ol { margin: 0 0 2.5mm; }
ul, ol { padding-left: 5mm; }
li { margin: 0.8mm 0; }
li:has(> input) { list-style: none; margin-left: -5mm; }
input[type=checkbox] { width: 3mm; height: 3mm; margin: 0 1.6mm 0 0; vertical-align: -0.4mm; }
blockquote { margin: 2mm 0 3mm; padding: 2.5mm 3.5mm; border-left: 1mm solid #18e2b0; background: #f2f6f5; border-radius: 0 2mm 2mm 0; page-break-inside: avoid; }
blockquote p { margin: 0 0 1.5mm; } blockquote p:last-child { margin: 0; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 8.4pt; background: #eef0f4; padding: 0.3mm 1mm; border-radius: 1mm; }
pre { background: #eef0f4; padding: 2.5mm 3mm; border-radius: 2mm; white-space: pre-wrap; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.6pt; }
/* Long tables may run onto the next page, between rows only. */
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
th { text-align: left; font-weight: 700; border-bottom: 0.4mm solid #c9ced8; padding: 1.4mm 1.6mm; }
td { border-bottom: 0.2mm solid #e3e6ec; padding: 1.4mm 1.6mm; vertical-align: top; }
hr { border: none; border-top: 0.2mm solid #e3e6ec; margin: 4mm 0; }
a { color: #0f9e7b; text-decoration: none; }
.gallery { page-break-before: always; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
figure { margin: 0; page-break-inside: avoid; }
figure.wide { grid-column: 1 / -1; }
figure img { width: 100%; border-radius: 1.5mm; border: 0.2mm solid #d9dde4; display: block; }
figcaption { font-size: 7pt; color: #6b7280; margin-top: 1mm; word-break: break-all; }
`;

const mark = `<svg width="64" height="64" viewBox="0 0 64 64">${[[0.45, '#18e2b0'], [0.75, '#33c3c4'], [1, '#4ea4d8'], [0.8, '#6985eb'], [0.55, '#8466ff']]
  .map(([k, c], i) => `<rect x="${9 + i * 10.5}" y="${(64 - 46 * k) / 2}" width="6.5" height="${46 * k}" rx="3.25" fill="${c}"/>`).join('')}</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="cover"><div class="tile">${mark}</div><h1>Making Wavee <span>big</span></h1>
    <p>The step-by-step guide: the messages to send, what to post, and what to do every week.</p>
    <p style="margin-top:8mm;font-size:9pt">October 2026 · wavee.kaivon.app</p></div>
  ${sections.map(([step, body]) => `<section class="part">${step ? `<span class="step">${step}</span>` : ''}${body}</section>`).join('')}
</body></html>`;

// Opened from a file, so the pictures (also files) load.
const tmp = `${process.env.TMPDIR ?? '/tmp'}/wavee-guide.html`;
writeFileSync(tmp, html);
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage();
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: `${G}/Wavee growth guide.pdf`, format: 'A5', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-size:7pt;color:#9aa1ad;text-align:center;font-family:Helvetica">Wavee · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
await b.close();
console.log('made the PDF');
