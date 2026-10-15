/**
 * Единый делегированный обработчик нажатий (контракт 1.4). У кнопки атрибут data-action="область.действие",
 * обработчики регистрируются в области видимости (scope) экрана или окна. Перерисовка разметки их не ломает:
 * слушатель один, на document. Также: data-hold (долгое нажатие), data-input (input/change).
 */
export type ActionHandler = (el: HTMLElement, ev: Event) => void;

export interface Scope {
  on(name: string, h: ActionHandler): Scope;
  dispose(): void;
}

const scopes: Array<Map<string, ActionHandler>> = [];
const HOLD_MS = 450;
const HOLD_SLOP = 10;

export function scope(): Scope {
  const handlers = new Map<string, ActionHandler>();
  scopes.push(handlers);
  const api: Scope = {
    on(name, h) {
      handlers.set(name, h);
      return api;
    },
    dispose() {
      const i = scopes.indexOf(handlers);
      if (i >= 0) scopes.splice(i, 1);
      handlers.clear();
    },
  };
  return api;
}

/** Вызвать действие по имени (побеждает последняя зарегистрированная область). */
export function dispatch(name: string, el: HTMLElement, ev: Event): boolean {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const h = scopes[i].get(name);
    if (h) {
      h(el, ev);
      return true;
    }
  }
  return false;
}

const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';

let ready = false;

export function initActions(doc: Document = document): void {
  if (ready) return;
  ready = true;
  let suppress: HTMLElement | null = null;
  let holdTimer = 0;
  let holdEl: HTMLElement | null = null;
  let sx = 0;
  let sy = 0;
  const cancelHold = () => {
    window.clearTimeout(holdTimer);
    holdEl = null;
  };

  doc.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest<HTMLElement>('[data-action]');
    if (!el || isDisabled(el)) return;
    if (suppress && suppress === el) {
      suppress = null;
      ev.preventDefault();
      return;
    }
    suppress = null;
    dispatch(el.dataset.action as string, el, ev);
  });
  for (const type of ['input', 'change'] as const) {
    doc.addEventListener(type, (ev) => {
      const el = (ev.target as Element | null)?.closest<HTMLElement>(`[data-${type}]`);
      if (el) dispatch(el.dataset[type] as string, el, ev);
    });
  }
  doc.addEventListener('pointerdown', (ev) => {
    cancelHold();
    const el = (ev.target as Element | null)?.closest<HTMLElement>('[data-hold]');
    if (!el || isDisabled(el)) return;
    holdEl = el;
    sx = ev.clientX;
    sy = ev.clientY;
    holdTimer = window.setTimeout(() => {
      if (!holdEl) return;
      suppress = holdEl;
      dispatch(holdEl.dataset.hold as string, holdEl, ev);
      holdEl = null;
    }, HOLD_MS);
  });
  doc.addEventListener('pointermove', (ev) => {
    if (holdEl && Math.hypot(ev.clientX - sx, ev.clientY - sy) > HOLD_SLOP) cancelHold();
  });
  for (const t of ['pointerup', 'pointercancel'] as const) doc.addEventListener(t, cancelHold);
  doc.addEventListener('contextmenu', (ev) => {
    if ((ev.target as Element | null)?.closest('[data-hold]')) ev.preventDefault();
  });
}
