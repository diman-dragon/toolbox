import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Компилирует TS-модуль в ESM и импортирует. @capacitor/* заменяются заглушками из tests/stubs. */
export async function load(rel) {
  const out = resolve(ROOT, 'tests/.build', rel.replace(/[\\/]/g, '_') + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await build({
    entryPoints: [resolve(ROOT, rel)], outfile: out, bundle: true, format: 'esm', platform: 'neutral', logLevel: 'error',
    alias: Object.fromEntries(['core', 'preferences', 'haptics', 'motion', 'app'].map((n) => [`@capacitor/${n}`, resolve(ROOT, `tests/stubs/${n}.mjs`)])),
    define: { __APP_VERSION__: '"test"' }, loader: { '.css': 'empty' },
  });
  return import(pathToFileURL(out).href + '?t=' + Date.now());
}
