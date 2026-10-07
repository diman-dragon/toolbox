import { tick } from '../../core/haptics';
import { loadCalib } from '../../core/calib';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool, Vec3 } from '../../core/types';
import { toast } from '../../ui/toast';
import { deviceTilts } from '../level/math';
import {
  applyCalibration,
  distToSnap,
  inPlaneAngle,
  normalize180,
  slopeAngle,
} from './math';
import '../level/level.css';
import './protractor.css';

type Mode = 'plane' | 'slope';

const KEY = 'protractor.settings';
/** Подсветка и вибро рядом с кратными 45° */
const SNAP_TOL = 0.3;
/** Лёжа (flatness выше порога) угол «в плоскости» не определён */
const FLAT_LIMIT = 0.9;
const ZERO_TOL = 0.1;
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
        <button data-id="m-plane" type="button">В плоскости</button>
        <button data-id="m-slope" type="button">Склон</button>
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
        <button data-id="hold" type="button">Hold</button>
        <button data-id="zero" type="button" class="primary only-plane">Ноль</button>
        <button data-id="rzero" type="button" class="only-plane">Сброс нуля</button>
      </div>
    </section>
  `;

  const q = <T extends Element = HTMLElement>(id: string): T =>
    root.querySelector<T>(`[data-id="${id}"]`) as T;

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
  const planeBtn = q('m-plane');
  const slopeBtn = q('m-slope');

  // ---------- состояние ----------
  let g: Vec3 | null = null;
  let held = false;
  let ref = 0; // «ноль» для относительного угла (градусы)
  let wasSnap = false;
  let lastBuzz = 0;
  let raf = 0;
  let live = { beta: 0, flatness: 1, slope: 0 };

  const unsubscribe = subscribeGravity((v) => {
    g = v;
  });

  // ---------- отрисовка ----------
  const arcPath = (r: number, deg: number): string => {
    if (Math.abs(deg) < 0.05) return '';
    const rad = deg * DEG2RAD;
    const x = (r * Math.cos(rad)).toFixed(2);
    const y = (r * Math.sin(rad)).toFixed(2);
    const sweep = deg > 0 ? 1 : 0;
    const large = Math.abs(deg) > 180 ? 1 : 0;
    return `M ${r} 0 A ${r} ${r} 0 ${large} ${sweep} ${x} ${y}`;
  };

  const buzz = (ok: boolean) => {
    const now = performance.now();
    if (ok && !wasSnap && now - lastBuzz > 400) {
      lastBuzz = now;
      tick('Light');
    }
    wasSnap = ok;
  };

  const renderPlane = () => {
    const standing = live.flatness < FLAT_LIMIT;
    const delta = normalize180(live.beta - ref);
    needle.setAttribute('transform', `rotate(${delta.toFixed(2)})`);
    arc.setAttribute('d', arcPath(58, Math.max(-179.9, Math.min(179.9, delta))));

    if (!standing) {
      valueEl.textContent = '—';
      subEl.textContent = 'Поставьте телефон вертикально';
      section.classList.remove('ok');
      buzz(false);
      return;
    }

    valueEl.textContent = `${sgn(delta)}${fmt(delta)}`;
    const side = delta > 0.05 ? 'правый край выше' : delta < -0.05 ? 'левый край выше' : 'горизонтально';
    subEl.textContent = ref !== 0 ? `${side} · от нуля` : side;

    const snap = distToSnap(delta) <= SNAP_TOL;
    section.classList.toggle('ok', snap);
    buzz(snap);
  };

  const renderSlope = () => {
    const a = live.slope;
    const rad = a * DEG2RAD;
    const len = 110;
    const ex = 20 + len * Math.cos(rad);
    const ey = 120 - len * Math.sin(rad);
    sline.setAttribute('x2', ex.toFixed(2));
    sline.setAttribute('y2', ey.toFixed(2));

    const ar = 60;
    if (a < 0.05) {
      sarc.setAttribute('d', '');
    } else {
      const ax = 20 + ar * Math.cos(rad);
      const ay = 120 - ar * Math.sin(rad);
      sarc.setAttribute('d', `M ${20 + ar} 120 A ${ar} ${ar} 0 0 0 ${ax.toFixed(2)} ${ay.toFixed(2)}`);
    }
    const mid = rad / 2;
    slbl.setAttribute('x', (20 + 82 * Math.cos(mid)).toFixed(2));
    slbl.setAttribute('y', (120 - 82 * Math.sin(mid) + 5).toFixed(2));
    slbl.textContent = `${a.toFixed(1)}°`;

    valueEl.textContent = fmt(a);
    const t = Math.tan(Math.min(a, 89.9) * DEG2RAD);
    const ratio = t > 0.0005 ? `1:${(1 / t).toFixed(1)}` : '—';
    subEl.textContent = a <= ZERO_TOL ? '✓ ровно' : `${(t * 100).toFixed(1)}%  ·  ${ratio}`;

    const zero = a <= ZERO_TOL;
    section.classList.toggle('ok', zero);
    buzz(zero);
  };

  const render = () => (mode === 'plane' ? renderPlane() : renderSlope());

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!g || held) return;
    const v0: Vec3 = calib.invert ? { x: -g.x, y: -g.y, z: -g.z } : g;
    const v = applyCalibration(v0, calib.ox, calib.oy);
    live = {
      beta: inPlaneAngle(v, getScreenAngle()),
      flatness: deviceTilts(v).flatness,
      slope: slopeAngle(v),
    };
    render();
  };
  raf = requestAnimationFrame(frame);

  // ---------- управление ----------
  const refreshUi = () => {
    section.dataset.mode = mode;
    planeBtn.classList.toggle('on', mode === 'plane');
    slopeBtn.classList.toggle('on', mode === 'slope');
    holdBtn.classList.toggle('on', held);
    tipEl.textContent =
      mode === 'plane'
        ? 'Телефон стоит вертикально. Приложите ребро к первой поверхности, нажмите «Ноль», затем приложите ко второй — на экране угол между ними.'
        : 'Положите телефон экраном вверх на склон — крышу, пандус, лестницу. Ровная калибровка берётся из «Уровня».';
  };

  const setMode = (m: Mode) => {
    mode = m;
    wasSnap = false;
    void saveJSON(KEY, { mode });
    refreshUi();
    render();
  };

  planeBtn.addEventListener('click', () => setMode('plane'));
  slopeBtn.addEventListener('click', () => setMode('slope'));

  holdBtn.addEventListener('click', () => {
    held = !held;
    refreshUi();
  });

  q('zero').addEventListener('click', () => {
    if (!g || live.flatness >= FLAT_LIMIT) {
      toast('Поставьте телефон вертикально');
      return;
    }
    ref = live.beta;
    toast('Ноль установлен');
    render();
  });

  q('rzero').addEventListener('click', () => {
    ref = 0;
    toast('Ноль сброшен');
    render();
  });

  refreshUi();
  render();

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsubscribe();
      root.replaceChildren();
    },
  };
}
