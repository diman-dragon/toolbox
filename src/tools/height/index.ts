import { settings, updateSettings } from '../../core/settings';
import type { Tool } from '../../core/types';
import { fmtLen, fromM, toM, uLabel } from '../../core/units';
import { num } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { createAimView, type Mark } from './aimview';
import {
  ANGLE_SIGMA,
  EYE_SIGMA,
  distanceBySize,
  groundDistance,
  heightFromBaseTop,
  heightKnownDistance,
  spread,
} from './math';

const sgn = (a: number) => (a < 0 ? '−' : '+') + Math.abs(a).toFixed(1) + '°';
const pm = (m: number | null) =>
  m === null ? '' : Number.isFinite(m) ? ` · ± ${fmtLen(m)}` : ' · погрешность велика';

/* ---------------------------------------------------------------- Высотомер */

async function buildHeight(root: HTMLElement): Promise<Tool> {
  const view = await createAimView(
    root,
    `<div class="row"><label>Высота камеры над землёй, ${uLabel()}</label>
       <input class="in" data-id="eye" inputmode="decimal"></div>
     <div class="row"><label>Расстояние до объекта, ${uLabel()}</label>
       <input class="in" data-id="dist" inputmode="decimal" placeholder="авто"></div>
     <div class="cs-marks"><span data-id="mb">Основание: <b>—</b></span><span data-id="mt">Верх: <b>—</b></span></div>
     <div class="btns">
       <button type="button" class="btn primary" data-id="base">Основание</button>
       <button type="button" class="btn primary" data-id="top">Верх</button>
       <button type="button" class="btn" data-id="reset">Сброс</button>
     </div>`,
    'Держите телефон как для фото. Совместите центр прицела с точкой, где объект стоит на земле, и нажмите «Основание»; затем с верхом объекта — «Верх». Расстояние определится само по высоте камеры; если оно известно, введите его вручную.',
  );
  const { q } = view;
  const eyeEl = q<HTMLInputElement>('eye');
  const distEl = q<HTMLInputElement>('dist');
  eyeEl.value = fromM(settings().eyeHeight).toFixed(2);

  let aBase: number | null = null;
  let aTop: number | null = null;

  const eye = () => {
    const e = toM(num(eyeEl));
    return e > 0 ? e : settings().eyeHeight;
  };
  const manualDist = (): number | null => {
    const d = toM(num(distEl));
    return d > 0 ? d : null;
  };

  const paintMarks = () => {
    q('mb').innerHTML = `Основание: <b>${aBase === null ? '—' : sgn(aBase)}</b>`;
    q('mt').innerHTML = `Верх: <b>${aTop === null ? '—' : sgn(aTop)}</b>`;
    const marks: Mark[] = [];
    if (aBase !== null) marks.push({ id: 'b', label: `Осн ${sgn(aBase)}`, elev: aBase });
    if (aTop !== null) marks.push({ id: 't', label: `Верх ${sgn(aTop)}`, elev: aTop });
    view.setMarks(marks);
  };

  const recompute = () => {
    const res = q('res');
    const how = q('how');
    const d = manualDist();
    res.textContent = '—';

    if (aTop !== null && aBase !== null && aTop <= aBase) {
      how.textContent = 'Верх должен быть выше основания — повторите замер';
      return;
    }

    if (d !== null) {
      // расстояние введено вручную
      if (aTop === null) {
        how.textContent = 'Наведите прицел на верх объекта и нажмите «Верх»';
        return;
      }
      const f = (p: number[]) =>
        heightKnownDistance(p[0], p[1], aBase === null ? null : p[2], p[3]);
      const p = [d, aTop, aBase ?? 0, eye()];
      const h = f(p);
      if (h === null) {
        how.textContent = 'Не удаётся посчитать — проверьте замеры';
        return;
      }
      const sig = spread(f, p, [Math.max(0.05, d * 0.02), ANGLE_SIGMA, aBase === null ? 0 : ANGLE_SIGMA, aBase === null ? EYE_SIGMA : 0]);
      res.textContent = fmtLen(h);
      how.textContent =
        (aBase === null
          ? `расстояние ${fmtLen(d)} вручную + высота камеры ${fmtLen(eye())}`
          : `расстояние ${fmtLen(d)} вручную, по двум углам`) + pm(sig);
      return;
    }

    // расстояние определяется по основанию
    if (aBase === null) {
      how.textContent = 'Наведите прицел на основание объекта (на землю) и нажмите «Основание»';
      return;
    }
    if (groundDistance(eye(), aBase) === null) {
      how.textContent = 'Основание должно быть ниже горизонта хотя бы на 0.5° — опустите прицел на землю у объекта';
      return;
    }
    if (aTop === null) {
      how.textContent = `до основания ${fmtLen(groundDistance(eye(), aBase) as number)} — теперь наведите на верх и нажмите «Верх»`;
      return;
    }
    const f = (p: number[]) => heightFromBaseTop(p[0], p[1], p[2])?.h ?? null;
    const p = [eye(), aBase, aTop];
    const r = heightFromBaseTop(p[0], p[1], p[2]);
    if (!r) {
      how.textContent = 'Не удаётся посчитать — проверьте замеры';
      return;
    }
    res.textContent = fmtLen(r.h);
    how.textContent = `расстояние до основания ${fmtLen(r.d)}` + pm(spread(f, p, [EYE_SIGMA, ANGLE_SIGMA, ANGLE_SIGMA]));
  };

  const take = (slot: 'base' | 'top') => {
    const a = view.capture();
    if (a === null) return;
    if (slot === 'base') aBase = a;
    else aTop = a;
    paintMarks();
    recompute();
  };

  q('base').addEventListener('click', () => take('base'));
  q('top').addEventListener('click', () => take('top'));
  q('reset').addEventListener('click', () => {
    aBase = aTop = null;
    paintMarks();
    recompute();
  });
  distEl.addEventListener('input', recompute);
  eyeEl.addEventListener('input', () => {
    const e = toM(num(eyeEl));
    if (e >= 0.5 && e <= 2.5) updateSettings({ eyeHeight: e });
    recompute();
  });

  paintMarks();
  recompute();
  return { unmount: () => view.dispose() };
}

