import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lu from 'react-icons/lu';
import { writeFileSync } from 'node:fs';
const names = ['LuGem', 'LuSparkles', 'LuMessageSquareHeart', 'LuRadar', 'LuUpload', 'LuEar', 'LuCompass', 'LuHeadphones', 'LuMicVocal', 'LuArrowRight', 'LuFlame', 'LuLink', 'LuTrophy', 'LuPlay', 'LuHeart', 'LuChevronsRight', 'LuScanLine', 'LuChartColumn'];
const out = {};
for (const n of names) out[n] = renderToStaticMarkup(createElement(lu[n], { size: '1em' }));
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.keys(out).length, 'icons');
