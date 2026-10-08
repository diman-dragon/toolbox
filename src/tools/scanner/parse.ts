export type Kind = 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'geo' | 'contact' | 'otp' | 'product' | 'text';

export interface Parsed {
  kind: Kind;
  title: string;
  /** Поля для показа: подпись → значение */
  fields: Array<[string, string]>;
  /** Ссылка, которую можно открыть по нажатию (только безопасные схемы) */
  href?: string;
  /** Что копировать по умолчанию */
  copy: string;
}

const SAFE = /^(https?|mailto|tel|sms|smsto|geo):/i;

function wifi(text: string): Parsed {
  const body = text.slice(5);
  const f: Record<string, string> = {};
  const re = /([A-Za-z]):((?:\\.|[^;\\])*);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) f[m[1].toUpperCase()] = m[2].replace(/\\(.)/g, '$1');
  const fields: Array<[string, string]> = [['Сеть', f.S ?? '—']];
  if (f.T) fields.push(['Защита', f.T === 'nopass' ? 'нет' : f.T]);
  if (f.P) fields.push(['Пароль', f.P]);
  if (f.H === 'true') fields.push(['Скрытая сеть', 'да']);
  return { kind: 'wifi', title: 'Сеть Wi-Fi', fields, copy: f.P ?? f.S ?? text };
}

function vcard(text: string): Parsed {
  const get = (k: string) => new RegExp(`^${k}[^:\\n]*:(.+)$`, 'im').exec(text)?.[1].trim();
  const fields: Array<[string, string]> = [];
  const name = get('FN');
  if (name) fields.push(['Имя', name]);
  const tel = get('TEL');
  if (tel) fields.push(['Телефон', tel]);
  const mail = get('EMAIL');
  if (mail) fields.push(['Почта', mail]);
  const org = get('ORG');
  if (org) fields.push(['Организация', org]);
  return { kind: 'contact', title: 'Контакт', fields, copy: tel ?? mail ?? text };
}

/** Определяет тип содержимого кода и что с ним можно сделать. Ничего не открывает само. */
export function parseCode(raw: string, format = ''): Parsed {
  const text = raw.trim();
  if (/^WIFI:/i.test(text)) return wifi(text);
  if (/^BEGIN:VCARD/i.test(text)) return vcard(text);
  if (/^otpauth:/i.test(text))
    return {
      kind: 'otp',
      title: 'Ключ двухфакторной защиты',
      fields: [['Внимание', 'Содержит секрет — не показывайте и не пересылайте']],
      copy: text,
    };
  if (/^https?:\/\//i.test(text))
    return { kind: 'url', title: 'Ссылка', fields: [['Адрес', text]], href: text, copy: text };
  if (/^mailto:/i.test(text)) {
    const a = text.slice(7).split('?')[0];
    return { kind: 'email', title: 'Почта', fields: [['Адрес', a]], href: text, copy: a };
  }
  if (/^tel:/i.test(text)) {
    const n = text.slice(4);
    return { kind: 'phone', title: 'Телефон', fields: [['Номер', n]], href: text, copy: n };
  }
  if (/^smsto?:/i.test(text)) {
    const [n, ...rest] = text.replace(/^smsto?:/i, '').split(':');
    const fields: Array<[string, string]> = [['Номер', n]];
    if (rest.length) fields.push(['Текст', rest.join(':')]);
    return { kind: 'sms', title: 'SMS', fields, href: `sms:${n}`, copy: n };
  }
  if (/^geo:/i.test(text))
    return { kind: 'geo', title: 'Место на карте', fields: [['Координаты', text.slice(4)]], href: text, copy: text.slice(4) };
  if (/^\d{8,14}$/.test(text) || /^(EAN|UPC)/i.test(format))
    return { kind: 'product', title: 'Товарный штрихкод', fields: [['Код', text]], copy: text };
  return { kind: 'text', title: 'Текст', fields: [['Содержимое', text]], copy: text };
}

export const isSafeHref = (h: string | undefined): h is string => !!h && SAFE.test(h);

/** Человекочитаемое имя формата. */
export function formatName(f: string): string {
  const map: Record<string, string> = {
    QR_CODE: 'QR',
    qr_code: 'QR',
    EAN_13: 'EAN-13',
    ean_13: 'EAN-13',
    EAN_8: 'EAN-8',
    ean_8: 'EAN-8',
    UPC_A: 'UPC-A',
    upc_a: 'UPC-A',
    UPC_E: 'UPC-E',
    upc_e: 'UPC-E',
    CODE_128: 'Code 128',
    code_128: 'Code 128',
    CODE_39: 'Code 39',
    code_39: 'Code 39',
    CODE_93: 'Code 93',
    code_93: 'Code 93',
    ITF: 'ITF',
    itf: 'ITF',
    CODABAR: 'Codabar',
    codabar: 'Codabar',
    DATA_MATRIX: 'Data Matrix',
    data_matrix: 'Data Matrix',
    PDF_417: 'PDF417',
    pdf417: 'PDF417',
    AZTEC: 'Aztec',
    aztec: 'Aztec',
  };
  return map[f] ?? f;
}
