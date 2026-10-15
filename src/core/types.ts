export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Запущенный инструмент. unmount() должен освободить датчики, таймеры и звук. */
export interface Tool {
  unmount(): void;
}

/** Заголовок и подсказка — русский текст-ключ (T()), переводятся при показе через t(). */
export type ToolFactory = (root: HTMLElement) => Tool | Promise<Tool>;

export interface ToolMeta {
  id: string;
  title: string;
  hint: string;
  /** SVG-разметка иконки (stroke = currentColor) */
  icon: string;
  /** Расширенная функция: после пробного периода — только по Premium (контракт 1.6) */
  premium?: boolean;
  enabled: boolean;
  /** Ленивая загрузка модуля инструмента. Для неактивных не задаётся. */
  load?: () => Promise<{ default: ToolFactory }>;
}
