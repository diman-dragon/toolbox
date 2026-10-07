import type { Vec3 } from '../../core/types';
import { deviceTilts } from '../level/math';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

/** Приводит угол к диапазону (−180, 180]. */
export function normalize180(a: number): number {
  let r = ((a % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return r;
}

/**
 * Применяет калибровку нуля (смещения возвышения осей X и Y, градусы)
 * и возвращает исправленный вектор гравитации той же длины.
 */
export function applyCalibration(v: Vec3, ox: number, oy: number): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  const { tx, ty } = deviceTilts(v);
  const x = n * Math.sin((tx - ox) * DEG2RAD);
  const y = n * Math.sin((ty - oy) * DEG2RAD);
  const z = (v.z < 0 ? -1 : 1) * Math.sqrt(Math.max(n * n - x * x - y * y, 0));
  return { x, y, z };
}

/** Проекция вектора на плоскость экрана с учётом поворота экрана (0/90/180/270). */
export function toScreenVector(v: Vec3, screenAngle: number): { rx: number; ry: number } {
  switch (screenAngle) {
    case 90:
      return { rx: -v.y, ry: v.x };
    case 180:
      return { rx: -v.x, ry: -v.y };
    case 270:
      return { rx: v.y, ry: -v.x };
    default:
      return { rx: v.x, ry: v.y };
  }
}

/**
 * Угол горизонтальной оси экрана к горизонту, градусы, (−180, 180].
 * > 0 — правый край экрана выше. Имеет смысл, когда телефон стоит вертикально.
 */
export function inPlaneAngle(v: Vec3, screenAngle: number): number {
  const { rx, ry } = toScreenVector(v, screenAngle);
  return Math.atan2(rx, ry) * RAD2DEG;
}

/** Угол плоскости телефона к горизонту, 0…90°. Для телефона, лежащего на склоне. */
export function slopeAngle(v: Vec3): number {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return Math.acos(Math.min(1, Math.abs(v.z) / n)) * RAD2DEG;
}

/** Расстояние (градусы) до ближайшего кратного step. */
export function distToSnap(a: number, step = 45): number {
  const m = ((a % step) + step) % step;
  return Math.min(m, step - m);
}
