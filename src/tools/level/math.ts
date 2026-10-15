import { T, t } from '../../core/i18n';

export type Unit = 'deg' | 'pct' | 'mm';

export const UNITS: Unit[] = ['deg', 'pct', 'mm'];
export const UNIT_LABEL: Record<Unit, string> = { deg: '°', pct: '%', mm: T('мм/м') };

const DEG2RAD = Math.PI / 180;

export function nextUnit(u: Unit): Unit {
  return UNITS[(UNITS.indexOf(u) + 1) % UNITS.length];
}

/** Форматирует модуль угла (градусы) в выбранных единицах. */
export function formatAngle(deg: number, unit: Unit): string {
  const a = Math.min(Math.abs(deg), 80);
  switch (unit) {
    case 'pct':
      return `${(Math.tan(a * DEG2RAD) * 100).toFixed(1)}%`;
    case 'mm':
      return `${(Math.tan(a * DEG2RAD) * 1000).toFixed(1)} ${t('мм/м')}`;
    default:
      return `${a.toFixed(1)}°`;
  }
}

export const unitLabel = (u: Unit): string => t(UNIT_LABEL[u]);

/** Положение пузырька в долях радиуса (−1…1): линейно, у края упирается при maxDeg. */
export function bubblePos(sx: number, sy: number, maxDeg: number): { nx: number; ny: number } {
  let nx = sx / maxDeg;
  let ny = -sy / maxDeg;
  const len = Math.hypot(nx, ny);
  if (len > 1) {
    nx /= len;
    ny /= len;
  }
  return { nx, ny };
}
