import { scope } from '../../core/actions';
import { t } from '../../core/i18n';
import { settings, updateSettings } from '../../core/settings';
import type { Tool } from '../../core/types';
import { fmtLen, fromM, toM, uLabel } from '../../core/units';
import { num } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { createAimView, type Mark } from './aimview';
import { ANGLE_SIGMA, EYE_SIGMA, distanceBySize, groundDistance, heightFromBaseTop, heightKnownDistance, spread } from './math';

const sgn = (a: number) => (a < 0 ? '−' : '+') + Math.abs(a).toFixed(1) + '°';
const pm = (m: number | null) => (m === null ? '' : Number.isFinite(m) ? ` · ± ${fmtLen(m)}` : ` · ${t('погрешность велика')}`);
const isEye = (e: number) => e >= 0.5 && e <= 2.5;

/* ---------------------------------------------------------------- Высотомер */

async function buildHeight(root: HTMLElement): Promise<Tool> {
  const view = await createAimView(
    root,
    `<div class="row"><label>${t('Высота камеры над землёй, {0}', uLabel())}</label>
       <input class="in" data-id="eye" data-input="h.eye" inputmode="decimal"></div>
     <div class="row"><label>${t('Расстояние до объекта, {0}', uLabel())}</label>
       <input class="in" data-id="dist" data-input="h.dist" inputmode="decimal" placeholder="${t('авто')}"></div>
     <div class="cs-marks"><span data-id="mb"></span><span data-id="mt"></span></div>
     <div class="btns">
       <button type="button" class="btn primary" data-action="h.base">${t('Основание')}</button>
       <button type="button" class="btn primary" data-action="h.top">${t('Верх')}</button>
       <button type="button" class="btn" data-action="h.reset">${t('Сброс')}</button>
     </div>`,
    t('Держите телефон как для фото. Совместите центр прицела с точкой, где объект стоит на земле, и нажмите «Основание»; затем с верхом объекта — «Верх». Расстояние определится само по высоте камеры; если оно известно, введите его вручную.'),
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
    q('mb').innerHTML = `${t('Основание')}: <b>${aBase === null ? '—' : sgn(aBase)}</b>`;
    q('mt').innerHTML = `${t('Верх')}: <b>${aTop === null ? '—' : sgn(aTop)}</b>`;
    const marks: Mark[] = [];
    if (aBase !== null) marks.push({ id: 'b', label: `${t('Осн')} ${sgn(aBase)}`, elev: aBase });
    if (aTop !== null) marks.push({ id: 't', label: `${t('Верх')} ${sgn(aTop)}`, elev: aTop });
    view.setMarks(marks);
  };

  const recompute = () => {
    const res = q('res');
    const how = q('how');
    const d = manualDist();
    res.textContent = '—';

    if (aTop !== null && aBase !== null && aTop <= aBase) {
      how.textContent = t('Верх должен быть выше основания — повторите замер');
      return;
    }

    if (d !== null) {
      if (aTop === null) {
        how.textContent = t('Наведите прицел на верх объекта и нажмите «Верх»');
        return;
      }
      const f = (p: number[]) => heightKnownDistance(p[0], p[1], aBase === null ? null : p[2], p[3]);
      const p = [d, aTop, aBase ?? 0, eye()];
      const h = f(p);
      if (h === null) {
        how.textContent = t('Не удаётся посчитать — проверьте замеры');
        return;
      }
      const sig = spread(f, p, [Math.max(0.05, d * 0.02), ANGLE_SIGMA, aBase === null ? 0 : ANGLE_SIGMA, aBase === null ? EYE_SIGMA : 0]);
      res.textContent = fmtLen(h);
      how.textContent =
        (aBase === null
          ? t('расстояние {0} вручную + высота камеры {1}', fmtLen(d), fmtLen(eye()))
          : t('расстояние {0} вручную, по двум углам', fmtLen(d))) + pm(sig);
      return;
    }

    if (aBase === null) {
      how.textContent = t('Наведите прицел на основание объекта (на землю) и нажмите «Основание»');
      return;
    }
    const dBase = groundDistance(eye(), aBase);
    if (dBase === null) {
      how.textContent = t('Основание должно быть ниже горизонта хотя бы на 0.5° — опустите прицел на землю у объекта');
      return;
    }
    if (aTop === null) {
      how.textContent = t('до основания {0} — теперь наведите на верх и нажмите «Верх»', fmtLen(dBase));
      return;
    }
    const f = (p: number[]) => heightFromBaseTop(p[0], p[1], p[2])?.h ?? null;
    const p = [eye(), aBase, aTop];
    const r = heightFromBaseTop(p[0], p[1], p[2]);
    if (!r) {
      how.textContent = t('Не удаётся посчитать — проверьте замеры');
      return;
    }
    res.textContent = fmtLen(r.h);
    how.textContent = t('расстояние до основания {0}', fmtLen(r.d)) + pm(spread(f, p, [EYE_SIGMA, ANGLE_SIGMA, ANGLE_SIGMA]));
  };

  const take = (slot: 'base' | 'top') => {
    const a = view.capture();
    if (a === null) return;
    if (slot === 'base') aBase = a;
    else aTop = a;
    paintMarks();
    recompute();
  };

  const sc = scope()
    .on('h.base', () => take('base'))
    .on('h.top', () => take('top'))
    .on('h.reset', () => {
      aBase = aTop = null;
      paintMarks();
      recompute();
    })
    .on('h.dist', recompute)
    .on('h.eye', (_el, ev) => {
      const e = toM(num(eyeEl));
      if (isEye(e)) updateSettings({ eyeHeight: e });
      else if (ev.type === 'change') toast(t('Высота камеры от 0.5 до 2.5 м'));
      recompute();
    });

  paintMarks();
  recompute();
  return {
    unmount: () => {
      sc.dispose();
      view.dispose();
    },
  };
}

