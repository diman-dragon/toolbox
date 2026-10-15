import { esc, t } from '../core/i18n';
import type { ToolMeta } from '../core/types';
import { hasPremium } from '../core/premium';

/** Сетка плиток: избранное сверху (контракт 1.8). Нажатия — через data-action, долгое — data-hold. */
export function renderGrid(root: HTMLElement, tools: ToolMeta[], favIds: string[], query = ''): void {
  const q = query.trim().toLowerCase();
  const match = (m: ToolMeta) => !q || t(m.title).toLowerCase().includes(q) || t(m.hint).toLowerCase().includes(q);
  const shown = tools.filter(match);
  const favs = favIds.map((id) => shown.find((m) => m.id === id)).filter((m): m is ToolMeta => !!m);
  const rest = shown.filter((m) => !favs.includes(m));
  const locked = !hasPremium();

  const card = (m: ToolMeta) => `
    <button type="button" class="card${m.enabled ? '' : ' off'}" data-action="home.open" data-hold="home.menu" data-tool="${m.id}">
      <span class="ico">${m.icon}</span>
      <span class="name">${esc(t(m.title))}</span>
      <span class="hint">${esc(m.enabled ? t(m.hint) : t('скоро'))}</span>
      ${m.premium && locked ? '<span class="lock" aria-hidden="true">★</span>' : ''}
    </button>`;
  const block = (title: string, list: ToolMeta[]) =>
    list.length ? `${title ? `<h2 class="sec">${esc(title)}</h2>` : ''}<div class="grid">${list.map(card).join('')}</div>` : '';

  root.innerHTML = shown.length
    ? block(favs.length ? t('Избранное') : '', favs) + block(favs.length ? t('Все инструменты') : '', rest)
    : `<div class="empty"><p>${esc(t('Ничего не найдено'))}</p></div>`;

  // Обрезаем viewBox иконок по контуру — рисунок заполняет плитку
  for (const svg of root.querySelectorAll<SVGSVGElement>('.ico svg')) {
    try {
      const b = svg.getBBox();
      if (b.width > 0 && b.height > 0) {
        svg.setAttribute('viewBox', `${b.x - 2} ${b.y - 2} ${b.width + 4} ${b.height + 4}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    } catch {
      /* getBBox недоступен — исходный viewBox */
    }
  }
}
