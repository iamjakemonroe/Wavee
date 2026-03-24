const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const payload = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([len, t, data, crc]);
}

function createIcon(size, bgR, bgG, bgB, fgR, fgG, fgB) {
  const raw = Buffer.alloc((1 + size * 4) * size);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = size * 0.15;

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < innerR || (dist > innerR + size * 0.04 && dist < outerR)) {
        raw[px] = fgR;
        raw[px + 1] = fgG;
        raw[px + 2] = fgB;
        raw[px + 3] = 255;
      } else if (dist <= innerR + size * 0.04) {
        raw[px] = bgR;
        raw[px + 1] = bgG;
        raw[px + 2] = bgB;
        raw[px + 3] = 255;
      } else if (dist < outerR + size * 0.03) {
        const edge = 1 - (dist - outerR) / (size * 0.03);
        const a = Math.round(edge * 255);
        raw[px] = fgR;
        raw[px + 1] = fgG;
        raw[px + 2] = fgB;
        raw[px + 3] = a;
      } else {
        raw[px] = bgR;
        raw[px + 1] = bgG;
        raw[px + 2] = bgB;
        raw[px + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public");

// Dark bg (#0B0B0F) with primary accent (#00D1A0) disc icon
fs.writeFileSync(path.join(outDir, "icon-192.png"), createIcon(192, 11, 11, 15, 0, 209, 160));
fs.writeFileSync(path.join(outDir, "icon-512.png"), createIcon(512, 11, 11, 15, 0, 209, 160));

console.log("Generated icon-192.png and icon-512.png");
