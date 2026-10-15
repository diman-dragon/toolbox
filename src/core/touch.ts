/**
 * Пока палец на экране, фоновые обновления (живые списки, таймеры, статусы) пропускаются и
 * выполняются через 500 мс после отпускания (контракт 1.4). Показания приборов — это содержимое
 * экрана, а не «фон», они идут всегда.
 */
export const RESUME_MS = 500;

export class TouchGate {
  private down = new Set<number>();
  private quietUntil = 0;
  private pending = new Map<string, () => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly now: () => number = () => Date.now()) {}

  pointerDown(id: number): void {
    this.down.add(id);
  }

  pointerUp(id: number): void {
    this.down.delete(id);
    if (this.down.size === 0) {
      this.quietUntil = this.now() + RESUME_MS;
      this.schedule();
    }
  }

  get touching(): boolean {
    return this.down.size > 0 || this.now() < this.quietUntil;
  }

  /** Выполнить сейчас, если палец не на экране; иначе — через 500 мс после отпускания (последнее по ключу). */
  whenIdle(key: string, fn: () => void): void {
    if (!this.touching) {
      this.pending.delete(key);
      fn();
      return;
    }
    this.pending.set(key, fn);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), Math.max(0, this.quietUntil - this.now()) + 5);
  }

  flush(): void {
    if (this.touching) {
      if (this.down.size === 0) this.schedule();
      return;
    }
    const jobs = [...this.pending.values()];
    this.pending.clear();
    for (const j of jobs) j();
  }
}

const gate = new TouchGate();
export const isTouching = (): boolean => gate.touching;
export const whenIdle = (key: string, fn: () => void): void => gate.whenIdle(key, fn);

export function initTouch(doc: Document = document): void {
  doc.addEventListener('pointerdown', (e) => gate.pointerDown(e.pointerId), { capture: true, passive: true });
  for (const t of ['pointerup', 'pointercancel'] as const)
    doc.addEventListener(t, (e) => gate.pointerUp(e.pointerId), { capture: true, passive: true });
}
