#!/usr/bin/env node
/**
 * Фирменная графика DataLaw International из одной геометрии (src/ui/brand.ts):
 *   public/logo.svg, public/icon.svg                     — знак и favicon
 *   native-res/res/drawable/ic_toolbox_*.xml             — адаптивная иконка Android (+ monochrome для Android 13)
 *   native-res/res/mipmap-*dpi/ic_launcher*.png          — запасные PNG для старых версий
 *   assets/icon-preview.png, store/icon-512.png          — значок 512×512 для Google Play
 *   store/feature-graphic-1024x500.png                   — баннер для Google Play
 *
 * Запуск (Node 22.18+, нужен playwright):  node scripts/make-icon.mjs
 * Результат закоммичен — перегенерировать нужно только при смене знака.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BRAND_NAME, BRAND_PATHS, BRAND_VIEWBOX } from '../src/ui/brand.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const put = (rel, data) => {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, data);
};

const BG = '#0a0a0a';
const BRASS = '#e0a64f';
const PAPER = '#ece6dc';
const [vx, vy, vw, vh] = BRAND_VIEWBOX.split(' ').map(Number);
const D = BRAND_PATHS.join(' ');
const mark = (fill, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_VIEWBOX}" fill="${fill}" ${extra}>${BRAND_PATHS.map((p) => `<path d="${p}"/>`).join('')}</svg>`;

// ---- SVG
put('public/logo.svg', mark(BG) + '\n');
put(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" rx="24" fill="${BG}"/>` +
    `<svg x="26" y="22" width="56" height="64" viewBox="${BRAND_VIEWBOX}" fill="${BRASS}">${BRAND_PATHS.map((p) => `<path d="${p}"/>`).join('')}</svg></svg>\n`,
);

// ---- Android: адаптивная иконка 108×108, знак высотой 50 внутри безопасной зоны (круг 72)
const H = 50;
const s = H / vh;
const tx = 54 - s * (vx + vw / 2);
const ty = 54 - s * (vy + vh / 2);
const head =
  '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n' +
  '    android:width="108dp"\n    android:height="108dp"\n    android:viewportWidth="108"\n    android:viewportHeight="108">\n';
const layer = (color) =>
  head +
  `    <group android:scaleX="${s.toFixed(5)}" android:scaleY="${s.toFixed(5)}" android:translateX="${tx.toFixed(3)}" android:translateY="${ty.toFixed(3)}">\n` +
  BRAND_PATHS.map((p) => `        <path android:fillColor="${color}" android:pathData="${p}"/>\n`).join('') +
  '    </group>\n</vector>\n';
put('native-res/res/drawable/ic_toolbox_foreground.xml', layer(BRASS));
put('native-res/res/drawable/ic_toolbox_monochrome.xml', layer('#000000'));
put(
  'native-res/res/drawable/ic_toolbox_background.xml',
  head + `    <path android:fillColor="${BG}" android:pathData="M0,0h108v108h-108z"/>\n</vector>\n`,
);

// ---- PNG
const browser = await chromium.launch();
async function png(html, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}*{box-sizing:border-box}</style>${html}`);
  const buf = await page.screenshot({ omitBackground: true });
  await page.close();
  put(out, buf);
}
const plate = (size, round, markH) =>
  `<div style="width:${size}px;height:${size}px;background:${BG};border-radius:${round ? '50%' : '22%'};display:flex;align-items:center;justify-content:center">` +
  `<div style="height:${size * markH}px;aspect-ratio:${vw}/${vh}">${mark(BRASS, 'width="100%" height="100%"')}</div></div>`;
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, px] of Object.entries(dens)) {
  await png(plate(px, false, 0.6), px, px, `native-res/res/mipmap-${d}/ic_launcher.png`);
  await png(plate(px, true, 0.54), px, px, `native-res/res/mipmap-${d}/ic_launcher_round.png`);
}
// Google Play: квадрат 512×512 без скруглений
const sq =
  `<div style="width:512px;height:512px;background:${BG};display:flex;align-items:center;justify-content:center">` +
  `<div style="height:318px;aspect-ratio:${vw}/${vh}">${mark(BRASS, 'width="100%" height="100%"')}</div></div>`;
await png(sq, 512, 512, 'assets/icon-preview.png');
await png(sq, 512, 512, 'store/icon-512.png');

// Баннер 1024×500
const fg =
  `<div style="width:1024px;height:500px;background:${BG};display:flex;align-items:center;font-family:'Liberation Sans',Arial,sans-serif;color:${PAPER}">` +
  `<div style="margin-left:110px;height:300px;aspect-ratio:${vw}/${vh}">${mark(BRASS, 'width="100%" height="100%"')}</div>` +
  `<div style="margin-left:70px"><div style="font-size:92px;font-weight:700;letter-spacing:1px">Toolbox</div>` +
  `<div style="margin-top:14px;font-size:32px;color:${BRASS}">Уровень · дальномер · шумомер</div>` +
  `<div style="margin-top:34px;font-size:24px;letter-spacing:3px;color:#9a948a;text-transform:uppercase">${BRAND_NAME}</div></div></div>`;
await png(fg, 1024, 500, 'store/feature-graphic-1024x500.png');
await browser.close();
console.log('Готово');
