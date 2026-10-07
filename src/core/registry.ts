import type { ToolMeta } from './types';
import { ICONS } from '../ui/icons';

/**
 * Реестр инструментов. Чтобы включить новый инструмент:
 * 1) создайте src/tools/<id>/index.ts с `export default` фабрикой,
 * 2) поставьте enabled: true и добавьте load.
 */
export const TOOLS: ToolMeta[] = [
  {
    id: 'level',
    title: 'Уровень',
    hint: 'пузырёк и ампула',
    icon: ICONS.level,
    enabled: true,
    load: () => import('../tools/level'),
  },
  {
    id: 'protractor',
    title: 'Угломер',
    hint: 'угол и уклон',
    icon: ICONS.protractor,
    enabled: true,
    load: () => import('../tools/protractor'),
  },
  {
    id: 'rangefinder',
    title: 'Дальномер',
    hint: 'по высоте и углу',
    icon: ICONS.rangefinder,
    enabled: false,
  },
  {
    id: 'compass',
    title: 'Компас',
    hint: 'магнитометр',
    icon: ICONS.compass,
    enabled: false,
  },
  {
    id: 'plumb',
    title: 'Отвес',
    hint: 'вертикаль на камере',
    icon: ICONS.plumb,
    enabled: false,
  },
  {
    id: 'ruler',
    title: 'Линейка',
    hint: 'с калибровкой',
    icon: ICONS.ruler,
    enabled: false,
  },
];
