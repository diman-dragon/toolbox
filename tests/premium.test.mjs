import { strict as assert } from 'node:assert';
import { load, ROOT } from './helpers.mjs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const P = await load('src/core/premium.ts');
const M = await import(pathToFileURL(resolve(ROOT, 'tools/make-codes.mjs')).href);
const DAY = 86400000;
const st = (o) => ({ firstRun: 0, purchased: false, code: null, ...o });

export const tests = {
  'секрет и алфавит в приложении и в генераторе совпадают'() { assert.equal(P.CODE_SECRET, M.CODE_SECRET); },
  async 'код из tools/make-codes.mjs принимается приложением'() { for (let i = 0; i < 20; i++) assert.ok(await P.checkCode(M.makeCode(randomBytes(5)))); },
  async 'код приложения = код генератора'() { const id = randomBytes(5); assert.equal(await P.makeCode(id), M.makeCode(id)); },
  async 'испорченный код отвергается'() { const c = M.makeCode(randomBytes(5)); const bad = c.slice(0, -1) + (c.endsWith('A') ? 'B' : 'A'); assert.equal(await P.checkCode(bad), false); },
  async 'регистр и разделители не важны'() { const c = M.makeCode(randomBytes(5)); assert.ok(await P.checkCode(c.toLowerCase().replaceAll('-', ' '))); },
  async 'мусор и пустая строка отвергаются'() { for (const s of ['', 'abc', 'DLD-0000-0000-0000-0000']) assert.equal(await P.checkCode(s), false); },
  'пробный период 30 дней'() {
    const s = st({ firstRun: 0 });
    assert.equal(P.TRIAL_DAYS, 30);
    assert.ok(P.hasPremium(10 * DAY, s)); assert.ok(P.inTrial(10 * DAY, s));
    assert.equal(P.hasPremium(31 * DAY, s), false);
  },
  'покупка и код дают Premium навсегда'() {
    assert.ok(P.hasPremium(999 * DAY, st({ purchased: true })));
    assert.ok(P.hasPremium(999 * DAY, st({ code: 'X' })));
    assert.equal(P.inTrial(1, st({ purchased: true })), false);
  },
};
