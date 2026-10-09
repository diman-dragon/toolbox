#!/usr/bin/env node
/**
 * Значки ярлыков инструментов: native-res/res/drawable-nodpi/sc_<id>.png (432×432, адаптивные).
 * Рисуются из тех же SVG, что и на главном экране (src/ui/icons.ts), через Chromium.
 *
 * Запуск (нужен Node 22.18+ и playwright):  node scripts/make-shortcut-icons.mjs
 * Результат закоммичен — перегенерировать нужно только при смене иконок или списка инструментов.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ICONS } from '../src/ui/icons.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'native-res/res/drawable-nodpi');
mkdirSync(out, { recursive: true });

const SKIP = new Set(['gear', 'pin', 'home']);
const ids = Object.keys(ICONS).filter((k) => !SKIP.has(k));

const BG = '#0a0a0a';
const FG = '#e0a64f';
const SIZE = 432; // 108 dp × 4; видимая область адаптивного значка — центральные 72 dp (288 px)
const FIT = 284; // рисунок занимает почти всю видимую область, без пустых полей

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
for (const id of ids) {
  const svg = ICONS[id].replace('stroke-width="2"', 'stroke-width="2.2"');
  await page.setContent(
    `<style>html,body{margin:0;background:${BG}}
     #g{position:absolute;left:0;top:0;width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center;color:${FG}}
     #g svg{display:block}</style><div id="g">${svg}</div>`,
  );
  // Обрезаем viewBox по контуру рисунка и масштабируем его на всю область
  await page.evaluate((fit) => {
    const el = document.querySelector('#g svg');
    const b = el.getBBox();
    const pad = 1.2;
    const w = b.width + pad * 2;
    const h = b.height + pad * 2;
    el.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${w} ${h}`);
    const k = fit / Math.max(w, h);
    el.setAttribute('width', String(w * k));
    el.setAttribute('height', String(h * k));
  }, FIT);
  await page.screenshot({ path: join(out, `sc_${id}.png`) });
  console.log('sc_' + id + '.png');
}
await browser.close();
