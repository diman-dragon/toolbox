import { NO_CALIB, type CalibData } from './orient';
import { loadJSON, saveJSON } from './storage';

export type { CalibData } from './orient';
export const LEVEL_SETTINGS_KEY = 'level.settings';

/** Калибровка нуля и инверсия осей: хранит «Уровень», используют все инструменты на датчиках. */
export async function loadCalib(): Promise<CalibData> {
  const s = await loadJSON<Partial<CalibData>>(LEVEL_SETTINGS_KEY, {});
  return {
    ox: Number.isFinite(s.ox) ? (s.ox as number) : NO_CALIB.ox,
    oy: Number.isFinite(s.oy) ? (s.oy as number) : NO_CALIB.oy,
    invert: s.invert ?? NO_CALIB.invert,
  };
}

/** Сбросить только смещения нуля (единицы и прочее «Уровня» сохраняются). */
export async function resetCalib(): Promise<void> {
  const cur = await loadJSON<Record<string, unknown>>(LEVEL_SETTINGS_KEY, {});
  await saveJSON(LEVEL_SETTINGS_KEY, { ...cur, ox: 0, oy: 0 });
}