/* ---------------------------------------------------------------- Дальномер */

type RangeMode = 'ground' | 'size';
const presets = (): Array<[string, number]> => [
  [t('Человек'), 1.75],
  [t('Дверь'), 2.0],
  [t('Легковая'), 1.5],
  [t('Этаж'), 3.0],
];

async function buildRange(root: HTMLElement): Promise<Tool> {
  const view = await createAimView(
    root,
    `<div class="seg" data-id="seg">
       <button type="button" data-action="r.mode" data-m="ground">${t('По земле')}</button>
       <button type="button" data-action="r.mode" data-m="size">${t('По размеру')}</button>
     </div>
     <div data-id="p-ground">
       <div class="row"><label>${t('Высота камеры над землёй, {0}', uLabel())}</label>
         <input class="in" data-id="eye" data-input="r.eye" inputmode="decimal"></div>
       <div class="btns">
         <button type="button" class="btn primary" data-action="r.hold" data-id="hold">${t('Замер')}</button>
         <button type="button" class="btn" data-action="r.rg">${t('Сброс')}</button>
       </div>
     </div>
     <div data-id="p-size" hidden>
       <div class="row"><label>${t('Высота объекта, {0}', uLabel())}</label>
         <input class="in" data-id="hobj" data-input="r.hobj" inputmode="decimal" placeholder="1.75"></div>
       <div class="cs-chips">${presets().map(([n, v]) => `<button type="button" class="btn small" data-action="r.chip" data-v="${v}">${n}</button>`).join('')}</div>
       <div class="cs-marks"><span data-id="mb"></span><span data-id="mt"></span></div>
       <div class="btns">
         <button type="button" class="btn primary" data-action="r.bot">${t('Низ')}</button>
         <button type="button" class="btn primary" data-action="r.top">${t('Верх')}</button>
         <button type="button" class="btn" data-action="r.rs">${t('Сброс')}</button>
       </div>
     </div>`,
    t('По земле: наведите центр прицела на точку, где объект стоит на земле — расстояние считается по высоте камеры и углу вниз. По размеру: подходит для объектов с известной высотой (человек, дверь, машина) — наведите прицел на низ и на верх.'),
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
      q('how').textContent = elev > -0.5 ? t('Опустите прицел ниже горизонта — на землю у основания объекта') : t('Слишком далеко — угол вниз слишком мал для расчёта');
      return;
    }
    const sig = spread((p) => groundDistance(p[0], p[1]), [eye(), elev], [EYE_SIGMA, ANGLE_SIGMA]);
    q('res').textContent = fmtLen(d);
    q('how').textContent = t('до основания, камера на высоте {0}', fmtLen(eye())) + pm(sig);
  };

  const showSize = () => {
    const H = toM(num(hobjEl));
    q('mb').innerHTML = `${t('Низ')}: <b>${aBot === null ? '—' : sgn(aBot)}</b>`;
    q('mt').innerHTML = `${t('Верх')}: <b>${aTop === null ? '—' : sgn(aTop)}</b>`;
    const marks: Mark[] = [];
    if (aBot !== null) marks.push({ id: 'b', label: `${t('Низ')} ${sgn(aBot)}`, elev: aBot });
    if (aTop !== null) marks.push({ id: 't', label: `${t('Верх')} ${sgn(aTop)}`, elev: aTop });
    view.setMarks(marks);

    q('res').textContent = '—';
    if (!(H > 0)) {
      q('how').textContent = t('Введите высоту объекта или выберите образец');
      return;
    }
    if (aBot === null || aTop === null) {
      q('how').textContent = aBot === null ? t('Наведите прицел на низ объекта и нажмите «Низ»') : t('Теперь наведите на верх и нажмите «Верх»');
      return;
    }
    const f = (p: number[]) => distanceBySize(p[0], p[1], p[2]);
    const p = [H, aTop, aBot];
    const d = f(p);
    if (d === null) {
      q('how').textContent = t('Верх должен быть выше низа — повторите замер');
      return;
    }
    q('res').textContent = fmtLen(d);
    q('how').textContent = t('объект высотой {0}', fmtLen(H)) + pm(spread(f, p, [Math.max(0.02, H * 0.02), ANGLE_SIGMA, ANGLE_SIGMA]));
  };

  const unfreeze = () => {
    if (!frozen) return;
    frozen = false;
    heldElev = null;
    view.toggleFreeze();
    q('hold').textContent = t('Замер');
  };

  const setMode = (m: RangeMode) => {
    mode = m;
    unfreeze();
    q('p-ground').hidden = m !== 'ground';
    q('p-size').hidden = m !== 'size';
    for (const b of q('seg').querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.m === m);
    view.setMarks([]);
    if (m === 'size') showSize();
    else q('how').textContent = t('Наведите прицел на основание объекта');
  };

  view.onFrame(() => {
    if (mode !== 'ground' || frozen) return;
    const s = view.sample();
    if (s) showGround(s.mean);
  });

  const take = (slot: 'bot' | 'top') => {
    const a = view.capture();
    if (a === null) return;
    if (slot === 'bot') aBot = a;
    else aTop = a;
    showSize();
  };

  const sc = scope()
    .on('r.mode', (el) => setMode(el.dataset.m as RangeMode))
    .on('r.hold', () => {
      if (frozen) {
        unfreeze();
        return;
      }
      const a = view.capture();
      if (a === null) return;
      frozen = true;
      heldElev = a;
      view.toggleFreeze();
      q('hold').textContent = t('Продолжить');
      showGround(heldElev);
    })
    .on('r.rg', unfreeze)
    .on('r.bot', () => take('bot'))
    .on('r.top', () => take('top'))
    .on('r.rs', () => {
      aBot = aTop = null;
      showSize();
    })
    .on('r.hobj', showSize)
    .on('r.chip', (el) => {
      hobjEl.value = fromM(Number(el.dataset.v)).toFixed(2);
      showSize();
    })
    .on('r.eye', (_el, ev) => {
      const e = toM(num(eyeEl));
      if (isEye(e)) updateSettings({ eyeHeight: e });
      else if (e > 0 && ev.type === 'change') toast(t('Высота камеры от 0.5 до 2.5 м'));
      if (frozen && heldElev !== null) showGround(heldElev);
    });

  setMode('ground');
  return {
    unmount: () => {
      sc.dispose();
      view.dispose();
    },
  };
}

export default (root: HTMLElement) => buildHeight(root);
export const createRange = (root: HTMLElement) => buildRange(root);
