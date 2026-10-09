/**
 * Знак DataLaw International: буква «D» из массивной «колонны» с засечками и отдельного полумесяца.
 * Единственный источник геометрии — отсюда генерируются иконка приложения, favicon и графика магазина
 * (scripts/make-icon.mjs). Чтобы подставить официальный векторный знак, замените пути ниже
 * (исходные координаты холста: x 362…1112, y 135…940).
 */
export const BRAND_NAME = 'DataLaw International';
export const BRAND_VIEWBOX = '360 130 760 815';
export const BRAND_PATHS = [
  'M382,150 C540,135 740,140 878,238 C800,200 700,172 625,168 C690,205 744,300 748,420 L748,654 C744,774 690,869 625,906 C700,902 800,874 878,836 C740,934 540,939 382,924 C470,934 560,904 590,814 C600,760 602,650 602,537 C602,424 600,314 590,260 C560,170 470,140 382,150 Z',
  'M843,155 C1010,200 1112,350 1112,540 C1112,730 1030,870 830,928 C960,850 1068,730 1068,540 C1068,360 960,230 843,155 Z',
] as const;

/** Знак как inline-SVG; цвет берётся из currentColor. */
export function brandMark(cls = ''): string {
  const d = BRAND_PATHS.map((p) => `<path d="${p}"/>`).join('');
  return `<svg class="${cls}" viewBox="${BRAND_VIEWBOX}" fill="currentColor" aria-hidden="true">${d}</svg>`;
}
