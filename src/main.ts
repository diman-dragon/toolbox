import './styles.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { TOOLS, toolById } from './core/registry';
import { loadSettings } from './core/settings';
import { getLaunchTool, onToolIntent, pinTool, syncRecent, touchRecent } from './core/shortcuts';
import type { Tool, ToolMeta } from './core/types';
import { renderGrid } from './ui/grid';
import { BRAND_NAME, brandMark } from './ui/brand';
import { ICONS } from './ui/icons';
import { renderSettings } from './ui/settings';
import { showSheet } from './ui/sheet';
import { toast } from './ui/toast';

const app = document.getElementById('app') as HTMLElement;

let running: Tool | null = null;
let view: 'home' | 'tool' | 'settings' = 'home';
let token = 0;
/** Приложение открыто ярлыком: «назад» закрывает приложение, а не ведёт на главный экран. */
let fromShortcut = false;

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

function actionButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', 'act');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.innerHTML = icon;
  b.addEventListener('click', onClick);
  return b;
}

interface BarOpts {
  back?: boolean;
  gear?: boolean;
  pin?: ToolMeta;
  home?: boolean;
  brand?: boolean;
}

function makeBar(title: string, opts: BarOpts): HTMLElement {
  const bar = h('header', 'bar');
  if (opts.back) {
    const back = h('button', 'back');
    back.type = 'button';
    back.setAttribute('aria-label', fromShortcut && view === 'tool' ? 'Закрыть' : 'Назад');
    back.textContent = fromShortcut && view === 'tool' ? '×' : '‹';
    back.addEventListener('click', goBack);
    bar.append(back);
  }
  const t = h('h1', '');
  if (opts.brand) {
    t.innerHTML = `<span class="brand-mark">${brandMark()}</span>`;
    t.append(title);
  } else {
    t.textContent = title;
  }
  bar.append(t, h('span', 'grow'));
  const meta = opts.pin;
  if (meta) bar.append(actionButton(ICONS.pin, 'Ярлык на рабочий стол', () => void pin(meta)));
  if (opts.home)
    bar.append(
      actionButton(ICONS.home, 'Все инструменты', () => {
        fromShortcut = false;
        showHome();
      }),
    );
  if (opts.gear) bar.append(actionButton(ICONS.gear, 'Настройки', showSettings));
  return bar;
}

function goBack(): void {
  if (view === 'home' || (fromShortcut && view === 'tool')) {
    void App.exitApp().catch(() => undefined);
  } else {
    showHome();
  }
}

async function pin(meta: ToolMeta): Promise<void> {
  const r = await pinTool({ id: meta.id, title: meta.title });
  if (r === 'requested') toast('Подтвердите добавление ярлыка на рабочий стол');
  else if (r === 'unsupported') toast('Ваш лаунчер не поддерживает закрепление ярлыков');
  else if (r === 'web') toast('Ярлыки работают только в приложении Android');
  else toast('Не удалось создать ярлык');
}

function offerPin(meta: ToolMeta): void {
  showSheet(meta.title, [
    { label: 'Открыть', primary: true, run: () => void openTool(meta) },
    { label: 'Ярлык на рабочий стол', run: () => void pin(meta) },
  ]);
}

function showHome(): void {
  token++;
  stopCurrent();
  view = 'home';
  app.replaceChildren();
  const home = h('main', 'home');
  app.append(makeBar('Toolbox', { gear: true, brand: true }), home);
  renderGrid(home, TOOLS, (meta) => void openTool(meta), offerPin);
  const note = h('div', 'note home-note');
  note.textContent = 'Долгое нажатие на инструмент — ярлык на рабочий стол';
  const by = h('div', 'brandline');
  by.innerHTML = `${brandMark()}<span>${BRAND_NAME}</span>`;
  home.append(note, by);
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
  app.append(makeBar(meta.title, { back: true, pin: meta, home: fromShortcut }), body);
  void touchRecent(meta.id, (id) => toolById(id)?.title ?? null);

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
  void App.addListener('backButton', goBack);
}

// ярлык нажат, когда приложение уже запущено
onToolIntent((id) => {
  const meta = toolById(id);
  if (!meta) return;
  fromShortcut = true;
  void openTool(meta);
});

void (async () => {
  await loadSettings();
  void syncRecent(null, (id) => toolById(id)?.title ?? null);
  const id = await getLaunchTool();
  const meta = id ? toolById(id) : undefined;
  if (meta) {
    fromShortcut = true;
    await openTool(meta);
  } else {
    showHome();
  }
})();
