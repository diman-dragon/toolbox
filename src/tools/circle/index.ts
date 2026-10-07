import type { Tool } from '../../core/types';
import { fmtArea, toM, uLabel } from '../../core/units';
import { mount } from '../../ui/dom';

type Field = 'd' | 'r' | 'c';

export default function createCircle(root: HTMLElement): Tool {
  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="big" data-id="area">—</div>
        <div class="note">площадь круга</div></div>
      <div class="box">
        <div class="row"><label>Диаметр, ${uLabel()}</label><input class="in" data-f="d" inputmode="decimal"></div>
        <div class="row" style="margin-top:10px"><label>Радиус, ${uLabel()}</label><input class="in" data-f="r" inputmode="decimal"></div>
        <div class="row" style="margin-top:10px"><label>Обхват, ${uLabel()}</label><input class="in" data-f="c" inputmode="decimal"></div>
      </div>
      <div class="btns"><button type="button" class="btn" data-id="clear">Очистить</button></div>
      <div class="note">Введите любую величину — остальные пересчитаются. Для ствола дерева, трубы или колонны удобно измерить обхват рулеткой или шнуром и узнать диаметр.</div>
    </section>`,
  );

  const inputs = {
    d: root.querySelector<HTMLInputElement>('[data-f="d"]') as HTMLInputElement,
    r: root.querySelector<HTMLInputElement>('[data-f="r"]') as HTMLInputElement,
    c: root.querySelector<HTMLInputElement>('[data-f="c"]') as HTMLInputElement,
  };
  const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

  const onInput = (from: Field) => {
    const v = parseFloat(inputs[from].value.replace(',', '.'));
    if (!(v >= 0)) {
      for (const k of ['d', 'r', 'c'] as Field[]) if (k !== from) inputs[k].value = '';
      q('area').textContent = '—';
      return;
    }
    const d = from === 'd' ? v : from === 'r' ? v * 2 : v / Math.PI;
    if (from !== 'd') inputs.d.value = fmt(d);
    if (from !== 'r') inputs.r.value = fmt(d / 2);
    if (from !== 'c') inputs.c.value = fmt(d * Math.PI);
    q('area').textContent = fmtArea(Math.PI * (toM(d) / 2) ** 2);
  };

  for (const k of ['d', 'r', 'c'] as Field[]) inputs[k].addEventListener('input', () => onInput(k));
  q('clear').addEventListener('click', () => {
    for (const k of ['d', 'r', 'c'] as Field[]) inputs[k].value = '';
    q('area').textContent = '—';
  });

  return { unmount: () => root.replaceChildren() };
}
