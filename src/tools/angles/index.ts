import { loadCalib } from '../../core/calib';
import { tick } from '../../core/haptics';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import type { Tool, Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { deviceTilts } from '../level/math';
import { applyCalibration, inPlaneAngle, normalize180 } from '../protractor/math';
import '../level/level.css';

const TARGETS = [15, 30, 45, 60, 90];
/** Допуск совпадения, градусы */
const TOL = 0.5;
const FLAT_LIMIT = 0.9;
const D2R = Math.PI / 180;

export default async function createAngles(root: HTMLElement): Promise<Tool> {
  const calib = await loadCalib();
  let target = 45;
  let ref = 0;

  const q = mount(
    root,
    `<section class="level tpl">
      <div class="seg" data-id="chips">${TARGETS.map((t) => `<button type="button" data-t="${t}">${t}°</button>`).join('')}</div>
      <div class="readout">
        <div class="value" data-id="value">—</div>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <svg viewBox="0 0 220 140" aria-hidden="true">
          <line class="ground" x1="20" y1="120" x2="205" y2="120"/>
          <line class="tray" data-id="tray" x1="20" y1="120" x2="20" y2="120"/>
          <line class="lray" data-id="lray" x1="20" y1="120" x2="20" y2="120"/>
          <circle cx="20" cy="120" r="4" class="lhub"/>
        </svg>
      </div>
      <div class="tip">Телефон стоит вертикально. Приложите ребро к основанию (ноль), затем к детали — когда угол совпадёт с шаблоном, экран позеленеет.</div>
      <div class="controls">
        <button type="button" data-id="zero" class="primary">Ноль</button>
        <button type="button" data-id="rzero">Сброс нуля</button>
      </div>
    </section>`,
  );

  const section = root.querySelector<HTMLElement>('.tpl') as HTMLElement;
  const tray = q<HTMLElement>('tray');
  const lray = q<HTMLElement>('lray');
  const chips = q('chips');

  const setRay = (el: Element, deg: number) => {
    const len = Math.min(170, 105 / Math.max(Math.sin(deg * D2R), 0.01));
    el.setAttribute('x2', (20 + len * Math.cos(deg * D2R)).toFixed(2));
    el.setAttribute('y2', (120 - len * Math.sin(deg * D2R)).toFixed(2));
  };
  const drawTarget = () => {
    setRay(tray, target);
    for (const b of chips.querySelectorAll<HTMLElement>('button'))
      b.classList.toggle('on', Number(b.dataset.t) === target);
  };

  let g: Vec3 | null = null;
  let beta = 0;
  let standing = false;
  let was = false;
  let raf = 0;
  const unsub = subscribeGravity((v) => (g = v));

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!g) return;
    const v0 = calib.invert ? { x: -g.x, y: -g.y, z: -g.z } : g;
    const v = applyCalibration(v0, calib.ox, calib.oy);
    beta = inPlaneAngle(v, getScreenAngle());
    standing = deviceTilts(v).flatness < FLAT_LIMIT;

    if (!standing) {
      q('value').textContent = '—';
      q('sub').textContent = 'Поставьте телефон вертикально';
      section.classList.remove('ok');
      was = false;
      return;
    }
    // линия не имеет направления: сворачиваем в 0…90°
    let a = ((normalize180(beta - ref) % 180) + 180) % 180;
    if (a > 90) a = 180 - a;
    const diff = a - target;
    const ok = Math.abs(diff) <= TOL;
    setRay(lray, a);
    q('value').textContent = `${a.toFixed(1)}°`;
    q('sub').textContent = ok
      ? `✓ совпало с ${target}°`
      : `до ${target}°: ${diff > 0 ? '−' : '+'}${Math.abs(diff).toFixed(1)}°`;
    section.classList.toggle('ok', ok);
    if (ok && !was) tick('Medium');
    was = ok;
  };
  raf = requestAnimationFrame(frame);

  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    target = Number(b.dataset.t);
    was = false;
    drawTarget();
  });
  q('zero').addEventListener('click', () => {
    if (!g || !standing) {
      toast('Поставьте телефон вертикально');
      return;
    }
    ref = beta;
    toast('Ноль установлен');
  });
  q('rzero').addEventListener('click', () => {
    ref = 0;
    toast('Ноль сброшен');
  });

  drawTarget();
  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsub();
      root.replaceChildren();
    },
  };
}
