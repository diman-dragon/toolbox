import { T } from './i18n';
import type { ToolMeta } from './types';
import { ICONS } from '../ui/icons';

/**
 * Реестр инструментов. Чтобы добавить новый:
 * 1) создайте src/tools/<id>/index.ts с `export default` фабрикой,
 * 2) добавьте запись сюда с enabled: true и load,
 * 3) для ярлыка на рабочий стол: добавьте id в scripts/make-shortcut-icons.mjs и запустите его.
 */
export const TOOLS: ToolMeta[] = [
  { id: 'level', title: T('Уровень'), hint: T('пузырёк и ампула'), icon: ICONS.level, enabled: true, load: () => import('../tools/level') },
  { id: 'protractor', title: T('Угломер'), hint: T('угол и уклон'), icon: ICONS.protractor, enabled: true, load: () => import('../tools/protractor') },
  { id: 'angles', title: T('Шаблоны углов'), hint: '15° · 30° · 45° · 60° · 90°', icon: ICONS.angles, premium: true, enabled: true, load: () => import('../tools/angles') },
  { id: 'height', title: T('Высотомер'), hint: T('по камере'), icon: ICONS.height, premium: true, enabled: true, load: () => import('../tools/height') },
  {
    id: 'rangefinder',
    title: T('Дальномер'),
    hint: T('по камере'),
    icon: ICONS.rangefinder,
    premium: true,
    enabled: true,
    load: () => import('../tools/height').then((m) => ({ default: m.createRange })),
  },
  { id: 'metal', title: T('Металлоискатель'), hint: T('магнитометр'), icon: ICONS.metal, premium: true, enabled: true, load: () => import('../tools/metal') },
  { id: 'compass', title: T('Компас'), hint: T('магнитный север'), icon: ICONS.compass, enabled: true, load: () => import('../tools/compass') },
  { id: 'plumb', title: T('Отвес'), hint: T('вертикаль на камере'), icon: ICONS.plumb, enabled: true, load: () => import('../tools/plumb') },
  { id: 'ruler', title: T('Линейка'), hint: T('с калибровкой'), icon: ICONS.ruler, enabled: true, load: () => import('../tools/ruler') },
  { id: 'scanner', title: T('Сканер'), hint: T('QR и штрихкоды'), icon: ICONS.scanner, enabled: true, load: () => import('../tools/scanner') },
  { id: 'sound', title: T('Шумомер'), hint: T('уровень звука, дБ'), icon: ICONS.sound, premium: true, enabled: true, load: () => import('../tools/sound') },
];

export const toolById = (id: string): ToolMeta | undefined => TOOLS.find((t) => t.id === id);
