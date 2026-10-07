import { loadCalib } from '../../core/calib';
import { subscribeGravity } from '../../core/sensors';
import { settings, updateSettings } from '../../core/settings';
import type { Tool, Vec3 } from '../../core/types';
import { fmtLen, fromM, toM, uLabel } from '../../core/units';
import { mount, num } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { applyCalibration } from '../protractor/math';

const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;

type Mode = 'height' | 'range';

const sgn = (a: number) => (a < 0 ? '−' : '+') + Math.abs(a).toFixed(1) + '°';

async function build(root: HTMLElement, mode: Mode): Promise<Tool> {
  const calib = await loadCalib();
  const isH = mode === 'height';

  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="big" data-id="ang">0.0°</div>
        <div class="note">угол верхнего ребра телефона к горизонту</div></div>
      <div class="box">
        ${
          isH
            ? `<div class="row"><label>Расстояние до объекта, ${uLabel()}</label>
               <input class="in" data-id="dist" inputmode="decimal" placeholder="10"></div>`
            : ''
        }
        <div class="row" ${isH ? 'style="margin-top:10px"' : ''}><label>Высота глаз, ${uLabel()}</label>
          <input class="in" data-id="eye" inputmode="decimal"></div>
      </div>
      <div class="box">
        <div class="row"><span>${isH ? 'Верх' : 'Основание'}</span><b data-id="a1">—</b></div>
        ${isH ? '<div class="row"><span>Низ (необязательно)</span><b data-id="a2">—</b></div>' : ''}
        <div class="big good" data-id="res">—</div>
        <div class="note" data-id="how">&nbsp;</div>
      </div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="m1">${isH ? 'Зафиксировать верх' : 'Замер'}</button>
        ${isH ? '<button type="button" class="btn" data-id="m2">Зафиксировать низ</button>' : ''}
        <button type="button" class="btn" data-id="reset">Сброс</button>
      </div>
      <div class="note">${
        isH
          ? 'Встаньте на известном расстоянии, держите телефон на вытянутой руке, наводите по верхнему ребру на верх объекта, затем (по желанию) на его основание. Без «низа» к результату добавляется высота глаз.'
          : 'Наведите верхнее ребро на точку, где объект стоит на земле. Расстояние считается по высоте глаз и углу вниз.'
      }</div>
    </section>`,
  );

  const eyeEl = q<HTMLInputElement>('eye');
  const distEl = isH ? q<HTMLInputElement>('dist') : null;
  eyeEl.value = fromM(settings().eyeHeight).toFixed(2);

  let elev = 0;
  let has = false;
  let a1: number | null = null;
  let a2: number | null = null;

  const unsub = subscribeGravity((g: Vec3) => {
    const v0 = calib.invert ? { x: -g.x, y: -g.y, z: -g.z } : g;
    const v = applyCalibration(v0, calib.ox, calib.oy);
    const n = Math.hypot(v.x, v.y, v.z) || 1;
    elev = Math.asin(Math.max(-1, Math.min(1, v.y / n))) * R2D;
    has = true;
    q('ang').textContent = sgn(elev);
  });

  const eye = () => {
    const e = toM(num(eyeEl));
    return e > 0 ? e : settings().eyeHeight;
  };

  const recompute = () => {
    const res = q('res');
    const how = q('how');
    res.textContent = '—';
    how.textContent = '\u00a0';
    if (a1 === null) return;

    if (isH) {
      const d = toM(num(distEl as HTMLInputElement));
      if (!(d > 0)) {
        how.textContent = 'Введите расстояние до объекта';
        return;
      }
      if (a2 !== null) {
        res.textContent = fmtLen(d * (Math.tan(a1 * D2R) - Math.tan(a2 * D2R)));
        how.textContent = 'по двум углам: верх и низ';
      } else {
        res.textContent = fmtLen(d * Math.tan(a1 * D2R) + eye());
        how.textContent = `верх + высота глаз ${fmtLen(eye())}`;
      }
    } else {
      if (a1 > -1) {
        how.textContent = 'Наведите ниже горизонта — на основание объекта';
        return;
      }
      res.textContent = fmtLen(eye() / Math.tan(-a1 * D2R));
      how.textContent = `до основания, глаза на высоте ${fmtLen(eye())}`;
    }
  };

  const capture = (slot: 1 | 2) => {
    if (!has) {
      toast('Нет данных с датчика');
      return;
    }
    if (slot === 1) {
      a1 = elev;
      q('a1').textContent = sgn(elev);
    } else {
      a2 = elev;
      q('a2').textContent = sgn(elev);
    }
    recompute();
  };

  q('m1').addEventListener('click', () => capture(1));
  if (isH) q('m2').addEventListener('click', () => capture(2));
  q('reset').addEventListener('click', () => {
    a1 = a2 = null;
    q('a1').textContent = '—';
    if (isH) q('a2').textContent = '—';
    recompute();
  });
  distEl?.addEventListener('input', recompute);
  eyeEl.addEventListener('input', () => {
    const e = toM(num(eyeEl));
    if (e >= 0.5 && e <= 2.5) updateSettings({ eyeHeight: e });
    recompute();
  });

  return {
    unmount() {
      unsub();
      root.replaceChildren();
    },
  };
}

export default (root: HTMLElement) => build(root, 'height');
export const createRange = (root: HTMLElement) => build(root, 'range');
