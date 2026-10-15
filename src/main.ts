import './variables.css';
import './styles.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { initActions, scope } from './core/actions';
import { loadFavorites, favorites, isFavorite, toggleFavorite } from './core/favorites';
import { syncPurchases } from './core/billing';
import { esc, t } from './core/i18n';
import { hasPremium, loadPremium } from './core/premium';
import { TOOLS, toolById } from './core/registry';
import { effectiveLang, loadSettings, onSettings } from './core/settings';
import { getLaunchTool, onToolIntent, pinTool, syncRecent, touchRecent } from './core/shortcuts';
import { initTouch } from './core/touch';
import type { Tool, ToolMeta } from './core/types';
import { BRAND_NAME, brandMark } from './ui/brand';
import { renderGrid } from './ui/grid';
import { ICONS } from './ui/icons';
import { renderSettings } from './ui/settings';
import { closeTopSheet, menuSheet } from './ui/sheet';
import { premiumSheet, renderSupport } from './ui/support';
import { toast } from './ui/toast';

/**
 * Каркас экрана (контракт 1.3): шапка (название слева, справа не более трёх значков, высота постоянна),
 * контент (одна прокручиваемая область), нижняя навигация из трёх разделов (активный — золотом;
 * внутри раздела не меняется), окна (sheets) поверх.
 */
type Section = 'tools' | 'support' | 'settings';

const app = document.getElementById('app') as HTMLElement;
let running: Tool | null = null;
let stopScreen: (() => void) | null = null;
let section: Section = 'tools';
let tool: ToolMeta | null = null;
let token = 0;
let query = '';
let searching = false;
/** Приложение открыто ярлыком: «назад» закрывает приложение, а не ведёт на главный экран. */
let fromShortcut = false;

const NAV: Array<{ id: Section; icon: string }> = [
  { id: 'tools', icon: ICONS.tools },
  { id: 'support', icon: ICONS.heart },
  { id: 'settings', icon: ICONS.gear },
];
const NAV_LABEL: Record<Section, () => string> = {
  tools: () => t('Инструменты'),
  support: () => t('Поддержка'),
  settings: () => t('Настройки'),
};

function stop(): void {
  running?.unmount();
  running = null;
  stopScreen?.();
  stopScreen = null;
}

interface Bar {
  title: string;
  back?: boolean;
  search?: boolean;
  pin?: ToolMeta;
  brand?: boolean;
}

const iconBtn = (action: string, icon: string, label: string) =>
  `<button type="button" class="act" data-action="${action}" aria-label="${esc(label)}">${icon}</button>`;

function shell(bar: Bar): { content: HTMLElement } {
  const backLabel = fromShortcut && tool ? t('Закрыть') : t('Назад');
  app.innerHTML = `
    <header class="bar">
      ${bar.back ? `<button type="button" class="back" data-action="nav.back" aria-label="${esc(backLabel)}">${fromShortcut && tool ? '×' : '‹'}</button>` : ''}
      <h1>${bar.brand ? `<span class="brand-mark">${brandMark()}</span>` : ''}${esc(bar.title)}</h1>
      <span class="grow"></span>
      ${bar.search ? iconBtn('nav.search', ICONS.search, t('Поиск по инструментам')) : ''}
      ${bar.pin ? iconBtn('nav.pin', ICONS.pin, t('Ярлык на рабочий стол')) : ''}
    </header>
    ${searching && bar.search ? `<div class="searchrow"><input class="in wide" data-input="nav.query" data-id="q" type="search" placeholder="${esc(t('Поиск по инструментам'))}" value="${esc(query)}"></div>` : ''}
    <main class="screen"></main>
    <nav class="tabbar" aria-label="${esc(t('Разделы'))}">
      ${NAV.map((n) => `<button type="button" class="tab${n.id === section ? ' on' : ''}" data-action="nav.go" data-section="${n.id}" ${n.id === section ? 'aria-current="page"' : ''}><span class="ti">${n.icon}</span><span>${esc(NAV_LABEL[n.id]())}</span></button>`).join('')}
    </nav>`;
  return { content: app.querySelector('.screen') as HTMLElement };
}

function showHome(): void {
  token++;
  stop();
  section = 'tools';
  tool = null;
  const { content } = shell({ title: t('Мультитул'), search: true, brand: true });
  const draw = () => {
    const top = content.scrollTop;
    renderGrid(content, TOOLS, favorites(), query);
    content.scrollTop = top;
  };
  draw();
  const home = document.createElement('div');
  home.className = 'brandline';
  home.innerHTML = `${brandMark()}<span>${esc(BRAND_NAME)}</span>`;
  content.append(home);
  homeRedraw = () => {
    const top = content.scrollTop;
    renderGrid(content, TOOLS, favorites(), query);
    content.append(home);
    content.scrollTop = top;
  };
}

let homeRedraw: (() => void) | null = null;

