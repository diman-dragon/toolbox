import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { scope } from '../core/actions';
import { resetAim } from '../core/aim';
import { resetCalib } from '../core/calib';
import { esc, t, T, type LangPref } from '../core/i18n';
import { isPaid, onPremium } from '../core/premium';
import { DEFAULT_SETTINGS, replaceSettings, settings, updateSettings, type Density, type LenUnit, type Theme } from '../core/settings';
import { replaceFavorites, favorites } from '../core/favorites';
import { loadJSON, saveJSON } from '../core/storage';
import { fromM, toM, uLabel } from '../core/units';
import { openAppSettings } from '../core/system';
import { brandMark, brandTitle } from './brand';
import { num } from './dom';
import { openDoc } from './docs';
import { statusLine, codeSheet } from './support';
import { confirmSheet, showSheet } from './sheet';
import { toast } from './toast';
import privacy from '../../store/PRIVACY_POLICY.md?raw';
import terms from '../../store/TERMS.md?raw';
import licenses from '../../store/LICENSES.md?raw';
import site from '../../store/site.json';

export const APP_NAME = T('Мультитул');

/** Что входит в резервную копию: настройки, калибровки, избранное. Покупки и история сканера — нет. */
export const BACKUP_KEYS = ['level.settings', 'aim.calib', 'protractor.settings', 'metal.settings', 'ruler.settings', 'sound.settings'] as const;

async function versionText(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const i = await App.getInfo();
      return `${i.version} (${t('сборка')} ${i.build})`;
    } catch {
      /* ниже — версия из package.json */
    }
  }
  return __APP_VERSION__;
}

export async function makeBackup(): Promise<string> {
  const data: Record<string, unknown> = { app: 'datalaw-multitool', version: 1, settings: settings(), favorites: favorites() };
  for (const k of BACKUP_KEYS) data[k] = await loadJSON<unknown>(k, null);
  return JSON.stringify(data);
}

export async function restoreBackup(text: string): Promise<boolean> {
  try {
    const d = JSON.parse(text) as Record<string, unknown>;
    if (d.app !== 'datalaw-multitool' || typeof d.settings !== 'object') return false;
    replaceSettings({ ...DEFAULT_SETTINGS, ...(d.settings as object) });
    if (Array.isArray(d.favorites)) replaceFavorites(d.favorites.filter((x): x is string => typeof x === 'string'));
    for (const k of BACKUP_KEYS) if (d[k] != null) await saveJSON(k, d[k]);
    return true;
  } catch {
    return false;
  }
}

const LANG_RU = 'Русский'; // i18n-ok: название языка пишется на нём самом
const seg = (key: string, items: Array<[string, string]>) =>
  `<div class="seg" data-g="${key}">${items.map(([v, label]) => `<button type="button" data-action="set.pick" data-key="${key}" data-v="${v}">${esc(label)}</button>`).join('')}</div>`;

