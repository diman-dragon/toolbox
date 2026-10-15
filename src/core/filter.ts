import type { Vec3 } from './types';

/**
 * Фильтры сигнала. Все постоянные времени заданы в секундах и не зависят от частоты датчика
 * (у разных телефонов она от 16 до 200 Гц): раньше коэффициент был «на отсчёт», и на быстрых
 * датчиках фильтра фактически не было — отсюда «резкий» уровень.
 */
export interface GravityFilterOpts {
  /** Постоянная времени в покое, с: чем больше, тем спокойнее цифры. */
  tauRest: number;
  /** Постоянная времени при быстром движении, с: чтобы показания не отставали. */
  tauMove: number;
  /** Отклонение (м/с²) от сглаженного значения, до которого считаем, что телефон стоит. */
  restBand: number;
  /** Отклонение (м/с²), начиная с которого считаем, что телефон реально движется. */
  moveBand: number;
}

export const DEFAULT_GRAVITY_FILTER: GravityFilterOpts = {
  tauRest: 0.3,
  tauMove: 0.05,
  restBand: 0.1,
  moveBand: 0.45,
};

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Адаптивный однополюсный фильтр вектора гравитации: в покое сильно, в движении слабо. */
export class GravityFilter {
  private f: Vec3 | null = null;
  private t = 0;

  constructor(private readonly o: GravityFilterOpts = DEFAULT_GRAVITY_FILTER) {}

  reset(): void {
    this.f = null;
  }

  /** Подать отсчёт; t — время в мс. Возвращает сглаженный вектор. */
  push(v: Vec3, t: number): Vec3 {
    if (!this.f) {
      this.f = { ...v };
      this.t = t;
      return this.f;
    }
    const dt = Math.min(0.1, Math.max(0.001, (t - this.t) / 1000));
    this.t = t;
    const f = this.f;
    const e = Math.hypot(v.x - f.x, v.y - f.y, v.z - f.z);
    const k = smooth01((e - this.o.restBand) / (this.o.moveBand - this.o.restBand));
    const tau = this.o.tauRest + (this.o.tauMove - this.o.tauRest) * k;
    const a = 1 - Math.exp(-dt / tau);
    f.x += (v.x - f.x) * a;
    f.y += (v.y - f.y) * a;
    f.z += (v.z - f.z) * a;
    return f;
  }
}

/** Плавное «догоняние» значения за кадр: пузырёк не прыгает, а плывёт. */
export function damp(current: number, target: number, dtSec: number, tau: number): number {
  if (!(tau > 0)) return target;
  return current + (target - current) * (1 - Math.exp(-Math.min(dtSec, 0.1) / tau));
}

/** Значение для показа цифрой: меняется, только когда реальное значение ушло заметно дальше шага округления. */
export function stableRound(shown: number | null, value: number, step: number): number {
  if (shown !== null && Math.abs(value - shown) < step * 0.75) return shown;
  return Math.round(value / step) * step;
}

/** Порог с гистерезисом: включается при x ≤ enter, выключается при x > leave. */
export function hysteresis(on: boolean, x: number, enter: number, leave: number): boolean {
  return on ? x <= leave : x <= enter;
}

/** Среднее и разброс по вектору за серию отсчётов (для калибровок). */
export function meanVec(samples: Vec3[]): { mean: Vec3; std: number } {
  const n = samples.length || 1;
  const m = samples.reduce((a, s) => ({ x: a.x + s.x / n, y: a.y + s.y / n, z: a.z + s.z / n }), { x: 0, y: 0, z: 0 });
  const v = samples.reduce((a, s) => a + (s.x - m.x) ** 2 + (s.y - m.y) ** 2 + (s.z - m.z) ** 2, 0) / n;
  return { mean: m, std: Math.sqrt(v) };
}

/** Круговое сглаживание угла (градусы), кратчайшей дугой. */
export function dampAngle(current: number, target: number, dtSec: number, tau: number): number {
  const d = ((((target - current + 180) % 360) + 360) % 360) - 180;
  const k = tau > 0 ? 1 - Math.exp(-Math.min(dtSec, 0.1) / tau) : 1;
  return (((current + d * k) % 360) + 360) % 360;
}
