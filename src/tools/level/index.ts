import { scope } from '../../core/actions';
import { GravityFilter, damp, hysteresis, meanVec, stableRound } from '../../core/filter';
import { tick } from '../../core/haptics';
import { t } from '../../core/i18n';
import { calibrate, calibrateTwoPosition, edgeTilt, screenTilts, tilts } from '../../core/orient';
import { getScreenAngle } from '../../core/screen';
import { subscribeAccel } from '../../core/sensors';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool, Vec3 } from '../../core/types';
import { confirmSheet } from '../../ui/sheet';
import { toast } from '../../ui/toast';
import { bubblePos, formatAngle, nextUnit, unitLabel, type Unit } from './math';
import './level.css';

/** «В нуле»: входим при ≤ 0.2°, выходим только при > 0.35° — экран не мигает на границе. */
const ZERO_ENTER = 0.2;
const ZERO_LEAVE = 0.35;
/** Отклонение, при котором пузырёк упирается в край ампулы (раньше 8° и 6° — пузырёк «улетал» от малейшего наклона). */
const MAX_FLAT = 12;
const MAX_EDGE = 9;
/** Инерция пузырька, с. */
const BUBBLE_TAU = 0.09;
/** Шаг цифр на экране, °. */
const DIGIT_STEP = 0.1;
const KEY = 'level.settings';
const CAL_MS = 1200;
const CAL_MAX_STD = 0.1;
const CAL_PENDING_MS = 3 * 60 * 1000;

interface Settings {
  ox: number;
  oy: number;
  unit: Unit;
  invert: boolean;
}

const DEFAULTS: Settings = { ox: 0, oy: 0, unit: 'deg', invert: false };

