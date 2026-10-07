import type { Vec3 } from '../../core/types';

export type Unit = 'deg' | 'pct' | 'mm';

export const UNITS: Unit[] = ['deg', 'pct', 'mm'];
export const UNIT_LABEL: Record<Unit, string> = { deg: '°', pct: '%', mm: 'мм/м' };

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function nextUnit(u: Unit): Unit {
  return UNITS[(UNITS.indexOf(u) + 1) % UNITS.length];
}

/**
 * Углы возвышения осей устройства над горизонтом (градусы).
 * tx > 0: правый край (ось +X) выше. ty > 0: верхний край (ось +Y) выше.
 * flatness: 1 — телефон лежит ровно, 0 — стоит на ребре.
 */
export function deviceTilts(v: Vec3): { tx: number; ty: number; flatness: number } {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    tx: Math.asin(clamp(v.x / n, -1, 1)) * RAD2DEG,
    ty: Math.asin(clamp(v.y / n, -1, 1)) * RAD2DEG,
    flatness: Math.abs(v.z) / n,
  };
}

/** Перевод наклонов из системы координат устройства в систему экрана. */
export function toScreenFrame(
  tx: number,
  ty: number,
  angle: number,
): { sx: number; sy: number } {
  switch (angle) {
    case 90:
      return { sx: -ty, sy: tx };
    case 180:
      return { sx: -tx, sy: -ty };
    case 270:
      return { sx: ty, sy: -tx };
    default:
      return { sx: tx, sy: ty };
  }
}

/** Форматирует модуль угла (градусы) в выбранных единицах. */
export function formatAngle(deg: number, unit: Unit): string {
  const a = Math.min(Math.abs(deg), 80);
  switch (unit) {
    case 'pct':
      return `${(Math.tan(a * DEG2RAD) * 100).toFixed(1)}%`;
    case 'mm':
      return `${(Math.tan(a * DEG2RAD) * 1000).toFixed(1)} мм/м`;
    default:
      return `${a.toFixed(1)}°`;
  }
}
