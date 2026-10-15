import { scope } from '../../core/actions';
import { loadCalib } from '../../core/calib';
import { damp, hysteresis, stableRound } from '../../core/filter';
import { tick } from '../../core/haptics';
import { t } from '../../core/i18n';
import { calibrate, distToSnap, inPlaneAngle, normalize180, tilts } from '../../core/orient';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool, Vec3 } from '../../core/types';
import { toast } from '../../ui/toast';
import '../level/level.css';
import './protractor.css';

type Mode = 'plane' | 'slope';

const KEY = 'protractor.settings';
/** Подсветка и вибро рядом с кратными 45°: входим при ±0.3°, выходим при ±0.5° */
const SNAP_ENTER = 0.3;
const SNAP_LEAVE = 0.5;
/** Угол «в плоскости» осмыслен, только когда телефон стоит (с гистерезисом, чтобы не мигало на границе). */
const STAND_ENTER = 0.75;
const STAND_LEAVE = 0.82;
const ZERO_ENTER = 0.2;
const ZERO_LEAVE = 0.35;
const DIGIT_STEP = 0.1;
const NEEDLE_TAU = 0.08;
const DEG2RAD = Math.PI / 180;

const fmt = (deg: number) => `${Math.abs(deg).toFixed(1)}°`;
const sgn = (deg: number) => (deg > 0.05 ? '+' : deg < -0.05 ? '−' : '');

/** SVG-разметка статичной шкалы: деления каждые 5°, подписи по правой и левой половине. */
function buildScale(): string {
  let out = '';
  for (let a = 0; a < 360; a += 5) {
    const major = a % 30 === 0;
    const mid = !major && a % 15 === 0;
    const r1 = 96;
    const r2 = major ? 82 : mid ? 87 : 90;
    const rad = a * DEG2RAD;
    const cls = major ? 'tick major' : mid ? 'tick mid' : 'tick';
    out += `<line class="${cls}" x1="${(r1 * Math.cos(rad)).toFixed(2)}" y1="${(r1 * Math.sin(rad)).toFixed(2)}" x2="${(r2 * Math.cos(rad)).toFixed(2)}" y2="${(r2 * Math.sin(rad)).toFixed(2)}"/>`;
  }
  // подписи: положение — угол по часовой от «3 часов», текст — острый угол к горизонтали экрана
  const labels: Array<[number, string]> = [
    [-90, '90'],
    [-60, '60'],
    [-30, '30'],
    [0, '0'],
    [30, '30'],
    [60, '60'],
    [90, '90'],
    [120, '60'],
    [150, '30'],
    [180, '0'],
    [210, '30'],
    [240, '60'],
  ];
  for (const [pos, text] of labels) {
    const rad = pos * DEG2RAD;
    const r = 70;
    out += `<text class="lbl" x="${(r * Math.cos(rad)).toFixed(2)}" y="${(r * Math.sin(rad)).toFixed(2)}">${text}</text>`;
  }
  return out;
}

