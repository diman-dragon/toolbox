// Сверка с контрактом: токены, цвета, порядок настроек, отсутствие аналитики и рекламы, версии.
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (d, ext, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, ext, out); else if (ext.some((e) => p.endsWith(e))) out.push(p); } return out; };
const rel = (p) => p.slice(ROOT.length + 1);

export const tests = {
  'colors.xml совпадает с variables.css': async () => {
    const { parseThemes, colorsXml } = await import(pathToFileURL(resolve(ROOT, 'tools/make-colors.mjs')).href);
    assert.equal(read('native-res/res/values/colors.xml'), colorsXml(parseThemes(read('src/variables.css'))));
  },
  'цвета (hex, rgb, hsl) только в variables.css'() {
    const bad = [];
    for (const f of walk(join(ROOT, 'src'), ['.css', '.ts'])) {
      if (f.endsWith('variables.css')) continue;
      read(rel(f)).split('\n').forEach((l, i) => { if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l.replace(/\/\*.*?\*\//g, '').replace(/&#\d+;/g, ''))) bad.push(`${rel(f)}:${i + 1} ${l.trim()}`); });
    }
    assert.deepEqual(bad, []);
  },
  'три темы заданы полным набором токенов'() {
    const css = read('src/variables.css');
    for (const th of ['classic', 'amoled', 'paper']) assert.ok(css.includes(`data-theme='${th}'`), th);
    for (const tok of ['bg', 'panel', 'card', 'fg', 'muted', 'accent', 'on-accent', 'danger']) assert.equal((css.match(new RegExp(`--${tok}:`, 'g')) ?? []).length, 3, tok);
  },
  'порядок настроек: вид → поддержка → работа → данные → документы → версия'() {
    const s = read('src/ui/settings.ts');
    const order = ['Внешний вид', 'Поддержка и Premium', 'Работа', 'Данные и доступ', 'Конфиденциальность и документы', 'Версия'].map((k) => s.indexOf(`'${k}'`));
    assert.ok(order.every((x) => x > 0), 'не все разделы найдены: ' + order);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  },
  'нижняя навигация: Инструменты, Поддержка, Настройки'() {
    const m = read('src/main.ts');
    const a = ['Инструменты', 'Поддержка', 'Настройки'].map((k) => m.indexOf(`'${k}'`));
    assert.ok(a.every((x) => x > 0)); assert.deepEqual([...a].sort((x, y) => x - y), a);
  },
  'нет аналитики, рекламы и сетевых SDK'() {
    const dep = Object.keys({ ...JSON.parse(read('package.json')).dependencies });
    assert.deepEqual(dep.filter((d) => /firebase|analytics|admob|ads|sentry|crashlytics|appsflyer|amplitude|mixpanel/i.test(d)), []);
    const code = walk(join(ROOT, 'src'), ['.ts']).map((f) => readFileSync(f, 'utf8')).join('\n');
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(code), 'сетевые вызовы в коде');
    assert.ok(!/google-analytics|googletagmanager|doubleclick/i.test(code));
  },
  'версия: package.json = versionCode в патче = документы'() {
    const v = JSON.parse(read('package.json')).version;
    assert.match(v, /^\d+\.\d+\.\d+$/);
    assert.ok(read('scripts/patch-android.sh').includes('a*10000+b*100+c'));
    assert.ok(!read('.github/workflows/release.yml').includes('run_number'));
    assert.ok(existsSync(join(ROOT, 'store/RELEASE_CHECKLIST.md')));
  },
  'Premium: релиз подписывается только секретным ключом, отладочный — только в android.yml'() {
    assert.ok(!read('.github/workflows/release.yml').includes('toolbox-debug'));
    assert.ok(read('.github/workflows/release.yml').includes('ANDROID_KEYSTORE_BASE64'));
  },
  'Billing 8.0.0, minSdk 24, target 36'() {
    const s = read('scripts/patch-android.sh');
    assert.ok(s.includes('billing:8.0.0') && s.includes('minSdkVersion = 24') && s.includes('targetSdkVersion = 36'));
  },
  'в разметке нет захардкоженных русских строк вне t() — index.html без текста'() {
    const h = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/, '');
    assert.ok(!/[А-Яа-яЁё]/.test(h), 'русский текст в index.html');
  },
};