/* ---------------------------------------------------------------- Дальномер */

type RangeMode = 'ground' | 'size';
const PRESETS: Array<[string, number]> = [
  ['Человек', 1.75],
  ['Дверь', 2.0],
  ['Легковая', 1.5],
  ['Этаж', 3.0],
];

async function buildRange(root: HTMLElement): Promise<Tool> {
  const view = await createAimView(
    root,
    `<div class="seg" data-id="seg">
       <button type="button" data-m="ground">По земле</button>
       <button type="button" data-m="size">По размеру</button>
     </div>
     <div data-id="p-ground">
       <div class="row"><label>Высота камеры над землёй, ${uLabel()}</label>
         <input class="in" data-id="eye" inputmode="decimal"></div>
       <div class="btns">
         <button type="button" class="btn primary" data-id="hold">Замер</button>
         <button type="button" class="btn" data-id="rg">Сброс</button>
       </div>
     </div>
     <div data-id="p-size" hidden>
       <div class="row"><label>Высота объекта, ${uLabel()}</label>
         <input class="in" data-id="hobj" inputmode="decimal" placeholder="1.75"></div>
       <div class="cs-chips" data-id="chips">${PRESETS.map(([n, v]) => `<button type="button" class="btn small" data-v="${v}">${n}</button>`).join('')}</div>
       <div class="cs-marks"><span data-id="mb">Низ: <b>—</b></span><span data-id="mt">Верх: <b>—</b></span></div>
       <div class="btns">
         <button type="button" class="btn primary" data-id="bot">Низ</button>
         <button type="button" class="btn primary" data-id="top">Верх</button>
         <button type="button" class="btn" data-id="rs">Сброс</button>
       </div>
     </div>`,
    'По земле: наведите центр прицела на точку, где объект стоит на земле — расстояние считается по высоте камеры и углу вниз. По размеру: подходит для объектов с известной высотой (человек, дверь, машина) — наведите прицел на низ и на верх.',
  );
  const { q } = view;
  const eyeEl = q<HTMLInputElement>('eye');
  const hobjEl = q<HTMLInputElement>('hobj');
  eyeEl.value = fromM(settings().eyeHeight).toFixed(2);

  let mode: RangeMode = 'ground';
  let frozen = false;
  let heldElev: number | null = null;
  let aBot: number | null = null;
  let aTop: number | null = null;

  const eye = () => {
    const e = toM(num(eyeEl));
    return e > 0 ? e : settings().eyeHeight;
  };

  const showGround = (elev: number) => {
    const d = groundDistance(eye(), elev);
    if (d === null) {
      q('res').textContent = '—';
      q('how').textContent =
        elev > -0.5
          ? 'Опустите прицел ниже горизонта — на землю у основания объекта'
          : 'Слишком далеко — угол вниз слишком мал для расчёта';
      return;
    }
    const sig = spread((p) => groundDistance(p[0], p[1]), [eye(), elev], [EYE_SIGMA, ANGLE_SIGMA]);
    q('res').textContent = fmtLen(d);
    q('how').textContent = `до основания, камера на высоте ${fmtLen(eye())}` + pm(sig);
  };

  const showSize = () => {
    const H = toM(num(hobjEl));
    q('mb').innerHTML = `Низ: <b>${aBot === null ? '—' : sgn(aBot)}</b>`;
    q('mt').innerHTML = `Верх: <b>${aTop === null ? '—' : sgn(aTop)}</b>`;
    const marks: Mark[] = [];
    if (aBot !== null) marks.push({ id: 'b', label: `Низ ${sgn(aBot)}`, elev: aBot });
    if (aTop !== null) marks.push({ id: 't', label: `Верх ${sgn(aTop)}`, elev: aTop });
    view.setMarks(marks);

    q('res').textContent = '—';
    if (!(H > 0)) {
      q('how').textContent = 'Введите высоту объекта или выберите образец';
      return;
    }
    if (aBot === null || aTop === null) {
      q('how').textContent = aBot === null ? 'Наведите прицел на низ объекта и нажмите «Низ»' : 'Теперь наведите на верх и нажмите «Верх»';
      return;
    }
    const f = (p: number[]) => distanceBySize(p[0], p[1], p[2]);
    const p = [H, aTop, aBot];
    const d = f(p);
    if (d === null) {
      q('how').textContent = 'Верх должен быть выше низа — повторите замер';
      return;
    }
    q('res').textContent = fmtLen(d);
    q('how').textContent = `объект высотой ${fmtLen(H)}` + pm(spread(f, p, [Math.max(0.02, H * 0.02), ANGLE_SIGMA, ANGLE_SIGMA]));
  };

  const setMode = (m: RangeMode) => {
    mode = m;
    if (frozen) {
      view.toggleFreeze();
      frozen = false;
      q('hold').textContent = 'Замер';
    }
    q('p-ground').hidden = m !== 'ground';
    q('p-size').hidden = m !== 'size';
    for (const b of q('seg').querySelectorAll<HTMLElement>('button'))
      b.classList.toggle('on', b.dataset.m === m);
    view.setMarks([]);
    if (m === 'size') showSize();
    else q('how').textContent = 'Наведите прицел на основание объекта';
  };

  view.onFrame(() => {
    if (mode !== 'ground' || frozen) return;
    const s = view.sample();
    if (s) showGround(s.mean);
  });

  q('seg').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) setMode(b.dataset.m as RangeMode);
  });

  q('hold').addEventListener('click', () => {
    if (frozen) {
      frozen = false;
      heldElev = null;
      view.toggleFreeze();
      q('hold').textContent = 'Замер';
      return;
    }
    const a = view.capture();
    if (a === null) return;
    frozen = true;
    heldElev = a;
    view.toggleFreeze();
    q('hold').textContent = 'Продолжить';
    showGround(heldElev);
  });
  q('rg').addEventListener('click', () => {
    if (frozen) {
      frozen = false;
      view.toggleFreeze();
      q('hold').textContent = 'Замер';
    }
  });

  const take = (slot: 'bot' | 'top') => {
    const a = view.capture();
    if (a === null) return;
    if (slot === 'bot') aBot = a;
    else aTop = a;
    showSize();
  };
  q('bot').addEventListener('click', () => take('bot'));
  q('top').addEventListener('click', () => take('top'));
  q('rs').addEventListener('click', () => {
    aBot = aTop = null;
    showSize();
  });
  hobjEl.addEventListener('input', showSize);
  q('chips').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    hobjEl.value = fromM(Number(b.dataset.v)).toFixed(2);
    showSize();
  });
  eyeEl.addEventListener('input', () => {
    const e = toM(num(eyeEl));
    if (e >= 0.5 && e <= 2.5) updateSettings({ eyeHeight: e });
    else if (e > 0) toast('Высота камеры от 0.5 до 2.5 м');
    if (frozen && heldElev !== null) showGround(heldElev);
  });

  setMode('ground');
  return { unmount: () => view.dispose() };
}

export default (root: HTMLElement) => buildHeight(root);
export const createRange = (root: HTMLElement) => buildRange(root);
