import type { Tool } from '../../core/types';
import { fmtArea, fmtLen, toM, uLabel } from '../../core/units';
import { mount } from '../../ui/dom';

interface Rect {
  l: number;
  w: number;
  sub: boolean;
}

const val = (n: number) => (Number.isFinite(n) ? String(n) : '');

export default function createArea(root: HTMLElement): Tool {
  const rects: Rect[] = [{ l: NaN, w: NaN, sub: false }];

  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="big" data-id="total">—</div>
        <div class="note" data-id="sub">Введите длину и ширину</div></div>
      <div data-id="list" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="add">+ Прямоугольник</button>
        <button type="button" class="btn" data-id="clear">Очистить</button>
      </div>
      <div class="note">Для комнаты сложной формы разбейте её на прямоугольники; выемки (колонны, ниши) добавьте со знаком «−».</div>
    </section>`,
  );
  const list = q('list');

  const total = () => {
    let sum = 0;
    let any = false;
    for (const r of rects) {
      if (Number.isFinite(r.l) && Number.isFinite(r.w)) {
        any = true;
        sum += (r.sub ? -1 : 1) * toM(r.l) * toM(r.w);
      }
    }
    q('total').textContent = any ? fmtArea(Math.max(sum, 0)) : '—';
    const one = rects.length === 1 && any;
    q('sub').textContent = one
      ? `периметр ${fmtLen(2 * (toM(rects[0].l) + toM(rects[0].w)))}`
      : any
        ? `прямоугольников: ${rects.length}`
        : 'Введите длину и ширину';
  };

  const draw = () => {
    list.innerHTML = rects
      .map(
        (r, i) => `<div class="box">
          <div class="row"><b>№ ${i + 1}</b><span style="display:flex;gap:6px">
            <button type="button" class="btn" data-a="sign" data-i="${i}">${r.sub ? '− вычитается' : '+ прибавляется'}</button>
            ${rects.length > 1 ? `<button type="button" class="btn" data-a="del" data-i="${i}">✕</button>` : ''}
          </span></div>
          <div class="row" style="margin-top:10px">
            <input class="in" data-f="l" data-i="${i}" inputmode="decimal" placeholder="Длина, ${uLabel()}" value="${val(r.l)}">
            <span>×</span>
            <input class="in" data-f="w" data-i="${i}" inputmode="decimal" placeholder="Ширина, ${uLabel()}" value="${val(r.w)}">
          </div></div>`,
      )
      .join('');
    total();
  };

  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const f = el.dataset.f as 'l' | 'w' | undefined;
    if (!f) return;
    const v = parseFloat(el.value.replace(',', '.'));
    rects[Number(el.dataset.i)][f] = Number.isFinite(v) && v >= 0 ? v : NaN;
    total();
  });

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.a === 'sign') rects[i].sub = !rects[i].sub;
    else rects.splice(i, 1);
    draw();
  });

  q('add').addEventListener('click', () => {
    rects.push({ l: NaN, w: NaN, sub: false });
    draw();
  });
  q('clear').addEventListener('click', () => {
    rects.length = 0;
    rects.push({ l: NaN, w: NaN, sub: false });
    draw();
  });

  draw();
  return { unmount: () => root.replaceChildren() };
}
