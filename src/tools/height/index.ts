import { attachCamera, detachCamera, setTorch } from '../../core/camera';
import { loadCalib } from '../../core/calib';
import { getScreenAngle } from '../../core/screen';
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
    `<section class="camsight">
      <video data-id="video" playsinline muted autoplay></video>
      <svg class="cs-overlay" viewBox="-50 -50 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line class="cs-horizon" x1="-50" y1="0" x2="50" y2="0"/>
        <g data-id="rayg">
          <line class="cs-ray" x1="0" y1="0" x2="0" y2="-49.4"/>
          <polygon class="cs-arrow" points="0,-50 -1.6,-47 1.6,-47"/>
        </g>
        <circle class="cs-pivot" r="1.1"/>
      </svg>
      <div class="cs-top">
        <button type="button" class="btn cs-btn" data-id="torch">Вспышка</button>
        <div class="cs-chip"><b data-id="ang">0.0°</b><span>угол к горизонту</span></div>
      </div>
      <div class="cs-read">
        <div class="big" data-id="res">—</div>
        <div class="note" data-id="how">&nbsp;</div>
      </div>
      <div class="cs-panel box">
        <div class="row">
          ${
            isH
              ? `<label>Расстояние до объекта, ${uLabel()}</label>
                 <input class="in" data-id="dist" inputmode="decimal" placeholder="10">`
              : '<span>Основание</span><b data-id="a1">—</b>'
          }
        </div>
        <div class="row" style="margin-top:8px"><label>Высота глаз, ${uLabel()}</label>
          <input class="in" data-id="eye" inputmode="decimal"></div>
        ${isH ? '<div class="row" style="margin-top:8px"><span>Низ (необязательно)</span><b data-id="a2">—</b></div>' : ''}
        <div class="btns" style="margin-top:10px">
          <button type="button" class="btn primary" data-id="m1">${isH ? 'Зафиксировать верх' : 'Замер'}</button>
          ${isH ? '<button type="button" class="btn" data-id="m2">Зафиксировать низ</button>' : ''}
          <button type="button" class="btn" data-id="reset">Сброс</button>
        </div>
      </div>
      <div class="note cs-tip">${
        isH
          ? 'Держите телефон вертикально и смотрите через камеру на объект: зелёная линия — направление нижнего ребра телефона, пунктир — горизонт. Наведите линию на верх объекта и зафиксируйте.'
          : 'Держите телефон вертикально, наведите линию прицела вниз — на точку, где объект стоит на земле, и нажмите «Замер». Расстояние посчитается по высоте глаз и углу.'
      }</div>
    </section>`,
  );

  const video = q<HTMLVideoElement>('video');
  const rayG = root.querySelector<SVGGElement>('[data-id="rayg"]') as SVGGElement;
  const eyeEl = q<HTMLInputElement>('eye');
  const distEl = isH ? q<HTMLInputElement>('dist') : null;
  eyeEl.value = fromM(settings().eyeHeight).toFixed(2);

  let camOk = true;
  await attachCamera(video).catch(() => {
    camOk = false;
    q('how').textContent = 'Нет доступа к камере — расчёт работает по датчику';
    q('torch').setAttribute('disabled', '');
  });
  if (camOk) {
    q('how').textContent = isH
      ? 'Наведите линию прицела на верх объекта'
      : 'Наведите линию прицела на основание объекта';
  }

  let torchOn = false;
  q('torch').addEventListener('click', () => {
    torchOn = !torchOn;
    void setTorch(torchOn).then((ok) => {
      if (!ok && torchOn) {
        torchOn = false;
        toast('Подсветка недоступна');
      }
      q('torch').classList.toggle('on', torchOn);
    });
  });

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
    // Направление нижнего ребра телефона в системе экрана (x вправо, y вниз),
    // спроецированное на картинку камеры (условный вертикальный FOV ~60°).
    const f = 1 / Math.tan(30 * D2R);
    const c = Math.cos(elev * D2R);
    const s = Math.sin(elev * D2R);
    let px: number;
    let py: number;
    switch (getScreenAngle()) {
      case 90:
        px = -c;
        py = -s * f;
        break;
      case 180:
        px = 0;
        py = s * f;
        break;
      case 270:
        px = c;
        py = -s * f;
        break;
      default:
        px = 0;
        py = -s * f;
    }
    const deg = (Math.atan2(px, -py) * R2D + 360) % 360;
    rayG.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
    rayG.style.opacity = Math.hypot(px, py) < 1e-3 ? '0' : '1';
  });

  const eye = () => {
    const e = toM(num(eyeEl));
    return e > 0 ? e : settings().eyeHeight;
  };

  const recompute = () => {
    const res = q('res');
    const how = q('how');
    res.textContent = '—';
    if (a1 === null) {
      if (camOk) {
        how.textContent = isH
          ? 'Наведите линию прицела на верх объекта'
          : 'Наведите линию прицела на основание объекта';
      }
      return;
    }

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
      detachCamera(video);
      root.replaceChildren();
    },
  };
}

export default (root: HTMLElement) => build(root, 'height');
export const createRange = (root: HTMLElement) => build(root, 'range');
