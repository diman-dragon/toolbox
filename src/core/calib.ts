import { loadJSON } from './storage';

/** Калибровка нуля и инверсия осей. Сохраняются уровнем и используются всеми инструментами на датчиках. */
export interface Calib {
  ox: number;
  oy: number;
  invert: boolean;
}

export const LEVEL_SETTINGS_KEY = 'level.settings';

export async function loadCalib(): Promise<Calib> {
  const s = await loadJSON<Partial<Calib>>(LEVEL_SETTINGS_KEY, {});
  return { ox: s.ox ?? 0, oy: s.oy ?? 0, invert: s.invert ?? false };
}
