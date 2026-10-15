import { strict as assert } from 'node:assert';
import { load } from './helpers.mjs';
const Gs = await load('src/core/gestures.ts');
const Tc = await load('src/core/touch.ts');
const det = (axes = 'xy') => new Gs.SwipeDetector({ axes, width: () => 400 });
const swipe = (d, x0, y0, x1, y1, dt) => { d.down(1, x0, y0, 0); d.move(1, (x0 + x1) / 2, (y0 + y1) / 2); return d.up(1, x1, y1, dt); };

export const tests = {
  'длинный свайп влево срабатывает'() { assert.equal(swipe(det(), 300, 200, 200, 205, 300), 'left'); },
  'короткий медленный (< 64 px) — нет'() { assert.equal(swipe(det(), 300, 200, 260, 200, 500), null); },
  'быстрый бросок 40 px за ≤ 240 мс — да'() { assert.equal(swipe(det(), 300, 200, 255, 200, 200), 'left'); },
  'диагональ (не вдвое по главной оси) — нет'() { assert.equal(swipe(det(), 200, 200, 280, 260, 300), null); },
  'дольше 1 с — нет'() { assert.equal(swipe(det(), 300, 200, 150, 200, 1200), null); },
  'зона системного «назад» у края — нет'() { assert.equal(swipe(det('x'), 10, 200, 150, 200, 300), null); },
  'ось y: горизонтальный жест игнорируется'() { assert.equal(swipe(det('y'), 300, 200, 150, 200, 300), null); },
  'вниз по оси y'() { assert.equal(swipe(det('y'), 200, 100, 205, 260, 300), 'down'); },
  'второй палец отменяет'() { const d = det(); d.down(1, 300, 200, 0); d.down(2, 100, 100, 10); assert.equal(d.up(1, 150, 200, 300), null); },
  'пауза 350 мс между срабатываниями'() {
    const d = det();
    assert.equal(swipe(d, 300, 200, 200, 200, 300), 'left');
    d.down(1, 300, 200, 400); d.move(1, 250, 200);
    assert.equal(d.up(1, 200, 200, 500), null);
  },
  'TouchGate: пока палец на экране и 500 мс после — фон ждёт'() {
    let now = 0; const g = new Tc.TouchGate(() => now);
    g.pointerDown(1); assert.ok(g.touching);
    g.pointerUp(1); now = 400; assert.ok(g.touching);
    now = 501; assert.ok(!g.touching);
  },
};