export default async function createProtractor(root: HTMLElement): Promise<Tool> {
  const calib = await loadCalib();
  const saved = await loadJSON<{ mode?: Mode }>(KEY, {});
  let mode: Mode = saved.mode === 'slope' ? 'slope' : 'plane';

  root.innerHTML = `
    <section class="level proto" data-mode="${mode}">
      <div class="seg">
        <button data-action="proto.mode" data-v="plane" type="button">${t('В плоскости')}</button>
        <button data-action="proto.mode" data-v="slope" type="button">${t('Склон')}</button>
      </div>
      <div class="readout">
        <div class="value" data-id="value">0.0°</div>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <svg class="dial" viewBox="-110 -110 220 220" aria-hidden="true">
          <circle class="rim" r="100"/>
          ${buildScale()}
          <line class="refline" x1="-80" y1="0" x2="80" y2="0"/>
          <path class="arc" data-id="arc" d=""/>
          <g data-id="needle">
            <line class="needle-line" x1="-78" y1="0" x2="78" y2="0"/>
            <path class="sky" d="M0 -6 L0 -30 M-6 -26 L0 -36 L6 -26 Z"/>
          </g>
          <circle class="hub" r="5"/>
        </svg>
        <svg class="ramp" viewBox="0 0 220 140" aria-hidden="true">
          <line class="ground" x1="20" y1="120" x2="205" y2="120"/>
          <path class="slope-arc" data-id="sarc" d=""/>
          <line class="slope-line" data-id="sline" x1="20" y1="120" x2="130" y2="120"/>
          <text class="slope-lbl" data-id="slbl" x="98" y="112">0°</text>
        </svg>
      </div>
      <div class="tip" data-id="tip"></div>
      <div class="controls">
        <button data-action="proto.hold" data-id="hold" type="button">${t('Hold')}</button>
        <button data-action="proto.zero" data-id="zero" type="button" class="primary only-plane">${t('Ноль')}</button>
        <button data-action="proto.rzero" data-id="rzero" type="button" class="only-plane">${t('Сброс нуля')}</button>
      </div>
    </section>
  `;

  const q = <T extends Element = HTMLElement>(id: string): T => root.querySelector<T>(`[data-id="${id}"]`) as T;
  const section = root.querySelector<HTMLElement>('.proto') as HTMLElement;
  const valueEl = q('value');
  const subEl = q('sub');
  const tipEl = q('tip');
  const needle = q<SVGGElement>('needle');
  const arc = q<SVGPathElement>('arc');
  const sarc = q<SVGPathElement>('sarc');
  const sline = q<SVGLineElement>('sline');
  const slbl = q<SVGTextElement>('slbl');
  const holdBtn = q('hold');
  const planeBtn = root.querySelector<HTMLElement>('[data-v="plane"]') as HTMLElement;
  const slopeBtn = root.querySelector<HTMLElement>('[data-v="slope"]') as HTMLElement;

  let g: Vec3 | null = null;
  let held = false;
  let ref = 0; // «ноль» для относительного угла (градусы)
  let standing = false;
  let snapped = false;
  let zero = false;
  let lastBuzz = 0;
  let raf = 0;
  let lastT = performance.now();
  let live = { beta: 0, slope: 0, flatness: 1 };
  let needleDeg = 0;
  let slopeDeg = 0;
  let shownDelta: number | null = null;
  let shownSlope: number | null = null;

  const unsubscribe = subscribeGravity(
    (v) => {
      g = v;
    },
    {},
    () => {
      subEl.textContent = t('На этом устройстве нет акселерометра');
    },
  );

  const arcPath = (r: number, deg: number): string => {
    if (Math.abs(deg) < 0.05) return '';
    const rad = deg * DEG2RAD;
    return `M ${r} 0 A ${r} ${r} 0 ${Math.abs(deg) > 180 ? 1 : 0} ${deg > 0 ? 1 : 0} ${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };

  const buzz = (ok: boolean, wasOk: boolean) => {
    const now = performance.now();
    if (ok && !wasOk && now - lastBuzz > 600) {
      lastBuzz = now;
      tick('Light');
    }
  };

  const renderPlane = (dt: number) => {
    standing = standing ? live.flatness <= STAND_LEAVE : live.flatness < STAND_ENTER;
    const delta = normalize180(live.beta - ref);
    // стрелка плывёт кратчайшей дугой, через ±180° не «перекручивается»
    needleDeg = normalize180(needleDeg + normalize180(delta - needleDeg) * (1 - Math.exp(-Math.min(dt, 0.1) / NEEDLE_TAU)));
    needle.setAttribute('transform', `rotate(${needleDeg.toFixed(2)})`);
    arc.setAttribute('d', arcPath(58, Math.max(-179.9, Math.min(179.9, needleDeg))));

    if (!standing) {
      valueEl.textContent = '—';
      subEl.textContent = t('Поставьте телефон вертикально');
      section.classList.remove('ok');
      snapped = false;
      shownDelta = null;
      return;
    }
    shownDelta = stableRound(shownDelta, delta, DIGIT_STEP);
    valueEl.textContent = `${sgn(shownDelta)}${fmt(shownDelta)}`;
    const side = shownDelta > 0.05 ? t('правый край выше') : shownDelta < -0.05 ? t('левый край выше') : t('горизонтально');
    subEl.textContent = ref !== 0 ? `${side} · ${t('от нуля')}` : side;

    const was = snapped;
    snapped = hysteresis(snapped, distToSnap(delta), SNAP_ENTER, SNAP_LEAVE);
    section.classList.toggle('ok', snapped);
    buzz(snapped, was);
  };

  const renderSlope = (dt: number) => {
    slopeDeg = damp(slopeDeg, live.slope, dt, NEEDLE_TAU);
    const a = slopeDeg;
    const rad = a * DEG2RAD;
    sline.setAttribute('x2', (20 + 110 * Math.cos(rad)).toFixed(2));
    sline.setAttribute('y2', (120 - 110 * Math.sin(rad)).toFixed(2));
    if (a < 0.05) sarc.setAttribute('d', '');
    else sarc.setAttribute('d', `M ${20 + 60} 120 A 60 60 0 0 0 ${(20 + 60 * Math.cos(rad)).toFixed(2)} ${(120 - 60 * Math.sin(rad)).toFixed(2)}`);
    slbl.setAttribute('x', (20 + 82 * Math.cos(rad / 2)).toFixed(2));
    slbl.setAttribute('y', (120 - 82 * Math.sin(rad / 2) + 5).toFixed(2));

    const was = zero;
    zero = hysteresis(zero, live.slope, ZERO_ENTER, ZERO_LEAVE);
    shownSlope = stableRound(shownSlope, live.slope, DIGIT_STEP);
    const shown = zero ? 0 : shownSlope;
    slbl.textContent = `${shown.toFixed(1)}°`;
    valueEl.textContent = fmt(shown);
    const tg = Math.tan(Math.min(shown, 89.9) * DEG2RAD);
    subEl.textContent = zero ? t('✓ ровно') : `${(tg * 100).toFixed(1)}%  ·  ${tg > 0.0005 ? `1:${(1 / tg).toFixed(1)}` : '—'}`;
    section.classList.toggle('ok', zero);
    buzz(zero, was);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (!g || held) return;
    const v = calibrate(g, calib);
    const ti = tilts(v);
    live = { beta: inPlaneAngle(v, getScreenAngle()), slope: ti.slope, flatness: ti.flatness };
    if (mode === 'plane') renderPlane(dt);
    else renderSlope(dt);
  };
  raf = requestAnimationFrame(frame);

  const refreshUi = () => {
    section.dataset.mode = mode;
    planeBtn.classList.toggle('on', mode === 'plane');
    slopeBtn.classList.toggle('on', mode === 'slope');
    holdBtn.classList.toggle('on', held);
    tipEl.textContent =
      mode === 'plane'
        ? t('Телефон стоит вертикально. Приложите ребро к первой поверхности, нажмите «Ноль», затем приложите ко второй — на экране угол между ними.')
        : t('Положите телефон экраном вверх на склон — крышу, пандус, лестницу. Ровная калибровка берётся из «Уровня».');
  };

  const sc = scope()
    .on('proto.mode', (el) => {
      mode = el.dataset.v === 'slope' ? 'slope' : 'plane';
      snapped = false;
      zero = false;
      shownDelta = shownSlope = null;
      void saveJSON(KEY, { mode });
      refreshUi();
    })
    .on('proto.hold', () => {
      held = !held;
      refreshUi();
    })
    .on('proto.zero', () => {
      if (!g || !standing) {
        toast(t('Поставьте телефон вертикально'));
        return;
      }
      ref = live.beta;
      shownDelta = null;
      toast(t('Ноль установлен'));
    })
    .on('proto.rzero', () => {
      ref = 0;
      shownDelta = null;
      toast(t('Ноль сброшен'));
    });

  refreshUi();
  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsubscribe();
      sc.dispose();
      root.replaceChildren();
    },
  };
}
