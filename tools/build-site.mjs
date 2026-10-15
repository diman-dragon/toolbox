// Сборка статического сайта (политика, условия, лицензии, описание) из store/*.md и store/site.json.
// Без зависимостей: node tools/build-site.mjs [--strict] [--out site]
// --strict: падает, если в документах остались заглушки {…} или не заполнены обязательные поля site.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.argv.includes('--strict');
const out = resolve(process.argv[process.argv.indexOf('--out') + 1] || 'site');
const site = JSON.parse(readFileSync('store/site.json', 'utf8'));
const pages = [
  ['privacy', 'Политика конфиденциальности', 'PRIVACY_POLICY.md'],
  ['terms', 'Условия использования', 'TERMS.md'],
  ['licenses', 'Лицензии компонентов', 'LICENSES.md'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');

function md(src) {
  const lines = src.split('\n');
  let html = '', list = false, para = [];
  const flush = () => { if (para.length) html += `<p>${inline(para.join(' '))}</p>\n`; para = []; };
  const closeList = () => { if (list) { html += '</ul>\n'; list = false; } };
  for (const l of lines) {
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    const li = /^\s*[-*]\s+(.*)$/.exec(l);
    if (h) { flush(); closeList(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>\n`; }
    else if (li) { flush(); if (!list) { html += '<ul>\n'; list = true; } html += `<li>${inline(li[1])}</li>\n`; }
    else if (!l.trim()) { flush(); closeList(); }
    else para.push(l.trim());
  }
  flush(); closeList();
  return html;
}

const problems = [];
if (strict) for (const k of ['email', 'date']) if (!site[k]) problems.push(`site.json: не задано «${k}»`);

const css = `:root{color-scheme:dark light;--bg:#1a130c;--fg:#f2eadb;--accent:#e8b66d}
@media(prefers-color-scheme:light){:root{--bg:#e9dcc2;--fg:#2c2015;--accent:#9a5f1e}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}a{color:var(--accent)}
nav a{margin-right:16px}code{font-family:ui-monospace,monospace}`;
const nav = pages.map(([id, title]) => `<a href="${id}.html">${title}</a>`).join('');
const shell = (title, body) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · DataLaw Design</title><style>${css}</style></head>
<body><main><nav><a href="index.html">Мультитул</a>${nav}</nav>${body}</main></body></html>\n`;

mkdirSync(out, { recursive: true });
for (const [id, title, file] of pages) {
  let src = readFileSync(`store/${file}`, 'utf8');
  const stubs = src.match(/\{[A-Za-zА-Яа-я_ ]+\}/g);
  if (stubs && strict) problems.push(`${file}: заглушки ${[...new Set(stubs)].join(', ')}`);
  src = src.replaceAll('{email}', site.email).replaceAll('{date}', site.date);
  writeFileSync(`${out}/${id}.html`, shell(title, md(src)));
}
const listing = md(readFileSync('store/LISTING_RU.md', 'utf8'));
const play = site.play ? `<p><a href="${esc(site.play)}">Google Play</a></p>` : '';
writeFileSync(`${out}/index.html`, shell('Мультитул', `${listing}${play}<p>Связь: <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>`));

if (problems.length) {
  console.error(problems.join('\n'));
  if (strict) process.exit(1);
}
console.log(`Сайт собран: ${out} (${pages.length + 1} стр.)`);
