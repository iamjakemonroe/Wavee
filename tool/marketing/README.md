# Marketing pictures, videos and the growth guide PDF

These made everything in `~/Desktop/Wavee Growth` (October 2026). Each picture or video is a
small HTML page in Wavee's brand, rendered by Chrome through Playwright; videos are filmed
frame by frame and encoded with ffmpeg.

Set up once, in a scratch folder: `npm i playwright@1.55.1 qrcode@1.5.4 marked@15.0.12`, and
have an ffmpeg with libx264 (for example `pip install imageio-ffmpeg`).

1. Icons (run from `apps/frontend`, which has react-icons): `node ../../tool/marketing/icons.mjs icons.json`
2. Pictures: `node images.mjs icons.json out/ [name prefix]`
3. Videos: `node videos.mjs icons.json /path/to/ffmpeg out/ [name]`
4. The guide PDF: `node guide-pdf.mjs "~/Desktop/Wavee Growth" <folder with the video stills>`

The Inter font path at the top of each script points at this repo's `node_modules`; change it if
the version moves.
