import { loadJSON, saveJSON } from './storage';

/**
 * Premium и поддержка (контракт 1.6): пробный период 30 дней, затем бесплатная часть остаётся,
 * расширенные функции — по Premium. Разовая покупка premium_lifetime. Тестеры — по коду, офлайн.
 */
export const TRIAL_DAYS = 30;
export const PRODUCT_PREMIUM = 'premium_lifetime';
export const TIPS = [
  { id: 'tip_tea', icon: 'tea' },
  { id: 'tip_cat_treat', icon: 'treat' },
  { id: 'tip_cat_food', icon: 'food' },
] as const;
export type TipId = (typeof TIPS)[number]['id'];

const KEY = 'premium.state';
const DAY = 86400000;

export interface PremiumState {
  firstRun: number;
  /** Куплен в Google Play (синхронизируется при запуске и по «Восстановить»). */
  purchased: boolean;
  /** Введён действительный код тестера. */
  code: string | null;
}

let st: PremiumState = { firstRun: 0, purchased: false, code: null };
const listeners = new Set<() => void>();
export const onPremium = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((l) => l());

export const premiumState = (): PremiumState => st;

export async function loadPremium(now = Date.now()): Promise<void> {
  const s = await loadJSON<Partial<PremiumState>>(KEY, {});
  st = { firstRun: Number.isFinite(s.firstRun) && (s.firstRun as number) > 0 ? (s.firstRun as number) : now, purchased: !!s.purchased, code: typeof s.code === 'string' ? s.code : null };
  if (st.firstRun === now) await saveJSON(KEY, st);
}

const save = () => {
  void saveJSON(KEY, st);
  emit();
};

export function trialDaysLeft(now = Date.now(), s: PremiumState = st): number {
  return Math.max(0, TRIAL_DAYS - Math.floor((now - s.firstRun) / DAY));
}
export const isPaid = (s: PremiumState = st): boolean => s.purchased || s.code !== null;
export const inTrial = (now = Date.now(), s: PremiumState = st): boolean => !isPaid(s) && trialDaysLeft(now, s) > 0;
/** Расширенные функции доступны: куплено, код или идёт пробный период. */
export const hasPremium = (now = Date.now(), s: PremiumState = st): boolean => isPaid(s) || trialDaysLeft(now, s) > 0;

export function setPurchased(v: boolean): void {
  if (st.purchased === v) return;
  st = { ...st, purchased: v };
  save();
}

/* ------------------------------------------------------------------ Коды тестеров */

/**
 * Код: DLD-IIII-IIII-SSSS-SSSS, где I — 5 случайных байт в base32, S — первые 5 байт HMAC-SHA256(secret, id).
 * Проверка офлайн. Секрет лежит в приложении, это защита от случайного ввода и пересылки «на глаз»,
 * а не от взлома: Premium стоит 4,99, а не банковские данные. Тот же секрет — в tools/make-codes.mjs (тест premium сверяет).
 */
export const CODE_SECRET = 'datalaw-design-premium-v1';
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I, O, 0, 1

export function b32(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

async function hmac(id: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(CODE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`premium:${id}`)));
  return b32(sig.slice(0, 5));
}

export const normalizeCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^DLD/, '');

export async function checkCode(raw: string): Promise<boolean> {
  const c = normalizeCode(raw);
  if (c.length !== 16) return false;
  const id = c.slice(0, 8);
  const sig = c.slice(8);
  return (await hmac(id)) === sig;
}

export async function makeCode(idBytes: Uint8Array): Promise<string> {
  const id = b32(idBytes.slice(0, 5));
  const c = id + (await hmac(id));
  return `DLD-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`;
}

/** Применить код; true — принят. */
export async function redeemCode(raw: string): Promise<boolean> {
  if (!(await checkCode(raw))) return false;
  st = { ...st, code: normalizeCode(raw) };
  save();
  return true;
}