export default async function createLevel(root: HTMLElement): Promise<Tool> {
  const S: Settings = { ...DEFAULTS, ...(await loadJSON<Partial<Settings>>(KEY, {})) };

  root.innerHTML = `
    <section class="level" data-mode="flat" data-axis="h">
      <div class="readout">
        <button class="value" data-id="value" data-action="level.unit" type="button">0.0°</button>
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
      <div class="tip" data-id="tip"></div>
      <div class="controls">
        <button data-action="level.hold" data-id="hold" type="button">${t('Hold')}</button>
        <button data-action="level.unit" data-id="unit" type="button"></button>
        <button data-action="level.sound" data-id="sound" type="button">${t('Звук')}</button>
        <button data-action="level.invert" data-id="invert" type="button">${t('Оси ⇄')}</button>
        <button data-action="level.calib" data-id="calib" type="button" class="primary">${t('Калибровка')}</button>
        <button data-action="level.reset" data-id="reset" type="button">${t('Сброс')}</button>
      </div>
    </section>
  `;

  const q = <T extends HTMLElement = HTMLElement>(id: string): T => root.querySelector<T>(`[data-id="${id}"]`) as T;
  const section = root.querySelector<HTMLElement>('.level') as HTMLElement;
  const valueEl = q('value');
  const subEl = q('sub');
  const tipEl = q('tip');
  const bubbleEl = q('bubble');
  const vbubbleEl = q('vbubble');
  const holdBtn = q('hold');
  const unitBtn = q('unit');
  const soundBtn = q('sound');
  const invertBtn = q('invert');
  const calibBtn = q('calib');

  const filter = new GravityFilter();
  let g: Vec3 | null = null;
  let mode: 'flat' | 'edge' = 'flat';
  let swapped = false;
  let held = false;
  let soundOn = false;
  let zero = false;
  let lastBuzz = 0;
  let raf = 0;
  let lastT = performance.now();
  let bx = 0;
  let by = 0;
  let bv = 0;
  let shownMag: number | null = null;
  let shownX: number | null = null;
  let shownY: number | null = null;
  let magForSound = 0;

  let rec: Vec3[] | null = null;
  const unsubscribe = subscribeAccel(
    (v) => {
      g = filter.push(v, performance.now());
      rec?.push(v);
    },
    () => {
      subEl.textContent = t('На этом устройстве нет акселерометра');
    },
  );

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
    osc.frequency.setTargetAtTime(220 + (1 - Math.min(mag / 8, 1)) * 880, ac.currentTime, 0.08);
    gain.gain.setTargetAtTime(mag < 8 ? 0.05 : 0, ac.currentTime, 0.08);
  };

  // ---------- отрисовка ----------
  const signed = (deg: number): string => (deg > 0 ? '+' : deg < 0 ? '−' : '') + formatAngle(deg, S.unit);

  const paintText = (mag: number, sx: number, sy: number, tiltSign: number) => {
    shownMag = stableRound(shownMag, mag, DIGIT_STEP);
    const m = zero ? 0 : shownMag;
    if (mode === 'flat') {
      valueEl.textContent = formatAngle(m, S.unit);
      shownX = stableRound(shownX, sx, DIGIT_STEP);
      shownY = stableRound(shownY, sy, DIGIT_STEP);
      subEl.textContent = zero ? t('✓ в нуле') : `X ${signed(shownX)}   Y ${signed(shownY)}`;
    } else {
      valueEl.textContent = (zero || m === 0 ? '' : tiltSign > 0 ? '+' : '−') + formatAngle(m, S.unit);
      if (zero) subEl.textContent = t('✓ в нуле');
      else if (swapped) subEl.textContent = tiltSign > 0 ? t('верхний край выше') : t('нижний край выше');
      else subEl.textContent = tiltSign > 0 ? t('правый край выше') : t('левый край выше');
    }
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (!g) return;

    const v = calibrate(g, { ox: S.ox, oy: S.oy, invert: S.invert });
    const ti = tilts(v);
    if (mode === 'flat' && ti.flatness < 0.72) mode = 'edge';
    else if (mode === 'edge' && ti.flatness > 0.82) mode = 'flat';
    section.dataset.mode = mode;

    if (held) {
      updateSound(99);
      return;
    }

    let mag: number;
    let sx = 0;
    let sy = 0;
    let tiltSign = 0;
    if (mode === 'flat') {
      const s = screenTilts(v, getScreenAngle());
      sx = s.sx;
      sy = s.sy;
      mag = ti.slope;
    } else {
      const e = edgeTilt(v, getScreenAngle(), swapped);
      if (e.swapped !== swapped) {
        swapped = e.swapped;
        section.dataset.axis = swapped ? 'v' : 'h';
      }
      mag = Math.abs(e.tilt);
      tiltSign = e.tilt;
    }

    const wasZero = zero;
    zero = hysteresis(zero, mag, ZERO_ENTER, ZERO_LEAVE);
    section.classList.toggle('ok', zero);

    if (mode === 'flat') {
      const p = bubblePos(sx, sy, MAX_FLAT);
      bx = damp(bx, p.nx, dt, BUBBLE_TAU);
      by = damp(by, p.ny, dt, BUBBLE_TAU);
      bubbleEl.style.left = `${50 + bx * 42}%`;
      bubbleEl.style.top = `${50 + by * 42}%`;
    } else {
      bv = damp(bv, Math.max(-1, Math.min(1, tiltSign / MAX_EDGE)), dt, BUBBLE_TAU);
      if (swapped) {
        vbubbleEl.style.left = '50%';
        vbubbleEl.style.top = `${50 - bv * 41}%`;
      } else {
        vbubbleEl.style.top = '50%';
        vbubbleEl.style.left = `${50 + bv * 41}%`;
      }
    }

    paintText(mag, sx, sy, tiltSign);

    if (zero && !wasZero && now - lastBuzz > 700) {
      lastBuzz = now;
      tick('Medium');
    }
    magForSound = damp(magForSound, mag, dt, 0.15);
    updateSound(magForSound);
  };
  raf = requestAnimationFrame(frame);

  // ---------- калибровка по двум положениям ----------
  let pending: { w: Vec3; at: number } | null = null;
  let busy = false;

  const refreshButtons = () => {
    unitBtn.textContent = unitLabel(S.unit);
    holdBtn.classList.toggle('on', held);
    soundBtn.classList.toggle('on', soundOn);
    invertBtn.classList.toggle('on', S.invert);
    calibBtn.textContent = pending ? t('Шаг 2: на 180°') : t('Калибровка');
    tipEl.textContent = pending
      ? t('Шаг 2 из 2: поверните телефон на 180° на том же месте и нажмите ещё раз.')
      : t('Калибровка в два шага: положите телефон на ровную поверхность, нажмите «Калибровка», затем поверните на 180° и нажмите снова. Так наклон стола не попадёт в ноль.');
  };

  const measure = (): Promise<Vec3 | null> =>
    new Promise((resolve) => {
      rec = [];
      window.setTimeout(() => {
        const samples = rec ?? [];
        rec = null;
        if (samples.length < 5) return resolve(null);
        const { mean, std } = meanVec(samples);
        resolve(std <= CAL_MAX_STD ? (S.invert ? { x: -mean.x, y: -mean.y, z: -mean.z } : mean) : null);
      }, CAL_MS);
    });

  const doCalib = async () => {
    if (busy) return;
    if (!g) {
      toast(t('Нет данных с датчика'));
      return;
    }
    busy = true;
    calibBtn.setAttribute('disabled', '');
    calibBtn.textContent = t('Измерение…');
    const w = await measure();
    calibBtn.removeAttribute('disabled');
    busy = false;
    if (!w) {
      toast(t('Телефон двигается — положите ровно и повторите'));
    } else if (tilts(w).flatness < 0.97) {
      toast(t('Положите телефон на ровную поверхность экраном вверх'));
    } else if (!pending || performance.now() - pending.at > CAL_PENDING_MS) {
      pending = { w, at: performance.now() };
      toast(t('Шаг 1 из 2 готов. Поверните телефон на 180° и нажмите ещё раз'));
    } else {
      const r = calibrateTwoPosition(pending.w, w);
      pending = null;
      if (!r || Math.abs(r.ox) > 5 || Math.abs(r.oy) > 5) {
        toast(t('Не получилось: телефон должен лежать ровно. Повторите с шага 1'));
      } else {
        S.ox = r.ox;
        S.oy = r.oy;
        void saveJSON(KEY, S);
        toast(t('Откалибровано. Наклон поверхности ≈ {0}°', r.surface.toFixed(1)));
      }
    }
    refreshButtons();
  };

  // ---------- управление ----------
  const sc = scope()
    .on('level.unit', () => {
      S.unit = nextUnit(S.unit);
      shownMag = shownX = shownY = null;
      void saveJSON(KEY, S);
      refreshButtons();
    })
    .on('level.hold', () => {
      held = !held;
      refreshButtons();
    })
    .on('level.sound', () => {
      soundOn = !soundOn;
      if (soundOn) startSound();
      else stopSound();
      refreshButtons();
    })
    .on('level.invert', () => {
      // смещения нуля измерены в прежней системе знаков — после инверсии они неверны
      S.invert = !S.invert;
      S.ox = 0;
      S.oy = 0;
      pending = null;
      void saveJSON(KEY, S);
      refreshButtons();
      toast(t('Оси переключены, калибровку нужно повторить'));
    })
    .on('level.calib', () => void doCalib())
    .on('level.reset', () =>
      confirmSheet({
        title: t('Сбросить калибровку уровня?'),
        text: t('Смещение нуля вернётся к заводскому. Калибровку можно повторить в любой момент.'),
        confirm: t('Сбросить'),
        danger: true,
        onConfirm: () => {
          S.ox = 0;
          S.oy = 0;
          pending = null;
          void saveJSON(KEY, S);
          refreshButtons();
          toast(t('Калибровка сброшена'));
        },
      }),
    );

  refreshButtons();

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsubscribe();
      stopSound();
      sc.dispose();
      root.replaceChildren();
    },
  };
}
