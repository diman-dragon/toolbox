// Запуск: node tests/run.mjs [фильтр]   (или cd tests && node run.mjs)
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? '';
let failed = 0, passed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs') && x.includes(filter)).sort()) {
  const { tests } = await import(pathToFileURL(resolve(dir, f)).href);
  console.log(`\n▸ ${f.replace('.test.mjs', '')}`);
  for (const [name, fn] of Object.entries(tests)) {
    try { await fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').join('\n      ')}`); }
  }
}
console.log(`\n${failed ? 'ПРОВАЛ' : 'OK'}: ${passed} пройдено, ${failed} не пройдено`);
process.exit(failed ? 1 : 0);
