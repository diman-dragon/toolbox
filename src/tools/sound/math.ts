/** Полюса A-взвешивания (IEC 61672), Гц. */
const F1 = 20.598997;
const F2 = 107.65265;
const F3 = 737.86223;
const F4 = 12194.217;

export interface FirstOrder {
  type: 'high' | 'low';
  /** Частота среза, Гц */
  f: number;
}

/**
 * A-взвешивание = s⁴ / ((s+ω1)²(s+ω2)(s+ω3)(s+ω4)²): шесть простых звеньев первого порядка.
 * Звенья первого порядка устойчивы численно (в отличие от одного фильтра 6-го порядка)
 * и не упираются в ограничение добротности у BiquadFilterNode.
 */
export const A_CHAIN: FirstOrder[] = [
  { type: 'high', f: F1 },
  { type: 'high', f: F1 },
  { type: 'high', f: F2 },
  { type: 'high', f: F3 },
  { type: 'low', f: F4 },
  { type: 'low', f: F4 },
];

/** Коэффициенты цифрового звена (билинейное преобразование с предыскажением) для IIRFilterNode. */
export function firstOrderCoefs(s: FirstOrder, fs: number): { b: number[]; a: number[] } {
  const c = 2 * fs;
  const w = c * Math.tan(Math.PI * Math.min(s.f, fs * 0.45) / fs); // предыскажение частоты среза
  const den = c + w;
  const a1 = (w - c) / den;
  return s.type === 'high'
    ? { b: [c / den, -c / den], a: [1, a1] }
    : { b: [w / den, w / den], a: [1, a1] };
}

/** |H| цифрового звена на частоте f. */
function mag(coef: { b: number[]; a: number[] }, f: number, fs: number): number {
  const w = (2 * Math.PI * f) / fs;
  const ex = (k: number) => [Math.cos(k * w), -Math.sin(k * w)];
  const poly = (c: number[]) => {
    let re = 0;
    let im = 0;
    c.forEach((v, k) => {
      const [r, i] = ex(k);
      re += v * r;
      im += v * i;
    });
    return Math.hypot(re, im);
  };
  return poly(coef.b) / poly(coef.a);
}

/** Усиление всей цепочки на частоте f (линейное). */
export function chainGain(f: number, fs: number): number {
  return A_CHAIN.reduce((g, s) => g * mag(firstOrderCoefs(s, fs), f, fs), 1);
}

/** Компенсация: 0 дБ на 1 кГц, как требует определение A-взвешивания. */
export const aCompensation = (fs: number): number => 1 / chainGain(1000, fs);

/** Ответ A-взвешивания на частоте f, дБ (для проверки). */
export const aResponseDb = (f: number, fs: number): number =>
  20 * Math.log10(chainGain(f, fs) * aCompensation(fs));

/** Уровень в дБ из средней мощности сигнала (полная шкала = 1.0) и поправки калибровки. */
export function levelDb(power: number, offset: number): number {
  if (!(power > 1e-12)) return 0;
  return Math.max(0, 10 * Math.log10(power) + offset);
}

/** Шаг экспоненциального усреднения мощности: Fast τ=0.125 c, Slow τ=1 c. */
export const smoothingK = (dt: number, tau: number): number => 1 - Math.exp(-dt / tau);

/** Допустимое время воздействия по NIOSH: 85 дБА — 8 часов, каждые +3 дБ вдвое меньше. Секунды. */
export function safeSeconds(db: number): number {
  return 8 * 3600 * Math.pow(2, (85 - db) / 3);
}

export function fmtDuration(sec: number): string {
  if (sec >= 24 * 3600) return 'без ограничений';
  if (sec >= 3600) return `${(sec / 3600).toFixed(sec >= 36000 ? 0 : 1)} ч`;
  if (sec >= 60) return `${Math.round(sec / 60)} мин`;
  return `${Math.max(1, Math.round(sec))} с`;
}

const SCALE: Array<[number, string]> = [
  [30, 'почти тишина'],
  [40, 'шёпот, тихая библиотека'],
  [50, 'тихая комната, мелкий дождь'],
  [60, 'тихий офис, негромкая беседа'],
  [70, 'разговор, офис, телевизор'],
  [80, 'пылесос, оживлённая улица'],
  [90, 'грузовик, шумный ресторан, блендер'],
  [100, 'газонокосилка, метро'],
  [110, 'бензопила, громкая музыка'],
  [120, 'перфоратор, сирена рядом'],
];

export function describe(db: number): string {
  for (const [lim, text] of SCALE) if (db < lim) return text;
  return 'болевой порог — защитите слух';
}
