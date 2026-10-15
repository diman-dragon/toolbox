import { loadJSON, saveJSON } from './storage';

/** Калибровка горизонта камеры: смещение нуля оси Z акселерометра, м/с². */
export interface AimCalib {
  zoff: number;
}

const KEY = 'aim.calib';

export async function loadAim(): Promise<AimCalib> {
  const s = await loadJSON<Partial<AimCalib>>(KEY, {});
  return { zoff: Number.isFinite(s.zoff) ? (s.zoff as number) : 0 };
}

export const saveAim = (c: AimCalib): Promise<void> => saveJSON(KEY, c);
export const resetAim = (): Promise<void> => saveJSON(KEY, { zoff: 0 });
