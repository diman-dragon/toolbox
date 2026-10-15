#!/usr/bin/env node
// Дублирует токены тем из src/variables.css в Android-ресурсы (контракт 1.2): node tools/make-colors.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'src/variables.css'), 'utf8');
const THEMES = { classic: ":root,\n:root[data-theme='classic']", amoled: ":root[data-theme='amoled']", paper: ":root[data-theme='paper']" };
const TOKENS = ['bg', 'panel', 'card', 'fg', 'muted', 'accent', 'on-accent', 'danger'];

export function parseThemes(src) {
  const out = {};
  for (const [name, sel] of Object.entries(THEMES)) {
    const start = src.indexOf(sel + ' {');
    const body = src.slice(start, src.indexOf('}', start));
    out[name] = Object.fromEntries(TOKENS.map((t) => [t, new RegExp(`--${t}:\\s*(#[0-9a-fA-F]{6})`).exec(body)?.[1].toLowerCase()]));
  }
  return out;
}

export function colorsXml(themes) {
  let x = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Создано tools/make-colors.mjs из src/variables.css. Не править вручную. -->\n<resources>\n';
  for (const [name, t] of Object.entries(themes)) for (const k of TOKENS) x += `    <color name="${name}_${k.replace('-', '_')}">${t[k]}</color>\n`;
  return x + '</resources>\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = resolve(root, 'native-res/res/values/colors.xml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, colorsXml(parseThemes(css)));
  console.log('записано', out);
}
