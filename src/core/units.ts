import { t } from './i18n';
import { settings } from './settings';

const FT = 0.3048;
const isFt = () => settings().lenUnit === 'ft';

export const uLabel = (): string => (isFt() ? t('фт') : t('м'));
export const toM = (v: number): number => (isFt() ? v * FT : v);
export const fromM = (m: number): number => (isFt() ? m / FT : m);

export function fmtLen(m: number): string {
  const v = fromM(m);
  return `${v.toFixed(Math.abs(v) < 10 ? 2 : 1)} ${uLabel()}`;
}

export function fmtArea(m2: number): string {
  const v = isFt() ? m2 / (FT * FT) : m2;
  return `${v.toFixed(v < 10 ? 2 : 1)} ${isFt() ? t('фт²') : t('м²')}`;
}