function showSupport(): void {
  token++;
  stop();
  section = 'support';
  tool = null;
  const { content } = shell({ title: t('Поддержка') });
  stopScreen = renderSupport(content);
}

function showSettings(): void {
  token++;
  stop();
  section = 'settings';
  tool = null;
  const { content } = shell({ title: t('Настройки') });
  stopScreen = renderSettings(content, showSupport);
}

function showSection(s: Section): void {
  searching = false;
  if (s === 'tools') showHome();
  else if (s === 'support') showSupport();
  else showSettings();
}

async function openTool(meta: ToolMeta): Promise<void> {
  if (!meta.enabled || !meta.load) {
    toast(t('«{0}» — скоро', t(meta.title)));
    return;
  }
  if (meta.premium && !hasPremium()) {
    premiumSheet(t(meta.title), () => void openTool(meta));
    return;
  }
  const my = ++token;
  stop();
  section = 'tools';
  tool = meta;
  searching = false;
  const { content } = shell({ title: t(meta.title), back: true, pin: meta });
  content.classList.add('tool-body');
  void touchRecent(meta.id, (id) => (toolById(id) ? t((toolById(id) as ToolMeta).title) : null));
  try {
    const mod = await meta.load();
    const inst = await mod.default(content);
    if (my !== token) {
      inst.unmount();
      return;
    }
    running = inst;
  } catch (err) {
    console.error(err);
    content.textContent = t('Не удалось загрузить инструмент');
  }
}

function goBack(): void {
  if (closeTopSheet()) return;
  if (tool) {
    if (fromShortcut) void App.exitApp().catch(() => undefined);
    else showHome();
    return;
  }
  if (section !== 'tools') showHome();
  else if (searching) {
    searching = false;
    query = '';
    showHome();
  } else void App.exitApp().catch(() => undefined);
}

async function pin(meta: ToolMeta): Promise<void> {
  const r = await pinTool({ id: meta.id, title: t(meta.title) });
  if (r === 'requested') toast(t('Подтвердите добавление ярлыка на рабочий стол'));
  else if (r === 'unsupported') toast(t('Ваш лаунчер не поддерживает закрепление ярлыков'));
  else if (r === 'web') toast(t('Ярлыки работают только в приложении Android'));
  else toast(t('Не удалось создать ярлык'));
}

function toolMenu(meta: ToolMeta): void {
  const fav = isFavorite(meta.id);
  menuSheet(t(meta.title), [
    { label: t('Открыть'), primary: true, run: () => void openTool(meta) },
    {
      label: fav ? t('Убрать из избранного') : t('В избранное'),
      run: () => {
        toggleFavorite(meta.id);
        homeRedraw?.();
      },
    },
    { label: t('Ярлык на рабочий стол'), run: () => void pin(meta) },
  ]);
}

/* ------------------------------------------------------------------ единый обработчик нажатий */
initActions();
initTouch();
scope()
  .on('nav.go', (el) => showSection(el.dataset.section as Section))
  .on('nav.back', goBack)
  .on('nav.pin', () => tool && void pin(tool))
  .on('nav.search', () => {
    searching = !searching;
    if (!searching) query = '';
    showHome();
    if (searching) (app.querySelector('[data-id="q"]') as HTMLInputElement | null)?.focus();
  })
  .on('nav.query', (el) => {
    query = (el as HTMLInputElement).value;
    homeRedraw?.(); // обновляем плитки на месте, поле ввода и фокус остаются
  })
  .on('home.open', (el) => {
    const m = toolById(el.dataset.tool as string);
    if (m) void openTool(m);
  })
  .on('home.menu', (el) => {
    const m = toolById(el.dataset.tool as string);
    if (m && m.enabled) toolMenu(m);
  });

if (Capacitor.isNativePlatform()) void App.addListener('backButton', goBack);

onToolIntent((id) => {
  const meta = toolById(id);
  if (!meta) return;
  fromShortcut = true;
  void openTool(meta);
});

// смена языка применяется мгновенно: перерисовываем раздел на месте, прокрутка сохраняется
// (тема и плотность меняются атрибутами на <html> — перерисовка не нужна)
let lastLang = effectiveLang();
onSettings(() => {
  const l = effectiveLang();
  if (l === lastLang) return;
  lastLang = l;
  if (tool) return; // инструмент не перерисовываем — он работает с датчиками
  const keep = (app.querySelector('.screen') as HTMLElement | null)?.scrollTop ?? 0;
  showSection(section);
  const sc = app.querySelector('.screen') as HTMLElement | null;
  if (sc) sc.scrollTop = keep;
});

void (async () => {
  await loadSettings();
  await Promise.all([loadFavorites(), loadPremium()]);
  void syncPurchases();
  void syncRecent(null, (id) => (toolById(id) ? t((toolById(id) as ToolMeta).title) : null));
  const id = await getLaunchTool();
  const meta = id ? toolById(id) : undefined;
  if (meta) {
    fromShortcut = true;
    await openTool(meta);
  } else {
    showHome();
  }
})();
