import type { ToolMeta } from '../core/types';

export function renderGrid(
  root: HTMLElement,
  tools: ToolMeta[],
  onOpen: (tool: ToolMeta) => void,
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
    card.addEventListener('click', () => onOpen(tool));
    grid.append(card);
  }

  root.append(grid);
}
