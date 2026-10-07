import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import type { Vec3 } from './types';

const G = 9.80665;
const DEG = Math.PI / 180;

/**
 * Подписка на акселерометр (с гравитацией, м/с²).
 * Android: при лежании экраном вверх z ≈ +9.81.
 * В браузере без датчиков через 1.5 с включается симулятор:
 * двигайте мышь — наклон; клавиша E — «телефон стоит».
 */
export function subscribeAccel(cb: (v: Vec3) => void): () => void {
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
    if (a) emit({ x: a.x, y: a.y, z: a.z });
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
  }

  return () => {
    stopped = true;
    window.clearTimeout(simTimer);
    if (handle) void handle.remove();
    stopSim?.();
  };
}

/**
 * Акселерометр с low-pass фильтром: в покое сильное сглаживание (нет дрожания),
 * при быстром движении — слабое (нет запаздывания).
 */
export function subscribeGravity(cb: (v: Vec3) => void): () => void {
  let f: Vec3 | null = null;
  return subscribeAccel((v) => {
    if (!f) {
      f = { ...v };
    } else {
      const d = Math.hypot(v.x - f.x, v.y - f.y, v.z - f.z);
      const a = d > 1.5 ? 0.5 : 0.12;
      f = {
        x: f.x + (v.x - f.x) * a,
        y: f.y + (v.y - f.y) * a,
        z: f.z + (v.z - f.z) * a,
      };
    }
    cb(f);
  });
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

  const timer = window.setInterval(() => {
    const ax = fx * 15 * DEG;
    const ay = -fy * 15 * DEG;
    if (upright) {
      emit({ x: G * Math.sin(ax), y: G * Math.cos(ax), z: 0 });
    } else {
      const x = G * Math.sin(ax);
      const y = G * Math.sin(ay);
      emit({ x, y, z: Math.sqrt(Math.max(G * G - x * x - y * y, 0)) });
    }
  }, 16);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey);
    delete document.body.dataset.sim;
  };
}
