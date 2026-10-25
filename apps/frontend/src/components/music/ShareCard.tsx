import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LuCopy, LuDownload, LuShare2 } from 'react-icons/lu';
import type { Song } from '../../lib/api';
import { drawCover, FONT, H, lines, loadCover, mark, roundRect, TEAL, VIOLET, W } from '../../lib/canvas';
import { artistNames } from '../../lib/format';
import { toast } from '../../store/toast';
import { Button, Modal, Spinner } from '../ui';

export const songUrl = (song: Song) => `${window.location.origin}/songs/${song.id}`;

/** A 1080×1920 picture of the song for WhatsApp Status, Instagram and TikTok stories. */
export async function renderCard(song: Song, badge?: string): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`700 80px ${FONT}`),
    document.fonts.load(`500 40px ${FONT}`),
  ]).catch(() => undefined);
  const cover = await loadCover(song.cover_image_url);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, W, H);

  // The cover, blurred, behind everything: drawn tiny then stretched, which blurs it the same
  // way in every browser.
  if (cover) {
    const tiny = document.createElement('canvas');
    tiny.width = 18;
    tiny.height = 32;
    const t = tiny.getContext('2d')!;
    drawCover(t, cover, 0, 0, 18, 32);
    ctx.globalAlpha = 0.75;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tiny, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  const glowA = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W);
  glowA.addColorStop(0, 'rgba(24,226,176,0.30)');
  glowA.addColorStop(1, 'rgba(24,226,176,0)');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);
  const glowB = ctx.createRadialGradient(W * 0.9, H * 0.85, 0, W * 0.9, H * 0.85, W * 1.1);
  glowB.addColorStop(0, 'rgba(132,102,255,0.40)');
  glowB.addColorStop(1, 'rgba(132,102,255,0)');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(6,7,10,0.35)');
  shade.addColorStop(0.55, 'rgba(6,7,10,0.55)');
  shade.addColorStop(1, 'rgba(6,7,10,0.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // The badge (a chart position), above the cover.
  const size = 800;
  const cx = (W - size) / 2;
  const cy = 300;
  if (badge) {
    ctx.font = `600 38px ${FONT}`;
    const bw = ctx.measureText(badge).width + 72;
    const bx = (W - bw) / 2;
    const by = cy - 130;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, TEAL);
    g.addColorStop(1, VIOLET);
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, bw, 76, 38);
    ctx.fill();
    ctx.fillStyle = '#06070a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, W / 2, by + 39);
  }

  // The cover.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 40;
  roundRect(ctx, cx, cy, size, size, 52);
  ctx.fillStyle = '#16191f';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, cx, cy, size, size, 52);
  ctx.clip();
  if (cover) {
    drawCover(ctx, cover, cx, cy, size, size);
  } else {
    const g = ctx.createLinearGradient(cx, cy, cx + size, cy + size);
    g.addColorStop(0, '#0f3d36');
    g.addColorStop(1, '#2a1f5c');
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, size, size);
    mark(ctx, cx + size * 0.3, cy + size * 0.3, size * 0.4);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, cx, cy, size, size, 52);
  ctx.stroke();

  // Title and artist.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#eef1f5';
  ctx.font = `700 80px ${FONT}`;
  const titleLines = lines(ctx, song.title, W - 160, 2);
  let y = cy + size + 150;
  for (const l of titleLines) {
    ctx.fillText(l, W / 2, y);
    y += 92;
  }
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.72)';
  ctx.fillText(lines(ctx, artistNames(song), W - 200, 1)[0] ?? '', W / 2, y + 6);

  // A waveform across the bottom.
  const bars = 46;
  const bw = 10;
  const span = W - 220;
  const step = span / (bars - 1);
  const baseY = H - 330;
  for (let i = 0; i < bars; i++) {
    const k = 0.2 + 0.8 * Math.abs(Math.sin(i * 0.55 + 0.7) * Math.cos(i * 0.17));
    const h = 22 + 120 * k;
    const x = 110 + i * step - bw / 2;
    const g = ctx.createLinearGradient(110, 0, 110 + span, 0);
    g.addColorStop(0, TEAL);
    g.addColorStop(1, VIOLET);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.35 + 0.55 * k;
    roundRect(ctx, x, baseY - h / 2, bw, h, bw / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Where to hear it.
  const markSize = 64;
  ctx.font = `700 44px ${FONT}`;
  const label = 'Listen on Wavee';
  const lw = ctx.measureText(label).width;
  const rowW = markSize + 22 + lw;
  const rx = (W - rowW) / 2;
  const ry = H - 190;
  mark(ctx, rx, ry - markSize + 14, markSize);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#eef1f5';
  ctx.fillText(label, rx + markSize + 22, ry);
  ctx.textAlign = 'center';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = 'rgba(238,241,245,0.6)';
  ctx.fillText(`wavee.kaivon.app/u/${song.artist_username}`, W / 2, ry + 66);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/png'),
  );
}

