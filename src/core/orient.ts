import type { Vec3 } from './types';

/**
 * Геометрия ориентации телефона по акселерометру — только чистые функции (tests/orient.test.mjs).
 * Система координат Android: X — вправо, Y — вверх по экрану, Z — из экрана к нам.
 * Вектор акселерометра указывает «вверх» (лёжа экраном вверх: z ≈ +g).
 */
export const R2D = 180 / Math.PI;
export const D2R = Math.PI / 180;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Калибровка нуля: ox, oy — наклон осей X и Y на идеально ровной поверхности, градусы. */
export interface CalibData {
  ox: number;
  oy: number;
  invert: boolean;
}

export const NO_CALIB: CalibData = { ox: 0, oy: 0, invert: false };

export const norm = (v: Vec3): number => Math.hypot(v.x, v.y, v.z) || 1;

/** Приводит угол к диапазону (−180, 180]. */
export function normalize180(a: number): number {
  let r = ((a % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return r;
}

/**
 * Поворот, переводящий «вертикаль датчика на ровной поверхности» в строгую вертикаль Z.
 * Именно поворот, а не вычитание углов: он верен и когда телефон стоит (угломер, отвес),
 * а не только когда лежит, как в «Уровне». Раньше вычитался наклон осей, и для стоящего
 * телефона поправка получалась неверной.
 */
export function calibrate(v: Vec3, c: CalibData): Vec3 {
  const w = c.invert ? { x: -v.x, y: -v.y, z: -v.z } : v;
  if (!c.ox && !c.oy) return w;
  const cx = Math.sin(c.ox * D2R);
  const cy = Math.sin(c.oy * D2R);
  const cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
  const k = 1 / (1 + cz);
  return {
    x: (1 - cx * cx * k) * w.x - cx * cy * k * w.y - cx * w.z,
    y: -cx * cy * k * w.x + (1 - cy * cy * k) * w.y - cy * w.z,
    z: cx * w.x + cy * w.y + (1 - (cx * cx + cy * cy) * k) * w.z,
  };
}

export interface Tilts {
  tx: number; // возвышение оси X, ° (>0 — правый край выше)
  ty: number; // возвышение оси Y, ° (>0 — верхний край выше)
  flatness: number; // 1 — лежит ровно, 0 — стоит на ребре
  slope: number; // угол плоскости телефона к горизонту, 0…90°
}

export function tilts(v: Vec3): Tilts {
  const n = norm(v);
  return {
    tx: Math.asin(clamp(v.x / n, -1, 1)) * R2D,
    ty: Math.asin(clamp(v.y / n, -1, 1)) * R2D,
    flatness: Math.abs(v.z) / n,
    slope: Math.atan2(Math.hypot(v.x, v.y), Math.abs(v.z)) * R2D, // atan2 устойчив при малых углах
  };
}

/** Проекция вектора на экран с учётом поворота экрана (0/90/180/270): rx — вправо, ry — вверх. */
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

/** Возвышение горизонтальной (sx) и вертикальной (sy) осей экрана над горизонтом, °. */
export function screenTilts(v: Vec3, screenAngle: number): { sx: number; sy: number } {
  const { rx, ry } = toScreenVector(v, screenAngle);
  const n = norm(v);
  return { sx: Math.asin(clamp(rx / n, -1, 1)) * R2D, sy: Math.asin(clamp(ry / n, -1, 1)) * R2D };
}

/**
 * Телефон стоит на ребре: какая ось экрана горизонтальна. Обычно горизонтальная ось экрана,
 * но при выключенном автоповороте телефон на длинном ребре остаётся «портретным» — тогда
 * меряем вертикальную ось экрана. Переключение с запасом 30 %, чтобы не дрожало.
 */
export function edgeTilt(v: Vec3, screenAngle: number, swapped: boolean): { tilt: number; swapped: boolean } {
  const { rx, ry } = toScreenVector(v, screenAngle);
  let sw = swapped;
  if (!sw && Math.abs(rx) > 1.3 * Math.abs(ry)) sw = true;
  else if (sw && Math.abs(ry) > 1.3 * Math.abs(rx)) sw = false;
  const n = norm(v);
  return { tilt: Math.asin(clamp((sw ? ry : rx) / n, -1, 1)) * R2D, swapped: sw };
}

/** Угол горизонтальной оси экрана к горизонту в плоскости экрана, (−180, 180]; > 0 — правый край выше. */
export function inPlaneAngle(v: Vec3, screenAngle: number): number {
  const { rx, ry } = toScreenVector(v, screenAngle);
  return Math.atan2(rx, ry) * R2D;
}

/** Расстояние (градусы) до ближайшего кратного step. */
export function distToSnap(a: number, step = 45): number {
  const m = ((a % step) + step) % step;
  return Math.min(m, step - m);
}

/**
 * Калибровка по двум положениям: на поверхности и после поворота на 180° на том же месте.
 * Наклон поверхности при развороте меняет знак, смещение датчика — нет; полусумма даёт чистое
 * смещение датчика, полуразность — наклон поверхности. null — телефон лежал не ровно.
 */
export function calibrateTwoPosition(m1: Vec3, m2: Vec3, minFlat = 0.97): { ox: number; oy: number; surface: number } | null {
  const a = tilts(m1);
  const b = tilts(m2);
  if (a.flatness < minFlat || b.flatness < minFlat) return null;
  return { ox: (a.tx + b.tx) / 2, oy: (a.ty + b.ty) / 2, surface: Math.hypot((a.tx - b.tx) / 2, (a.ty - b.ty) / 2) };
}

/**
 * Возвышение оптической оси задней камеры над горизонтом, ° (вверх > 0): sin = −Z/|g|.
 * zoff — смещение нуля оси Z, м/с² (калибровка горизонта: экраном вверх и вниз).
 */
export function cameraElevation(g: Vec3, c: CalibData, zoff: number): number {
  const w = calibrate({ x: g.x, y: g.y, z: g.z - zoff }, c);
  return -Math.asin(clamp(w.z / norm(w), -1, 1)) * R2D;
}
