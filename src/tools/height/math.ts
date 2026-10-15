const D2R = Math.PI / 180;

/** Типичная погрешность угла по акселерометру после калибровки, градусы. */
export const ANGLE_SIGMA = 0.3;
/** Погрешность «высоты камеры над землёй» (рука держит телефон не идеально), м. */
export const EYE_SIGMA = 0.05;
/** Дальше этого расстояния по земле считать нельзя: угол слишком мал. */
export const MAX_RANGE = 500;
/** Минимальный наклон вниз для расчёта по земле, градусы. */
export const MIN_DOWN = 0.5;

const tanDeg = (a: number) => Math.tan(a * D2R);

/** Расстояние по земле до точки под прицелом: d = h / tg(угол вниз). */
export function groundDistance(eye: number, elev: number): number | null {
  if (!(eye > 0) || !(elev <= -MIN_DOWN)) return null;
  const d = eye / tanDeg(-elev);
  return d <= MAX_RANGE ? d : null;
}

/** Высота объекта по двум углам с одной точки: расстояние берётся по основанию. */
export function heightFromBaseTop(
  eye: number,
  aBase: number,
  aTop: number,
): { h: number; d: number } | null {
  const d = groundDistance(eye, aBase);
  if (d === null || !(aTop > aBase)) return null;
  return { d, h: d * tanDeg(aTop) + eye };
}

/** Высота объекта, когда расстояние известно (основание необязательно). */
export function heightKnownDistance(
  d: number,
  aTop: number,
  aBase: number | null,
  eye: number,
): number | null {
  if (!(d > 0)) return null;
  if (aBase === null) return d * tanDeg(aTop) + eye;
  return aTop > aBase ? d * (tanDeg(aTop) - tanDeg(aBase)) : null;
}

/** Расстояние до объекта известной высоты: d = H / (tg верха − tg низа). */
export function distanceBySize(objHeight: number, aTop: number, aBottom: number): number | null {
  const k = tanDeg(aTop) - tanDeg(aBottom);
  if (!(objHeight > 0) || !(k > 0.0005)) return null;
  const d = objHeight / k;
  return d <= MAX_RANGE ? d : null;
}

/**
 * Погрешность результата f(p): корень из суммы квадратов вкладов каждого параметра
 * при смещении на ±sigma[i]. Infinity — результат при таком сдвиге перестаёт быть определён.
 */
export function spread(
  f: (p: number[]) => number | null,
  p: number[],
  sigma: number[],
): number | null {
  const f0 = f(p);
  if (f0 === null) return null;
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    if (!sigma[i]) continue;
    let worst = 0;
    for (const sign of [1, -1]) {
      const q = p.slice();
      q[i] += sign * sigma[i];
      const v = f(q);
      if (v === null) return Infinity;
      worst = Math.max(worst, Math.abs(v - f0));
    }
    acc += worst * worst;
  }
  return Math.sqrt(acc);
}

/** Среднее и стандартное отклонение. */
export function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(v) };
}

/** Смещение нуля оси Z по двум замерам на одной поверхности: экраном вверх и экраном вниз. */
export function zOffsetFromFlipped(zUp: number, zDown: number): number | null {
  if (!(zUp > 0) || !(zDown < 0)) return null;
  return (zUp + zDown) / 2;
}
