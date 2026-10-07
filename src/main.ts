import './styles.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TOOLS } from './core/registry';
import type { Tool, ToolMeta } from './core/types';
import { renderGrid } from './ui/grid';
import { toast } from './ui/toast';

const app = document.getElementById('app') as HTMLElement;

interface Running {
  tool: Tool | null;
}

let running: Running | null = null;
let token = 0;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function stopCurrent(): void {
  running?.tool?.unmount();
  running = null;
}

function showHome(): void {
  token++;
  stopCurrent();
  app.replaceChildren();

  const bar = h('header', 'bar');
  bar.innerHTML = '<h1>Toolbox</h1>';
  const home = h('main', 'home');
  app.append(bar, home);
  renderGrid(home, TOOLS, (meta) => void openTool(meta));
}

async function openTool(meta: ToolMeta): Promise<void> {
  if (!meta.enabled || !meta.load) {
    toast(`«${meta.title}» — скоро`);
    return;
  }

  const my = ++token;
  stopCurrent();
  app.replaceChildren();

  const bar = h('header', 'bar');
  const back = h('button', 'back');
  back.type = 'button';
  back.setAttribute('aria-label', 'Назад');
  back.textContent = '‹';
  back.addEventListener('click', showHome);
  const title = h('h1', '');
  title.textContent = meta.title;
  bar.append(back, title);

  const body = h('main', 'tool-body');
  app.append(bar, body);

  const current: Running = { tool: null };
  running = current;

  try {
    const mod = await meta.load();
    const tool = await mod.default(body);
    if (my !== token) {
      tool.unmount();
      return;
    }
    current.tool = tool;
  } catch (err) {
    console.error(err);
    body.textContent = 'Не удалось загрузить инструмент';
  }
}

if (Capacitor.isNativePlatform()) {
  void App.addListener('backButton', () => {
    if (running) showHome();
    else void App.exitApp();
  });
}

showHome();
