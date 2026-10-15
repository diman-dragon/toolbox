import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import { DEFAULT_GRAVITY_FILTER, GravityFilter, type GravityFilterOpts } from './filter';
import type { Vec3 } from './types';

const G = 9.80665;
const DEG = Math.PI / 180;

/**
 * Подписка на акселерометр (с гравитацией, м/с²).
 * Android: при лежании экраном вверх z ≈ +9.81.
 * В браузере без датчиков через 1.5 с включается симулятор:
 * двигайте мышь — наклон; клавиша E — «телефон стоит».
 */
export function subscribeAccel(cb: (v: Vec3) => void, onUnavailable?: () => void): () => void {
  let stopped = false;
  let gotData = false;
  let handle: PluginListenerHandle | null = null;
  let stopSim: (() => void) | null = null;
  let simTimer: number | undefined;

  const emit = (v: Vec3) => {
    gotData = true;
    cb(v);
  };

  Motion.addListener('accel', (e) => {
    const a = e.accelerationIncludingGravity;
    if (a && a.x != null && a.y != null && a.z != null) emit({ x: a.x, y: a.y, z: a.z });
  })
    .then((h) => {
      if (stopped) void h.remove();
      else handle = h;
    })
    .catch(() => {
      /* датчик недоступен */
    });

  if (!Capacitor.isNativePlatform()) {
    simTimer = window.setTimeout(() => {
      if (!gotData && !stopped) stopSim = startSimulator(emit);
    }, 1500);
  } else if (onUnavailable) {
    simTimer = window.setTimeout(() => {
      if (!gotData && !stopped) onUnavailable();
    }, 3000);
  }

  return () => {
    stopped = true;
    window.clearTimeout(simTimer);
    if (handle) void handle.remove();
    stopSim?.();
  };
}

/**
 * Акселерометр с адаптивным сглаживанием (core/filter.ts): в покое сильное — цифры не дрожат,
 * в движении слабое — показания не отстают. Постоянные времени в секундах, поэтому поведение
 * одинаково на датчиках 30, 60 и 200 Гц.
 */
export function subscribeGravity(
  cb: (v: Vec3) => void,
  opts: Partial<GravityFilterOpts> = {},
  onUnavailable?: () => void,
): () => void {
  const filter = new GravityFilter({ ...DEFAULT_GRAVITY_FILTER, ...opts });
  return subscribeAccel((v) => cb(filter.push(v, performance.now())), onUnavailable);
}

function startSimulator(emit: (v: Vec3) => void): () => void {
  document.body.dataset.sim = '1';
  let fx = 0;
  let fy = 0;
  let upright = false;

  const onMove = (e: PointerEvent) => {
    fx = (e.clientX / window.innerWidth) * 2 - 1;
    fy = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'e') upright = !upright;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey);

  // шум как у настоящего датчика и руки: ≈ ±0.05 м/с²
  const noise = () => (Math.random() - 0.5) * 0.1;
  const timer = window.setInterval(() => {
    const ax = fx * 15 * DEG;
    const ay = -fy * 15 * DEG;
    if (upright) {
      emit({ x: G * Math.sin(ax) + noise(), y: G * Math.cos(ax) + noise(), z: noise() });
    } else {
      const x = G * Math.sin(ax);
      const y = G * Math.sin(ay);
      emit({ x: x + noise(), y: y + noise(), z: Math.sqrt(Math.max(G * G - x * x - y * y, 0)) + noise() });
    }
  }, 16);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey);
    delete document.body.dataset.sim;
  };
}
