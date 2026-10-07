import './styles.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TOOLS } from './core/registry';
import { loadSettings } from './core/settings';
import type { Tool, ToolMeta } from './core/types';
import { renderGrid } from './ui/grid';
import { ICONS } from './ui/icons';
import { renderSettings } from './ui/settings';
import { toast } from './ui/toast';

const app = document.getElementById('app') as HTMLElement;

let running: Tool | null = null;
let view: 'home' | 'tool' | 'settings' = 'home';
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
  running?.unmount();
  running = null;
}

/** Шапка: заголовок, при back — кнопка «назад», при gear — шестерёнка настроек. */
function makeBar(title: string, opts: { back?: boolean; gear?: boolean }): HTMLElement {
  const bar = h('header', 'bar');
  if (opts.back) {
    const back = h('button', 'back');
    back.type = 'button';
    back.setAttribute('aria-label', 'Назад');
    back.textContent = '‹';
    back.addEventListener('click', showHome);
    bar.append(back);
  }
  const t = h('h1', '');
  t.textContent = title;
  bar.append(t);
  if (opts.gear) {
    const gear = h('button', 'gear');
    gear.type = 'button';
    gear.setAttribute('aria-label', 'Настройки');
    gear.innerHTML = ICONS.gear;
    gear.addEventListener('click', showSettings);
    bar.append(gear);
  }
  return bar;
}

function showHome(): void {
  token++;
  stopCurrent();
  view = 'home';
  app.replaceChildren();
  const home = h('main', 'home');
  app.append(makeBar('Toolbox', { gear: true }), home);
  renderGrid(home, TOOLS, (meta) => void openTool(meta));
}

function showSettings(): void {
  token++;
  stopCurrent();
  view = 'settings';
  app.replaceChildren();
  const body = h('main', 'tool-body');
  app.append(makeBar('Настройки', { back: true }), body);
  renderSettings(body);
}

async function openTool(meta: ToolMeta): Promise<void> {
  if (!meta.enabled || !meta.load) {
    toast(`«${meta.title}» — скоро`);
    return;
  }

  const my = ++token;
  stopCurrent();
  view = 'tool';
  app.replaceChildren();
  const body = h('main', 'tool-body');
  app.append(makeBar(meta.title, { back: true }), body);

  try {
    const mod = await meta.load();
    const tool = await mod.default(body);
    if (my !== token) {
      tool.unmount();
      return;
    }
    running = tool;
  } catch (err) {
    console.error(err);
    body.textContent = 'Не удалось загрузить инструмент';
  }
}

if (Capacitor.isNativePlatform()) {
  void App.addListener('backButton', () => {
    if (view !== 'home') showHome();
    else void App.exitApp();
  });
}

void loadSettings().then(showHome);
