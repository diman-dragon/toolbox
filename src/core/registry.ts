import type { ToolMeta } from './types';
import { ICONS } from '../ui/icons';

/**
 * Реестр инструментов. Чтобы добавить новый:
 * 1) создайте src/tools/<id>/index.ts с `export default` фабрикой,
 * 2) добавьте запись сюда с enabled: true и load.
 */
export const TOOLS: ToolMeta[] = [
  { id: 'level', title: 'Уровень', hint: 'пузырёк и ампула', icon: ICONS.level, enabled: true, load: () => import('../tools/level') },
  { id: 'protractor', title: 'Угломер', hint: 'угол и уклон', icon: ICONS.protractor, enabled: true, load: () => import('../tools/protractor') },
  { id: 'angles', title: 'Шаблоны углов', hint: '15° · 30° · 45° · 60° · 90°', icon: ICONS.angles, enabled: true, load: () => import('../tools/angles') },
  { id: 'height', title: 'Высотомер', hint: 'высота по углу', icon: ICONS.height, enabled: true, load: () => import('../tools/height') },
  {
    id: 'rangefinder',
    title: 'Дальномер',
    hint: 'по высоте глаз и углу',
    icon: ICONS.rangefinder,
    enabled: true,
    load: () => import('../tools/height').then((m) => ({ default: m.createRange })),
  },
  { id: 'area', title: 'Площадь', hint: 'комната, участок', icon: ICONS.area, enabled: true, load: () => import('../tools/area') },
  { id: 'circle', title: 'Окружность', hint: 'диаметр и обхват', icon: ICONS.circle, enabled: true, load: () => import('../tools/circle') },
  { id: 'metal', title: 'Металлоискатель', hint: 'магнитометр', icon: ICONS.metal, enabled: true, load: () => import('../tools/metal') },
  { id: 'compass', title: 'Компас', hint: 'магнитный север', icon: ICONS.compass, enabled: true, load: () => import('../tools/compass') },
  { id: 'plumb', title: 'Отвес', hint: 'вертикаль на камере', icon: ICONS.plumb, enabled: true, load: () => import('../tools/plumb') },
  { id: 'ruler', title: 'Линейка', hint: 'с калибровкой', icon: ICONS.ruler, enabled: true, load: () => import('../tools/ruler') },
];
