/**
 * Свайпы по правилам контракта 1.4: минимальный сдвиг 64 px (быстрый бросок — 40 px за ≤ 240 мс);
 * направление блокируется после 12 px; основная ось ≥ вдвое больше поперечной; жест не длиннее 1 с;
 * зона системного «назад» 24 px у края не используется; пауза между срабатываниями 350 мс;
 * второй палец отменяет жест. Детектор не знает про DOM — проверяется tests/gestures.test.mjs.
 */
export const SWIPE = { minDist: 64, flickDist: 40, flickMs: 240, lockPx: 12, dominance: 2, maxMs: 1000, edgePx: 24, pauseMs: 350 } as const;

export type SwipeDir = 'left' | 'right' | 'up' | 'down';
export type Axes = 'x' | 'y' | 'xy';

export class SwipeDetector {
  private id: number | null = null;
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  private lock: 'x' | 'y' | null = null;
  private dead = false;
  private lastFire = -Infinity;
  private fingers = 0;

  constructor(private readonly o: { axes: Axes; width: () => number }) {}

  down(id: number, x: number, y: number, t: number): boolean {
    this.fingers++;
    if (this.fingers > 1) {
      this.dead = true; // второй палец отменяет жест
      return false;
    }
    this.id = id;
    this.x0 = x;
    this.y0 = y;
    this.t0 = t;
    this.lock = null;
    this.dead = false;
    const w = this.o.width();
    if (this.o.axes !== 'y' && (x < SWIPE.edgePx || x > w - SWIPE.edgePx)) {
      this.dead = true;
      return false;
    }
    return true;
  }

  move(id: number, x: number, y: number): { lock: 'x' | 'y' | null; dx: number; dy: number } {
    const dx = x - this.x0;
    const dy = y - this.y0;
    if (id !== this.id || this.dead) return { lock: null, dx: 0, dy: 0 };
    if (!this.lock && Math.hypot(dx, dy) >= SWIPE.lockPx) {
      const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (this.o.axes !== 'xy' && this.o.axes !== axis) this.dead = true;
      else this.lock = axis;
    }
    return { lock: this.dead ? null : this.lock, dx, dy };
  }

  up(id: number, x: number, y: number, t: number): SwipeDir | null {
    this.fingers = Math.max(0, this.fingers - 1);
    if (id !== this.id) return null;
    this.id = null;
    if (this.dead || !this.lock) return null;
    const dx = x - this.x0;
    const dy = y - this.y0;
    const dt = t - this.t0;
    const main = this.lock === 'x' ? dx : dy;
    const cross = this.lock === 'x' ? dy : dx;
    if (dt > SWIPE.maxMs) return null;
    if (Math.abs(main) < SWIPE.dominance * Math.abs(cross)) return null;
    const dist = Math.abs(main);
    if (!(dist >= SWIPE.minDist || (dist >= SWIPE.flickDist && dt <= SWIPE.flickMs))) return null;
    if (t - this.lastFire < SWIPE.pauseMs) return null;
    this.lastFire = t;
    return this.lock === 'x' ? (main < 0 ? 'left' : 'right') : main < 0 ? 'up' : 'down';
  }

  cancel(): void {
    this.id = null;
    this.dead = true;
    this.fingers = 0;
  }
}

export interface SwipeBinding {
  axes: Axes;
  onSwipe: (dir: SwipeDir) => void;
  /** Палец тащит по заблокированной оси (окна, которые едут за пальцем). */
  onDrag?: (axis: 'x' | 'y', dx: number, dy: number) => void;
  /** Жест закончился без свайпа. */
  onRelease?: () => void;
}

export function bindSwipe(el: HTMLElement, b: SwipeBinding): () => void {
  const det = new SwipeDetector({ axes: b.axes, width: () => window.innerWidth });
  let active = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = det.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
  };
  const move = (e: PointerEvent) => {
    if (!active) return;
    const r = det.move(e.pointerId, e.clientX, e.clientY);
    if (r.lock) b.onDrag?.(r.lock, r.dx, r.dy);
  };
  const up = (e: PointerEvent) => {
    const dir = det.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    const was = active;
    active = false;
    if (dir) b.onSwipe(dir);
    else if (was) b.onRelease?.();
  };
  const cancel = () => {
    det.cancel();
    if (active) b.onRelease?.();
    active = false;
  };
  el.addEventListener('pointerdown', down, { passive: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', up, { passive: true });
  el.addEventListener('pointercancel', cancel, { passive: true });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
