import { loadJSON, saveJSON } from './storage';

export type Theme = 'system' | 'light' | 'dark';
export type LenUnit = 'm' | 'ft';

export interface Settings {
  theme: Theme;
  lenUnit: LenUnit;
  /** Высота камеры над землёй (глаз), метры */
  eyeHeight: number;
  haptics: boolean;
}

const KEY = 'app.settings';
let S: Settings = { theme: 'system', lenUnit: 'm', eyeHeight: 1.6, haptics: true };
const mq = window.matchMedia('(prefers-color-scheme: dark)');

/** Цвет системных панелей Android (meta theme-color) — совпадает с фоном темы. */
export const THEME_COLOR = { dark: '#000000', light: '#cdab82' } as const;

export const settings = (): Settings => S;

export function applyTheme(): void {
  const dark = S.theme === 'dark' || (S.theme === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
}
mq.addEventListener('change', applyTheme);

export async function loadSettings(): Promise<void> {
  S = { ...S, ...(await loadJSON<Partial<Settings>>(KEY, {})) };
  applyTheme();
}

export function updateSettings(p: Partial<Settings>): void {
  S = { ...S, ...p };
  void saveJSON(KEY, S);
  applyTheme();
}
