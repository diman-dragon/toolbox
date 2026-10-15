import { esc } from '../core/i18n';
import { showSheet } from './sheet';

/** Минимальный показ Markdown: заголовки, списки, абзацы, **жирный**, `код`. Всё остальное — текст. */
export function mdToHtml(md: string): string {
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = [];
  let list = false;
  const close = () => {
    if (list) out.push('</ul>');
    list = false;
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^\s*[-•]\s+(.*)$/.exec(line);
    if (h) {
      close();
      out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
    } else if (li) {
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line.trim() === '') {
      close();
    } else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join('');
}

export function openDoc(title: string, md: string): void {
  showSheet({ title, html: `<div class="doc">${mdToHtml(md)}</div>`, cancel: true });
}
