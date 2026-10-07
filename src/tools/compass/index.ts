import { subscribeMag } from '../../core/magnetometer';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import type { Tool, Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';
import { normalize180 } from '../protractor/math';

const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;
const DIRS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Азимут верха экрана от магнитного севера (как SensorManager.getOrientation), градусы. */
function heading(g: Vec3, m: Vec3): number | null {
  const h = cross(m, g);
  const nh = Math.hypot(h.x, h.y, h.z);
  if (nh < 1e-3) return null;
  const mm = cross(g, h);
  const nm = Math.hypot(mm.x, mm.y, mm.z) || 1;
  return Math.atan2(h.y / nh, mm.y / nm) * R2D;
}

function rose(): string {
  let s = '';
  for (let a = 0; a < 360; a += 10) {
    const major = a % 90 === 0;
    const r2 = major ? 80 : a % 30 === 0 ? 86 : 90;
    const x = Math.sin(a * D2R);
    const y = -Math.cos(a * D2R);
    s += `<line class="tick${major ? ' major' : ''}" x1="${(96 * x).toFixed(1)}" y1="${(96 * y).toFixed(1)}" x2="${(r2 * x).toFixed(1)}" y2="${(r2 * y).toFixed(1)}"/>`;
  }
  for (const [t, a] of [['С', 0], ['В', 90], ['Ю', 180], ['З', 270]] as const) {
    s += `<text class="lbl${a === 0 ? ' north' : ''}" x="${(66 * Math.sin(a * D2R)).toFixed(1)}" y="${(-66 * Math.cos(a * D2R)).toFixed(1)}">${t}</text>`;
  }
  return s;
}

export default function createCompass(root: HTMLElement): Tool {
  const q = mount(
    root,
    `<section class="pane" style="align-items:center">
      <div class="big" data-id="val">—</div>
      <svg class="rose" viewBox="-110 -110 220 220" aria-hidden="true">
        <circle class="rim" r="100"/>
        <g data-id="rose">${rose()}</g>
        <path class="pointer" d="M0 -104 L-7 -92 L7 -92 Z"/>
        <circle class="hubc" r="4"/>
      </svg>
      <div class="note" data-id="note">Держите телефон горизонтально, вдали от металла и магнитов. Показан магнитный север. Если стрелка «плывёт» — покачайте телефон «восьмёркой».</div>
    </section>`,
  );

  let g: Vec3 | null = null;
  let m: Vec3 | null = null;
  let cur: number | null = null;
  let raf = 0;

  const unG = subscribeGravity((v) => (g = v));
  const unM = subscribeMag(
    (v) => (m = v),
    () => {
      q('val').textContent = '—';
      q('note').textContent = 'На этом устройстве нет магнитометра — компас недоступен.';
    },
  );

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!g || !m) return;
    const raw = heading(g, m);
    if (raw === null) return;
    const h = (raw + getScreenAngle() + 360) % 360;
    cur = cur === null ? h : (cur + normalize180(h - cur) * 0.15 + 360) % 360;
    q('rose').setAttribute('transform', `rotate(${(-cur).toFixed(1)})`);
    q('val').textContent = `${Math.round(cur) % 360}° ${DIRS[Math.round(cur / 45) % 8]}`;
  };
  raf = requestAnimationFrame(frame);

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unG();
      unM();
      root.replaceChildren();
    },
  };
}
