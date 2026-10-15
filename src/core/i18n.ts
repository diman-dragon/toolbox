import { EN } from '../i18n-en';

/**
 * Локализация (контракт 1.1: один русский текст = один ключ перевода).
 * Ключ — сам русский текст, английский лежит в src/i18n-en.ts. Тест i18n проверяет, что
 * у каждого t('…') и T('…') есть перевод и что в коде нет русских строк вне t()/T().
 */
export type Lang = 'ru' | 'en';
export type LangPref = 'system' | Lang;

let lang: Lang = 'ru';
export const getLang = (): Lang => lang;
export const locale = (): string => (lang === 'en' ? 'en-US' : 'ru-RU');

export function resolveLang(pref: LangPref): Lang {
  if (pref === 'ru' || pref === 'en') return pref;
  const sys = (typeof navigator !== 'undefined' ? navigator.language : 'ru').toLowerCase();
  return sys.startsWith('ru') ? 'ru' : 'en';
}

export function setLang(pref: LangPref): void {
  lang = resolveLang(pref);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Маркер для текстов, объявляемых заранее (константы): переводятся при показе через t(). */
export const T = (ru: string): string => ru;

/** Перевод. Подстановки {0}, {1}… заменяются аргументами. */
export function t(ru: string, ...args: Array<string | number>): string {
  let s = lang === 'en' ? (EN[ru] ?? ru) : ru;
  for (let i = 0; i < args.length; i++) s = s.split(`{${i}}`).join(String(args[i]));
  return s;
}

/** Склонение по числу: ru — три формы, en — две. Возвращает только слово. */
export function plural(n: number, ru: [string, string, string], en: [string, string]): string {
  const k = Math.abs(Math.trunc(n));
  if (lang === 'en') return k === 1 ? en[0] : en[1];
  const m10 = k % 10;
  const m100 = k % 100;
  if (m10 === 1 && m100 !== 11) return ru[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return ru[1];
  return ru[2];
}

/** Экранирование текста для вставки в HTML-шаблоны. */
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
