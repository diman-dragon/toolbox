export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Запущенный инструмент. unmount() должен освободить датчики, таймеры и звук. */
export interface Tool {
  unmount(): void;
}

export type ToolFactory = (root: HTMLElement) => Tool | Promise<Tool>;

export interface ToolMeta {
  id: string;
  title: string;
  hint: string;
  /** SVG-разметка иконки (stroke = currentColor) */
  icon: string;
  enabled: boolean;
  /** Ленивая загрузка модуля инструмента. Для неактивных не задаётся. */
  load?: () => Promise<{ default: ToolFactory }>;
}
