import { scope } from '../core/actions';
import { t } from '../core/i18n';
import { bindSwipe } from '../core/gestures';
import { esc } from '../core/i18n';

/**
 * Окна (контракт 1.3): выезжают снизу, закрываются свайпом вниз, касанием фона и кнопкой «назад».
 * Внутри — заголовок, содержимое, при необходимости одна основная кнопка.
 */
export interface SheetAction {
  label: string;
  run: () => void;
  primary?: boolean;
  danger?: boolean;
  /** Не закрывать окно после нажатия (выбор «на месте» без перерисовки). */
  keep?: boolean;
}

export interface SheetOpts {
  title: string;
  /** Готовая разметка (уже экранированная) */
  html?: string;
  actions?: SheetAction[];
  /** Кнопка «Отмена» внизу (по умолчанию есть) */
  cancel?: boolean;
  onClose?: () => void;
}

export interface SheetHandle {
  el: HTMLElement;
  close(): void;
  /** Подсветить пункт на месте, без перерисовки окна. */
  mark(index: number): void;
}

const stack: SheetHandle[] = [];
let uid = 0;

export function showSheet(o: SheetOpts): SheetHandle {
  const id = `sheet${++uid}`;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', o.title);
  const acts = o.actions ?? [];
  sheet.innerHTML = `<div class="grab"></div><h2>${esc(o.title)}</h2>${o.html ? `<div class="sheet-body">${o.html}</div>` : ''}${acts
    .map((a, i) => `<button type="button" class="btn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}" data-action="${id}.${i}">${esc(a.label)}</button>`)
    .join('')}${o.cancel === false ? '' : `<button type="button" class="btn" data-action="${id}.x">${esc(t('Отмена'))}</button>`}`;
  back.append(sheet);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('open'));

  const sc = scope();
  let closed = false;
  const handle: SheetHandle = {
    el: sheet,
    close() {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      unbind();
      sc.dispose();
      back.classList.remove('open');
      window.setTimeout(() => back.remove(), 180);
      o.onClose?.();
    },
    mark(index) {
      sheet.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => b.classList.toggle('on', b.dataset.action === `${id}.${index}`));
    },
  };
  acts.forEach((a, i) =>
    sc.on(`${id}.${i}`, () => {
      if (!a.keep) handle.close();
      a.run();
    }),
  );
  sc.on(`${id}.x`, () => handle.close());

  back.addEventListener('click', (e) => {
    if (e.target === back) handle.close();
  });
  // свайп вниз: окно едет за пальцем, при отпускании без броска возвращается
  const unbind = bindSwipe(sheet, {
    axes: 'y',
    onDrag: (axis, _dx, dy) => {
      if (axis === 'y') sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    },
    onSwipe: (dir) => {
      if (dir === 'down') handle.close();
      else sheet.style.transform = '';
    },
    onRelease: () => {
      sheet.style.transform = '';
    },
  });
  stack.push(handle);
  return handle;
}

/** Закрывает верхнее окно; true — окно было (кнопка «назад» на этом заканчивает обработку). */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export const hasSheet = (): boolean => stack.length > 0;

/** Подтверждение: опасное действие — всегда через подтверждение (контракт 1.4). */
export function confirmSheet(o: { title: string; text: string; confirm: string; danger?: boolean; onConfirm: () => void }): SheetHandle {
  return showSheet({
    title: o.title,
    html: `<p class="sheet-text">${esc(o.text)}</p>`,
    actions: [{ label: o.confirm, danger: o.danger, primary: !o.danger, run: o.onConfirm }],
  });
}

/** Простое меню действий. */
export function menuSheet(title: string, actions: SheetAction[]): SheetHandle {
  return showSheet({ title, actions });
}
