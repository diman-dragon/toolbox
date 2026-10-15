// Каждый русский текст — один ключ перевода (контракт 1.1). Проверяем: у каждого t('…')/T('…') есть английский
// перевод, в словаре нет лишнего, а русских строк вне t()/T() в коде нет (кроме помеченных // i18n-ok).
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { load, ROOT } from './helpers.mjs';

const CYR = /[А-Яа-яЁё]/;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts') && !p.endsWith('i18n-en.ts')) files.push(p);
  }
})(join(ROOT, 'src'));

/** Ключи из t('…'), T('…') и t(`…`) без подстановок ${}. */
function keysOf(src) {
  const out = [];
  const re = /(?<![A-Za-z0-9_.])[tT]\(\s*('(?:[^'\\]|\\.)*'|`[^`$]*`)/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1];
    out.push(raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n'));
  }
  return out;
}

/** Код без комментариев и без литералов внутри t()/T(). */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/(?<![A-Za-z0-9_.])[tT]\(\s*('(?:[^'\\]|\\.)*'|`[^`$]*`)/g, 't(');
}

const { EN } = await load('src/i18n-en.ts');

export const tests = {
  'у каждого t()/T() есть английский перевод'() {
    const missing = new Set();
    for (const f of files) for (const k of keysOf(readFileSync(f, 'utf8'))) if (CYR.test(k) && !(k in EN)) missing.add(k);
    assert.equal(missing.size, 0, `нет перевода (${missing.size}):\n  ` + [...missing].join('\n  '));
  },
  'в словаре нет лишних ключей'() {
    const used = new Set();
    for (const f of files) for (const k of keysOf(readFileSync(f, 'utf8'))) used.add(k);
    const extra = Object.keys(EN).filter((k) => !used.has(k));
    assert.equal(extra.length, 0, `лишние (${extra.length}):\n  ` + extra.join('\n  '));
  },
  'нет русских строк вне t()/T()'() {
    const bad = [];
    for (const f of files) {
      const raw = readFileSync(f, 'utf8').split('\n');
      strip(readFileSync(f, 'utf8')).split('\n').forEach((line, i) => {
        if (CYR.test(line) && !raw[i].includes('i18n-ok')) bad.push(`${f.replace(ROOT + '/', '')}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    assert.equal(bad.length, 0, `русский текст в коде (${bad.length}):\n  ` + bad.join('\n  '));
  },
  'подстановки {0} совпадают в русском и английском'() {
    for (const [ru, en] of Object.entries(EN)) {
      const a = (ru.match(/\{\d\}/g) ?? []).sort().join();
      const b = (en.match(/\{\d\}/g) ?? []).sort().join();
      assert.equal(a, b, `подстановки: «${ru}»`);
    }
  },
  'английский текст не содержит кириллицы'() {
    for (const [ru, en] of Object.entries(EN)) assert.ok(!CYR.test(en), `кириллица в переводе «${ru}»`);
  },
};
