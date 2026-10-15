/** Вставляет разметку и возвращает функцию поиска по data-id. */
export function mount(root: HTMLElement, html: string) {
  root.innerHTML = html;
  return <T extends HTMLElement = HTMLElement>(id: string): T => root.querySelector<T>(`[data-id="${id}"]`) as T;
}

/** Число из поля ввода (запятая допустима) или NaN. */
export function num(el: HTMLInputElement): number {
  const v = parseFloat(el.value.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}