/** Порядок групп — как в контракте 1.5; приложение добавляет своё только в группу «Работа». */
export function renderSettings(root: HTMLElement, goSupport: () => void): () => void {
  const s = settings();
  root.innerHTML = `<section class="pane">
    <div class="box"><div class="set-title">${esc(t('Внешний вид'))}</div>
      <div class="lbl">${esc(t('Тема'))}</div>
      ${seg('theme', [['classic', t('Тёмная')], ['amoled', 'AMOLED'], ['paper', t('Бумага')]])}
      <div class="lbl">${esc(t('Язык'))}</div>
      ${seg('lang', [['system', t('Системный')], ['ru', LANG_RU], ['en', 'English']])}
      <div class="lbl">${esc(t('Плотность'))}</div>
      ${seg('density', [['normal', t('Обычная')], ['compact', t('Компактная')]])}
    </div>

    <div class="box"><div class="set-title">${esc(t('Поддержка и Premium'))}</div>
      <p class="status" data-id="status">${esc(statusLine())}</p>
      <div class="btns">
        <button type="button" class="btn" data-action="set.support">${esc(isPaid() ? t('Поддержать') : t('Premium и поддержка'))}</button>
        ${isPaid() ? '' : `<button type="button" class="btn" data-action="set.code">${esc(t('Ввести код'))}</button>`}
      </div>
    </div>

    <div class="box"><div class="set-title">${esc(t('Работа'))}</div>
      <div class="lbl">${esc(t('Единицы длины'))}</div>
      ${seg('lenUnit', [['m', t('Метры')], ['ft', t('Футы')]])}
      <div class="row"><label>${esc(t('Высота камеры над землёй, {0}', uLabel()))}</label>
        <input class="in" data-input="set.eye" data-id="eye" inputmode="decimal" value="${fromM(s.eyeHeight).toFixed(2)}"></div>
      <div class="row"><label>${esc(t('Вибро-отклик'))}</label>
        <button type="button" class="btn" data-action="set.haptics" data-id="hap"></button></div>
      <div class="btns">
        <button type="button" class="btn" data-action="set.rc">${esc(t('Сбросить калибровку уровня'))}</button>
        <button type="button" class="btn" data-action="set.ra">${esc(t('Сбросить калибровку горизонта камеры'))}</button>
      </div>
    </div>

    <div class="box"><div class="set-title">${esc(t('Данные и доступ'))}</div>
      <p class="note left">${esc(t('Камера нужна высотомеру, дальномеру, отвесу и сканеру, микрофон — шумомеру. Разрешения выдаются в настройках Android.'))}</p>
      <div class="btns">
        <button type="button" class="btn" data-action="set.perm">${esc(t('Разрешения'))}</button>
        <button type="button" class="btn" data-action="set.bk">${esc(t('Копировать резервную копию'))}</button>
        <button type="button" class="btn" data-action="set.rs">${esc(t('Восстановить из копии'))}</button>
      </div>
    </div>

    <div class="box"><div class="set-title">${esc(t('Конфиденциальность и документы'))}</div>
      <div class="btns">
        <button type="button" class="btn" data-action="set.doc" data-doc="privacy">${esc(t('Политика конфиденциальности'))}</button>
        <button type="button" class="btn" data-action="set.doc" data-doc="terms">${esc(t('Условия использования'))}</button>
        <button type="button" class="btn" data-action="set.doc" data-doc="licenses">${esc(t('Лицензии компонентов'))}</button>
      </div>
    </div>

    <div class="box about"><div class="about-logo">${brandMark()}</div>
      <div class="about-name">${esc(brandTitle(t(APP_NAME)))}</div>
      <div class="ver"><span>${esc(t('Версия'))}</span><span data-id="ver">…</span></div>
      <div class="ver"><span>${esc(t('Контакт'))}</span><span>${esc(site.email)}</span></div>
      ${site.url ? `<div class="ver"><span>${esc(t('Сайт'))}</span><span>${esc(site.url)}</span></div>` : ''}
      <div class="about-c">© 2026 DataLaw Design</div>
    </div>
  </section>`;

  const q = <T extends HTMLElement = HTMLElement>(id: string): T => root.querySelector<T>(`[data-id="${id}"]`) as T;
  void versionText().then((v) => {
    const el = root.querySelector('[data-id="ver"]');
    if (el) el.textContent = v;
  });

  /** Подсветка выбранных пунктов на месте, без перерисовки (прокрутка и фокус не теряются). */
  const mark = () => {
    const cur = settings() as unknown as Record<string, string>;
    for (const g of root.querySelectorAll<HTMLElement>('[data-g]'))
      for (const b of g.querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.v === String(cur[g.dataset.g as string]));
    q('hap').textContent = settings().haptics ? t('Вкл') : t('Выкл');
    q('hap').classList.toggle('on', settings().haptics);
  };

  const redraw = () => {
    const top = root.scrollTop;
    const off = renderSettings(root, goSupport);
    cleanup = off;
    root.scrollTop = top;
  };
  let cleanup: (() => void) | null = null;

  const sc = scope()
    .on('set.pick', (el) => {
      const key = el.dataset.key as string;
      const v = el.dataset.v as string;
      if (key === 'theme') updateSettings({ theme: v as Theme });
      else if (key === 'density') updateSettings({ density: v as Density });
      else if (key === 'lang') updateSettings({ lang: v as LangPref }); // каркас перерисует экран на новом языке
      else if (key === 'lenUnit') {
        updateSettings({ lenUnit: v as LenUnit });
        sc.dispose();
        redraw();
        return;
      }
      mark();
    })
    .on('set.support', goSupport)
    .on('set.code', () => codeSheet(() => { sc.dispose(); redraw(); }))
    .on('set.eye', (el, ev) => {
      if (ev.type !== 'change') return;
      const input = el as HTMLInputElement;
      const v = toM(num(input));
      if (v >= 0.5 && v <= 2.5) updateSettings({ eyeHeight: v });
      else toast(t('Высота камеры от 0.5 до 2.5 м'));
      input.value = fromM(settings().eyeHeight).toFixed(2);
    })
    .on('set.haptics', () => {
      updateSettings({ haptics: !settings().haptics });
      mark();
    })
    .on('set.rc', () =>
      confirmSheet({ title: t('Сбросить калибровку уровня?'), text: t('Смещение нуля вернётся к заводскому. Калибровку можно повторить в любой момент.'), confirm: t('Сбросить'), danger: true, onConfirm: () => void resetCalib().then(() => toast(t('Калибровка сброшена'))) }),
    )
    .on('set.ra', () =>
      confirmSheet({ title: t('Сбросить калибровку горизонта камеры?'), text: t('Поправку нуля камеры можно измерить заново в высотомере или дальномере.'), confirm: t('Сбросить'), danger: true, onConfirm: () => void resetAim().then(() => toast(t('Калибровка сброшена'))) }),
    )
    .on('set.perm', () => void openAppSettings().then((ok) => !ok && toast(t('Откройте: Настройки Android → Приложения → Мультитул → Разрешения'))))
    .on('set.bk', () =>
      void makeBackup().then((txt) =>
        navigator.clipboard?.writeText(txt).then(() => toast(t('Копия в буфере обмена. Сохраните её в заметки'))).catch(() => toast(t('Не удалось скопировать'))),
      ),
    )
    .on('set.rs', () =>
      showSheet({
        title: t('Восстановить из копии'),
        html: `<p class="sheet-text">${esc(t('Вставьте текст копии. Текущие настройки будут заменены.'))}</p><textarea class="in wide area" data-id="bk" spellcheck="false"></textarea>`,
        actions: [
          {
            label: t('Восстановить'),
            primary: true,
            keep: true,
            run: () => {
              const sheetEl = document.querySelector('.sheet [data-id="bk"]') as HTMLTextAreaElement | null;
              void restoreBackup(sheetEl?.value ?? '').then((ok) => {
                toast(ok ? t('Настройки восстановлены') : t('Это не похоже на копию Мультитула'));
                if (ok) {
                  document.querySelector<HTMLElement>('.sheet-back')?.click();
                  sc.dispose();
                  redraw();
                }
              });
            },
          },
        ],
      }),
    )
    .on('set.doc', (el) => {
      const d = el.dataset.doc;
      if (d === 'privacy') openDoc(t('Политика конфиденциальности'), privacy);
      else if (d === 'terms') openDoc(t('Условия использования'), terms);
      else openDoc(t('Лицензии компонентов'), licenses);
    });

  const offPrem = onPremium(() => {
    const el = root.querySelector('[data-id="status"]');
    if (el) el.textContent = statusLine();
  });
  mark();
  cleanup = () => undefined;
  return () => {
    offPrem();
    sc.dispose();
    cleanup?.();
  };
}