interface PictureProps {
  /** Draws the picture (once each time the dialog opens). */
  make: () => Promise<Blob>;
  /** The file's name, without .png. */
  name: string;
  text: string;
  link: string;
  alt: string;
  hint?: string;
}

/** The dialog's inside, mounted fresh each time it opens: draws the picture, then offers it. */
function PictureBody({
  make,
  name,
  text,
  link,
  alt,
  hint = 'Post it on WhatsApp Status, Instagram or TikTok, and add the link so friends can tap through.',
}: PictureProps) {
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const draw = useRef(make);
  useLayoutEffect(() => {
    draw.current = make;
  });

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    draw
      .current()
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPicture({ blob, url });
      })
      .catch(() => alive && toast('We couldn’t make the picture. Please try again.', 'error'));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const fileName = `${name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'wavee'}.png`;
  const file = picture ? new File([picture.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: alt, text: `${text} ${link}` });
    } catch {
      // Share sheet closed.
    }
  };

  const download = () => {
    if (!picture) return;
    const a = document.createElement('a');
    a.href = picture.url;
    a.download = fileName;
    a.click();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. Add it to your story as a link sticker.');
    } catch {
      toast(link);
    }
  };

  return (
    <>
      <div className="mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl bg-raised ring-1 ring-line/10">
        {picture ? (
          <img src={picture.url} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center">
            <Spinner className="h-7 w-7 text-muted" />
          </div>
        )}
      </div>
      <p className="mx-auto mt-4 max-w-xs text-center text-[13px] leading-5 text-muted">{hint}</p>
      <div className="mt-5 grid gap-2">
        {canShareFile && (
          <Button variant="brand" icon={<LuShare2 />} disabled={!file} onClick={() => void share()}>
            Share
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant={canShareFile ? 'secondary' : 'primary'} icon={<LuDownload />} disabled={!picture} onClick={download}>
            Save picture
          </Button>
          <Button variant="secondary" icon={<LuCopy />} onClick={() => void copy()}>
            Copy link
          </Button>
        </div>
      </div>
    </>
  );
}

/** Makes a picture, shows it, and hands it to the phone's share sheet (WhatsApp Status,
 * Instagram, TikTok) or downloads it, with the link to go with it. */
export function PictureDialog({
  open,
  onClose,
  title = 'Share to your story',
  ...picture
}: PictureProps & { open: boolean; onClose: () => void; title?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && <PictureBody {...picture} />}
    </Modal>
  );
}

/** A song's story card. */
export function ShareCardDialog({
  song,
  badge,
  open,
  onClose,
}: {
  song: Song;
  badge?: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <PictureDialog
      open={open}
      onClose={onClose}
      make={() => renderCard(song, badge)}
      name={`${song.title}-on-wavee`}
      text={`${song.title} by ${artistNames(song)} on Wavee:`}
      link={songUrl(song)}
      alt={`Story card for ${song.title}`}
    />
  );
}
