import type { ToolMeta } from '../core/types';

const HOLD_MS = 450;

export function renderGrid(
  root: HTMLElement,
  tools: ToolMeta[],
  onOpen: (tool: ToolMeta) => void,
  onHold: (tool: ToolMeta) => void,
): void {
  const grid = document.createElement('div');
  grid.className = 'grid';

  for (const tool of tools) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = tool.enabled ? 'card' : 'card off';
    card.innerHTML = `
      <span class="ico">${tool.icon}</span>
      <span class="name">${tool.title}</span>
      <span class="hint">${tool.enabled ? tool.hint : 'скоро'}</span>
    `;

    // долгое нажатие — меню (ярлык на рабочий стол); обычное — открыть
    let timer = 0;
    let fired = false;
    const cancel = () => window.clearTimeout(timer);
    card.addEventListener('pointerdown', () => {
      fired = false;
      cancel();
      if (!tool.enabled) return;
      timer = window.setTimeout(() => {
        fired = true;
        onHold(tool);
      }, HOLD_MS);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'] as const)
      card.addEventListener(ev, cancel);
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    card.addEventListener('click', () => {
      if (fired) {
        fired = false;
        return;
      }
      onOpen(tool);
    });
    grid.append(card);
  }

  root.append(grid);
}
