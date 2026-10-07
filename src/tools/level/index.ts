import { tick } from '../../core/haptics';
import { getScreenAngle } from '../../core/screen';
import { subscribeAccel } from '../../core/sensors';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool, Vec3 } from '../../core/types';
import { toast } from '../../ui/toast';
import {
  UNIT_LABEL,
  deviceTilts,
  formatAngle,
  nextUnit,
  toScreenFrame,
  type Unit,
} from './math';
import './level.css';

/** Порог «в нуле», градусы */
const ZERO_TOL = 0.1;
/** Наклон, при котором пузырёк упирается в край */
const MAX_FLAT = 8;
const MAX_EDGE = 6;
const KEY = 'level.settings';

interface Settings {
  /** Смещения нуля по осям устройства (градусы) */
  ox: number;
  oy: number;
  unit: Unit;
  /** Инверсия знаков осей — на случай, если пузырёк бежит не в ту сторону */
  invert: boolean;
}

const DEFAULTS: Settings = { ox: 0, oy: 0, unit: 'deg', invert: false };

interface Reading {
  sx: number;
  sy: number;
  mode: 'flat' | 'edge';
}

export default async function createLevel(root: HTMLElement): Promise<Tool> {
  const S: Settings = { ...DEFAULTS, ...(await loadJSON<Partial<Settings>>(KEY, {})) };

  root.innerHTML = `
    <section class="level" data-mode="flat">
      <div class="readout">
        <button class="value" data-id="value" type="button">0.0°</button>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <div class="dish">
          <i class="cross-h"></i><i class="cross-v"></i><i class="ring"></i>
          <i class="bubble" data-id="bubble"></i>
        </div>
        <div class="vial">
          <i class="mark m1"></i><i class="mark m2"></i>
          <i class="bubble" data-id="vbubble"></i>
        </div>
      </div>
      <div class="tip">
        Калибровка: положите телефон на ровную поверхность экраном вверх.
        Проверка: поверните на 180° — показания должны остаться нулевыми.
      </div>
      <div class="controls">
        <button data-id="hold" type="button">Hold</button>
        <button data-id="unit" type="button"></button>
        <button data-id="sound" type="button">Звук</button>
        <button data-id="invert" type="button">Оси ⇄</button>
        <button data-id="calib" type="button" class="primary">Калибровка</button>
        <button data-id="reset" type="button">Сброс</button>
      </div>
    </section>
  `;

  const q = <T extends HTMLElement = HTMLElement>(id: string): T =>
    root.querySelector<T>(`[data-id="${id}"]`) as T;

  const section = root.querySelector<HTMLElement>('.level') as HTMLElement;
  const valueEl = q('value');
  const subEl = q('sub');
  const bubbleEl = q('bubble');
  const vbubbleEl = q('vbubble');
  const holdBtn = q('hold');
  const unitBtn = q('unit');
  const soundBtn = q('sound');
  const invertBtn = q('invert');

  // ---------- состояние ----------
  let raw: Vec3 | null = null; // отфильтрованный вектор гравитации
  let mode: 'flat' | 'edge' = 'flat';
  let held = false;
  let soundOn = false;
  let wasZero = false;
  let lastBuzz = 0;
  let last: Reading | null = null;
  let raf = 0;

  // ---------- сигнал: low-pass фильтр ----------
  const unsubscribe = subscribeAccel((v) => {
    if (!raw) {
      raw = { ...v };
      return;
    }
    const d = Math.hypot(v.x - raw.x, v.y - raw.y, v.z - raw.z);
    // быстрое движение — слабее фильтр, покой — сильнее (нет дрожания)
    const a = d > 1.5 ? 0.5 : 0.12;
    raw = {
      x: raw.x + (v.x - raw.x) * a,
      y: raw.y + (v.y - raw.y) * a,
      z: raw.z + (v.z - raw.z) * a,
    };
  });

  // ---------- звук ----------
  let ac: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;

  const startSound = () => {
    ac = new AudioContext();
    osc = ac.createOscillator();
    gain = ac.createGain();
    gain.gain.value = 0;
    osc.type = 'sine';
    osc.connect(gain).connect(ac.destination);
    osc.start();
  };

  const stopSound = () => {
    try {
      osc?.stop();
      void ac?.close();
    } catch {
      /* уже остановлен */
    }
    ac = null;
    osc = null;
    gain = null;
  };

  const updateSound = (mag: number) => {
    if (!ac || !osc || !gain) return;
    const near = mag < 8;
    const freq = 220 + (1 - Math.min(mag / 8, 1)) * 880;
    osc.frequency.setTargetAtTime(freq, ac.currentTime, 0.05);
    gain.gain.setTargetAtTime(near ? 0.05 : 0, ac.currentTime, 0.05);
  };

  // ---------- отрисовка ----------
  const signed = (deg: number): string =>
    (deg > 0 ? '+' : deg < 0 ? '−' : '') + formatAngle(deg, S.unit);

  const render = (r: Reading) => {
    const flat = r.mode === 'flat';
    section.dataset.mode = r.mode;

    const mag = flat ? Math.hypot(r.sx, r.sy) : Math.abs(r.sx);
    const zero = mag <= ZERO_TOL;
    section.classList.toggle('ok', zero);

    valueEl.textContent = (flat || zero ? '' : r.sx > 0 ? '+' : '−') + formatAngle(mag, S.unit);

    if (zero) subEl.textContent = '✓ в нуле';
    else if (flat) subEl.textContent = `X ${signed(r.sx)}   Y ${signed(r.sy)}`;
    else subEl.textContent = r.sx > 0 ? 'правый край выше' : 'левый край выше';

    if (flat) {
      let nx = r.sx / MAX_FLAT;
      let ny = -r.sy / MAX_FLAT;
      const len = Math.hypot(nx, ny);
      if (len > 1) {
        nx /= len;
        ny /= len;
      }
      bubbleEl.style.left = `${50 + nx * 42}%`;
      bubbleEl.style.top = `${50 + ny * 42}%`;
    } else {
      const nx = Math.max(-1, Math.min(1, r.sx / MAX_EDGE));
      vbubbleEl.style.left = `${50 + nx * 41}%`;
    }

    const now = performance.now();
    if (zero && !wasZero && now - lastBuzz > 500) {
      lastBuzz = now;
      tick('Medium');
    }
    wasZero = zero;

    updateSound(mag);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!raw) return;

    const v = S.invert ? { x: -raw.x, y: -raw.y, z: -raw.z } : raw;
    const t = deviceTilts(v);

    // гистерезис переключения режимов
    if (mode === 'flat' && t.flatness < 0.75) mode = 'edge';
    else if (mode === 'edge' && t.flatness > 0.85) mode = 'flat';

    const s = toScreenFrame(t.tx - S.ox, t.ty - S.oy, getScreenAngle());
    last = { sx: s.sx, sy: s.sy, mode };

    if (held) updateSound(99);
    else render(last);
  };
  raf = requestAnimationFrame(frame);

  // ---------- управление ----------
  const refreshButtons = () => {
    unitBtn.textContent = UNIT_LABEL[S.unit];
    holdBtn.classList.toggle('on', held);
    soundBtn.classList.toggle('on', soundOn);
    invertBtn.classList.toggle('on', S.invert);
  };

  const cycleUnit = () => {
    S.unit = nextUnit(S.unit);
    void saveJSON(KEY, S);
    refreshButtons();
    if (last) render(last);
  };

  valueEl.addEventListener('click', cycleUnit);
  unitBtn.addEventListener('click', cycleUnit);

  holdBtn.addEventListener('click', () => {
    held = !held;
    refreshButtons();
  });

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) startSound();
    else stopSound();
    refreshButtons();
  });

  invertBtn.addEventListener('click', () => {
    S.invert = !S.invert;
    void saveJSON(KEY, S);
    refreshButtons();
  });

  q('calib').addEventListener('click', () => {
    if (!raw) {
      toast('Нет данных с датчика');
      return;
    }
    const v = S.invert ? { x: -raw.x, y: -raw.y, z: -raw.z } : raw;
    const t = deviceTilts(v);
    if (t.flatness < 0.97) {
      toast('Положите телефон на ровную поверхность экраном вверх');
      return;
    }
    S.ox = t.tx;
    S.oy = t.ty;
    void saveJSON(KEY, S);
    toast('Откалибровано');
  });

  q('reset').addEventListener('click', () => {
    S.ox = 0;
    S.oy = 0;
    void saveJSON(KEY, S);
    toast('Калибровка сброшена');
  });

  refreshButtons();

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsubscribe();
      stopSound();
      root.replaceChildren();
    },
  };
}
