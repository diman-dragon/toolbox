import { scope } from '../../core/actions';
import { loadCalib } from '../../core/calib';
import { damp, hysteresis, stableRound } from '../../core/filter';
import { tick } from '../../core/haptics';
import { t } from '../../core/i18n';
import { calibrate, inPlaneAngle, normalize180, tilts } from '../../core/orient';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import type { Tool, Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';
import '../level/level.css';

const TARGETS = [15, 30, 45, 60, 90];
/** Допуск совпадения, °: входим при ±0.5, выходим при ±0.8 — зелёный экран не мигает на границе. */
const TOL_ENTER = 0.5;
const TOL_LEAVE = 0.8;
const STAND_ENTER = 0.75;
const STAND_LEAVE = 0.82;
const D2R = Math.PI / 180;

export default async function createAngles(root: HTMLElement): Promise<Tool> {
  const calib = await loadCalib();
  let target = 45;
  let ref = 0;

  const q = mount(
    root,
    `<section class="level tpl">
      <div class="seg" data-id="chips">${TARGETS.map((v) => `<button type="button" data-action="angles.target" data-t="${v}">${v}°</button>`).join('')}</div>
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
      <div class="tip">${t('Телефон стоит вертикально. Приложите ребро к основанию (ноль), затем к детали — когда угол совпадёт с шаблоном, экран позеленеет.')}</div>
      <div class="controls">
        <button type="button" data-action="angles.zero" class="primary">${t('Ноль')}</button>
        <button type="button" data-action="angles.rzero">${t('Сброс нуля')}</button>
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
    for (const b of chips.querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', Number(b.dataset.t) === target);
  };

  let g: Vec3 | null = null;
  let beta = 0;
  let standing = false;
  let ok = false;
  let rayDeg = 0;
  let shown: number | null = null;
  let raf = 0;
  let lastT = performance.now();
  const unsub = subscribeGravity(
    (v) => (g = v),
    {},
    () => {
      q('sub').textContent = t('На этом устройстве нет акселерометра');
    },
  );

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (!g) return;
    const v = calibrate(g, calib);
    beta = inPlaneAngle(v, getScreenAngle());
    const flat = tilts(v).flatness;
    standing = standing ? flat <= STAND_LEAVE : flat < STAND_ENTER;

    if (!standing) {
      q('value').textContent = '—';
      q('sub').textContent = t('Поставьте телефон вертикально');
      section.classList.remove('ok');
      ok = false;
      shown = null;
      return;
    }
    // линия не имеет направления: сворачиваем в 0…90°
    let a = ((normalize180(beta - ref) % 180) + 180) % 180;
    if (a > 90) a = 180 - a;
    rayDeg = damp(rayDeg, a, dt, 0.08);
    setRay(lray, rayDeg);

    const diff = a - target;
    const was = ok;
    ok = hysteresis(ok, Math.abs(diff), TOL_ENTER, TOL_LEAVE);
    shown = stableRound(shown, a, 0.1);
    const d = stableRound(null, diff, 0.1);
    q('value').textContent = `${shown.toFixed(1)}°`;
    q('sub').textContent = ok ? t('✓ совпало с {0}°', target) : t('до {0}°: {1}{2}°', target, d > 0 ? '−' : '+', Math.abs(d).toFixed(1));
    section.classList.toggle('ok', ok);
    if (ok && !was) tick('Medium');
  };
  raf = requestAnimationFrame(frame);

  const sc = scope()
    .on('angles.target', (el) => {
      target = Number(el.dataset.t);
      ok = false;
      drawTarget();
    })
    .on('angles.zero', () => {
      if (!g || !standing) {
        toast(t('Поставьте телефон вертикально'));
        return;
      }
      ref = beta;
      toast(t('Ноль установлен'));
    })
    .on('angles.rzero', () => {
      ref = 0;
      toast(t('Ноль сброшен'));
    });

  drawTarget();
  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsub();
      sc.dispose();
      root.replaceChildren();
    },
  };
}
