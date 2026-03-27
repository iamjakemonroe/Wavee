import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svgPath = join(publicDir, "wavee-mark.svg");
const svg = readFileSync(svgPath);

await sharp(svg).resize(192, 192).png().toFile(join(publicDir, "icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(join(publicDir, "icon-512.png"));
console.log("Wrote public/icon-192.png and public/icon-512.png from wavee-mark.svg");
