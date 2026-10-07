import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { Vec3 } from './types';

interface MagPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(ev: 'mag', cb: (v: Vec3) => void): Promise<PluginListenerHandle>;
}
/** Нативный плагин (native-src/MagnetometerPlugin.java.tpl), ставится скриптом patch-android.sh. */
const Mag = registerPlugin<MagPlugin>('Magnetometer');

interface WebMag {
  x: number;
  y: number;
  z: number;
  start(): void;
  stop(): void;
  addEventListener(t: string, f: () => void): void;
}

/**
 * Подписка на магнитометр (мкТл). onUnavailable вызывается, если датчика нет.
 * В браузере: Generic Sensor API, иначе через 1.5 с симулятор (мышь — азимут, M — «металл»).
 */
export function subscribeMag(cb: (v: Vec3) => void, onUnavailable: () => void): () => void {
  const native = Capacitor.isNativePlatform();
  let stopped = false;
  let got = false;
  let handle: PluginListenerHandle | null = null;
  let sensor: WebMag | null = null;
  let stopSim: (() => void) | null = null;
  let timer: number | undefined;

  const emit = (v: Vec3) => {
    got = true;
    cb(v);
  };

  if (native) {
    void (async () => {
      try {
        const h = await Mag.addListener('mag', emit);
        if (stopped) {
          void h.remove();
          return;
        }
        handle = h;
        await Mag.start();
      } catch {
        if (!stopped) onUnavailable();
      }
    })();
  } else {
    const M = (window as unknown as { Magnetometer?: new (o: { frequency: number }) => WebMag })
      .Magnetometer;
    try {
      if (M) {
        const s = new M({ frequency: 30 });
        s.addEventListener('reading', () => emit({ x: s.x, y: s.y, z: s.z }));
        s.addEventListener('error', () => undefined);
        s.start();
        sensor = s;
      }
    } catch {
      /* нет доступа к датчику */
    }
    timer = window.setTimeout(() => {
      if (!got && !stopped) stopSim = startSim(emit);
    }, 1500);
  }

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    if (handle) void handle.remove();
    if (native) void Mag.stop().catch(() => undefined);
    try {
      sensor?.stop();
    } catch {
      /* уже остановлен */
    }
    stopSim?.();
  };
}

function startSim(emit: (v: Vec3) => void): () => void {
  document.body.dataset.sim = '1';
  let yaw = 0;
  let metal = false;
  const onMove = (e: PointerEvent) => {
    yaw = ((e.clientX / window.innerWidth) * 2 - 1) * Math.PI;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'm') metal = !metal;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey);
  const timer = window.setInterval(() => {
    const k = 1 + (metal ? 0.6 : 0) + (Math.random() - 0.5) * 0.01;
    emit({ x: -25 * Math.sin(yaw) * k, y: 25 * Math.cos(yaw) * k, z: -40 * k });
  }, 33);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('keydown', onKey);
    delete document.body.dataset.sim;
  };
}
