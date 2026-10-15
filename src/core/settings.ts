import { resolveLang, setLang, type LangPref } from './i18n';
import { loadJSON, saveJSON } from './storage';
import { setSystemBars } from './system';

export type Theme = 'classic' | 'amoled' | 'paper';
export type Density = 'normal' | 'compact';
export type LenUnit = 'm' | 'ft';

export const THEMES: Theme[] = ['classic', 'amoled', 'paper'];

export interface Settings {
  theme: Theme;
  lang: LangPref;
  density: Density;
  lenUnit: LenUnit;
  /** Высота камеры над землёй (глаз), метры */
  eyeHeight: number;
  haptics: boolean;
}

export const SETTINGS_KEY = 'app.settings';
export const DEFAULT_SETTINGS: Settings = { theme: 'classic', lang: 'system', density: 'normal', lenUnit: 'm', eyeHeight: 1.6, haptics: true };

let S: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

export const settings = (): Settings => S;
export const onSettings = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Старые значения темы (до 2.1): светлая → «Бумага», тёмная (чистый чёрный) → AMOLED, «системная» → по системе. */
export function migrateTheme(v: unknown, prefersDark: boolean): Theme {
  if (v === 'classic' || v === 'amoled' || v === 'paper') return v;
  if (v === 'light') return 'paper';
  if (v === 'dark') return 'amoled';
  return prefersDark ? 'classic' : 'paper';
}

/** Применяет тему мгновенно: атрибут на <html>, meta theme-color и системные панели Android. */
export function applyTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = S.theme;
  root.dataset.density = S.density;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  const light = S.theme === 'paper';
  const bars = (window as unknown as { Capacitor?: { Plugins?: { SystemBars?: { setStyle?: (o: { style: string }) => Promise<void> } } } }).Capacitor?.Plugins?.SystemBars;
  void bars?.setStyle?.({ style: light ? 'LIGHT' : 'DARK' })?.catch?.(() => undefined);
  if (bg) void setSystemBars(bg, light);
}

export async function loadSettings(): Promise<void> {
  const saved = await loadJSON<Record<string, unknown>>(SETTINGS_KEY, {});
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  S = { ...DEFAULT_SETTINGS, ...(saved as Partial<Settings>), theme: migrateTheme(saved.theme, prefersDark) };
  if (!['system', 'ru', 'en'].includes(S.lang)) S.lang = 'system';
  if (!['normal', 'compact'].includes(S.density)) S.density = 'normal';
  setLang(S.lang);
  applyTheme();
}

export function updateSettings(p: Partial<Settings>): void {
  S = { ...S, ...p };
  void saveJSON(SETTINGS_KEY, S);
  if ('lang' in p) setLang(S.lang);
  applyTheme();
  for (const l of listeners) l();
}

/** Замена настроек целиком (восстановление из резервной копии). */
export function replaceSettings(next: Partial<Settings>): void {
  S = { ...DEFAULT_SETTINGS, ...next, theme: migrateTheme(next.theme, true) };
  void saveJSON(SETTINGS_KEY, S);
  setLang(S.lang);
  applyTheme();
  for (const l of listeners) l();
}

export const effectiveLang = () => resolveLang(S.lang);
