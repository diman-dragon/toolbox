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
const SIZE = 432; // 108 dp × 4; видимая область адаптивного значка — центральные 72 dp
const GLYPH = 216;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
for (const id of ids) {
  const svg = ICONS[id].replace('stroke-width="2"', 'stroke-width="1.8"');
  await page.setContent(
    `<style>html,body{margin:0;background:${BG}}
     .g{position:absolute;left:${(SIZE - GLYPH) / 2}px;top:${(SIZE - GLYPH) / 2}px;width:${GLYPH}px;height:${GLYPH}px;color:${FG}}
     .g svg{width:100%;height:100%}</style><div class="g">${svg}</div>`,
  );
  await page.screenshot({ path: join(out, `sc_${id}.png`) });
  console.log('sc_' + id + '.png');
}
await browser.close();
