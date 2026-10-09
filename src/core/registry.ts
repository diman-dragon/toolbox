import type { ToolMeta } from './types';
import { ICONS } from '../ui/icons';

/**
 * Реестр инструментов. Чтобы добавить новый:
 * 1) создайте src/tools/<id>/index.ts с `export default` фабрикой,
 * 2) добавьте запись сюда с enabled: true и load,
 * 3) для ярлыка на рабочий стол: добавьте id в scripts/make-shortcut-icons.mjs и запустите его.
 */
export const TOOLS: ToolMeta[] = [
  { id: 'level', title: 'Уровень', hint: 'пузырёк и ампула', icon: ICONS.level, enabled: true, load: () => import('../tools/level') },
  { id: 'protractor', title: 'Угломер', hint: 'угол и уклон', icon: ICONS.protractor, enabled: true, load: () => import('../tools/protractor') },
  { id: 'angles', title: 'Шаблоны углов', hint: '15° · 30° · 45° · 60° · 90°', icon: ICONS.angles, enabled: true, load: () => import('../tools/angles') },
  { id: 'height', title: 'Высотомер', hint: 'по камере', icon: ICONS.height, enabled: true, load: () => import('../tools/height') },
  {
    id: 'rangefinder',
    title: 'Дальномер',
    hint: 'по камере',
    icon: ICONS.rangefinder,
    enabled: true,
    load: () => import('../tools/height').then((m) => ({ default: m.createRange })),
  },
  { id: 'metal', title: 'Металлоискатель', hint: 'магнитометр', icon: ICONS.metal, enabled: true, load: () => import('../tools/metal') },
  { id: 'compass', title: 'Компас', hint: 'магнитный север', icon: ICONS.compass, enabled: true, load: () => import('../tools/compass') },
  { id: 'plumb', title: 'Отвес', hint: 'вертикаль на камере', icon: ICONS.plumb, enabled: true, load: () => import('../tools/plumb') },
  { id: 'ruler', title: 'Линейка', hint: 'с калибровкой', icon: ICONS.ruler, enabled: true, load: () => import('../tools/ruler') },
  { id: 'scanner', title: 'Сканер', hint: 'QR и штрихкоды', icon: ICONS.scanner, enabled: true, load: () => import('../tools/scanner') },
  { id: 'sound', title: 'Шумомер', hint: 'уровень звука, дБ', icon: ICONS.sound, enabled: true, load: () => import('../tools/sound') },
];

export const toolById = (id: string): ToolMeta | undefined => TOOLS.find((t) => t.id === id);
