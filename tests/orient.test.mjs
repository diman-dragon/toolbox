import { strict as assert } from 'node:assert';
import { load } from './helpers.mjs';
const O = await load('src/core/orient.ts');
const F = await load('src/core/filter.ts');
const G = 9.80665, D2R = Math.PI / 180;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);
const flat = (a, b) => ({ x: G * Math.sin(a * D2R), y: G * Math.sin(b * D2R), z: G * Math.sqrt(1 - Math.sin(a * D2R) ** 2 - Math.sin(b * D2R) ** 2) });
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };

export const tests = {
  'tilts: ровно лёжа — нули'() { const t = O.tilts({ x: 0, y: 0, z: G }); near(t.tx, 0, 1e-9, 'tx'); near(t.slope, 0, 1e-9, 'slope'); near(t.flatness, 1, 1e-9, 'flat'); },
  'tilts: наклон по двум осям — угол плоскости, а не гипотенуза углов'() { near(O.tilts({ x: 0.5 * G, y: 0.5 * G, z: Math.SQRT1_2 * G }).slope, 45, 1e-9, 'slope'); },
  'tilts: 0.1° различимы'() { near(O.tilts(flat(0.1, 0)).slope, 0.1, 1e-6, 'slope'); },
  'calibrate: ровное положение с офсетом даёт ноль, длина сохранена'() {
    const v = flat(0.6, -0.4); const w = O.calibrate(v, { ox: 0.6, oy: -0.4, invert: false });
    near(O.tilts(w).tx, 0, 1e-6, 'tx'); near(O.tilts(w).ty, 0, 1e-6, 'ty'); near(O.norm(w), O.norm(v), 1e-9, 'норма');
  },
  'calibrate: верно и когда телефон стоит (угломер)'() {
    const ox = 0.5, roll = 30 * D2R, a = ox * D2R;
    const ideal = { x: G * Math.sin(roll), y: G * Math.cos(roll), z: 0 };
    const raw = { x: ideal.x * Math.cos(a) + ideal.z * Math.sin(a), y: ideal.y, z: -ideal.x * Math.sin(a) + ideal.z * Math.cos(a) };
    near(O.inPlaneAngle(O.calibrate(raw, { ox, oy: 0, invert: false }), 0), 30, 1e-6, 'угол');
  },
  'calibrate: invert'() { assert.deepEqual(O.calibrate({ x: 1, y: 2, z: 3 }, { ox: 0, oy: 0, invert: true }), { x: -1, y: -2, z: -3 }); },
  'калибровка по двум положениям отделяет наклон стола от смещения датчика'() {
    const r = O.calibrateTwoPosition(flat(0.4 + 0.7, -0.25 + 0.3), flat(0.4 - 0.7, -0.25 - 0.3));
    near(r.ox, 0.4, 1e-6, 'ox'); near(r.oy, -0.25, 1e-6, 'oy'); near(r.surface, Math.hypot(0.7, 0.3), 1e-6, 'surface');
  },
  'калибровка отвергает неровное положение'() { assert.equal(O.calibrateTwoPosition(flat(20, 0), flat(0, 0)), null); },
  'screenTilts: повороты экрана'() {
    const up = flat(5, 0);
    near(O.screenTilts(up, 0).sx, 5, 1e-6, '0'); near(O.screenTilts(up, 180).sx, -5, 1e-6, '180');
    near(O.screenTilts(up, 90).sy, 5, 1e-6, '90'); near(O.screenTilts(up, 270).sy, -5, 1e-6, '270');
  },
  'inPlaneAngle: знак и диапазон'() {
    const r = 20 * D2R; near(O.inPlaneAngle({ x: G * Math.sin(r), y: G * Math.cos(r), z: 0 }, 0), 20, 1e-9, 'портрет');
    near(O.inPlaneAngle({ x: 0, y: -G, z: 0 }, 0), 180, 1e-9, '180'); near(O.inPlaneAngle({ x: -G, y: 0, z: 0 }, 0), -90, 1e-9, '-90');
  },
  'inPlaneAngle: наклон от себя не влияет'() {
    const r = 20 * D2R, l = 25 * D2R;
    near(O.inPlaneAngle({ x: G * Math.cos(l) * Math.sin(r), y: G * Math.cos(l) * Math.cos(r), z: G * Math.sin(l) }, 0), 20, 1e-9, 'угол');
  },
  'edgeTilt: на длинном ребре и на коротком'() {
    const a = O.edgeTilt({ x: G * Math.cos(2 * D2R), y: G * Math.sin(2 * D2R), z: 0 }, 0, false); assert.equal(a.swapped, true); near(a.tilt, 2, 1e-6, 'длинное');
    const b = O.edgeTilt({ x: G * Math.sin(3 * D2R), y: G * Math.cos(3 * D2R), z: 0 }, 0, false); assert.equal(b.swapped, false); near(b.tilt, 3, 1e-6, 'короткое');
  },
  'cameraElevation: горизонт, вниз, вверх, на пол, zoff'() {
    const c = { ox: 0, oy: 0, invert: false }, k = Math.cos(30 * D2R), s = Math.sin(30 * D2R);
    near(O.cameraElevation({ x: 0, y: G, z: 0 }, c, 0), 0, 1e-9, 'горизонт'); near(O.cameraElevation({ x: 0, y: G * k, z: G * s }, c, 0), -30, 1e-9, 'вниз');
    near(O.cameraElevation({ x: 0, y: G * k, z: -G * s }, c, 0), 30, 1e-9, 'вверх'); near(O.cameraElevation({ x: 0, y: 0, z: G }, c, 0), -90, 1e-9, 'пол');
    near(O.cameraElevation({ x: 0, y: G, z: 0.1 }, c, 0.1), 0, 1e-9, 'zoff');
  },
  'normalize180 и distToSnap'() { near(O.normalize180(190), -170, 1e-9, ''); near(O.normalize180(-180), 180, 1e-9, ''); near(O.distToSnap(44.8), 0.2, 1e-9, ''); near(O.distToSnap(-0.2), 0.2, 1e-9, ''); },
  'фильтр: шум в покое падает минимум в 3.5 раза на 30/60/200 Гц'() {
    for (const hz of [30, 60, 200]) {
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
      const f = new F.GravityFilter(); const raw = [], out = [];
      for (let i = 0; i < hz * 6; i++) { const v = { x: 0.06 * rnd(), y: 0.06 * rnd(), z: G }; const s = f.push(v, (i * 1000) / hz); if (i > hz * 2) { raw.push(O.tilts(v).tx); out.push(O.tilts(s).tx); } }
      assert.ok(sd(out) < sd(raw) / 3.5, `${hz} Гц: ${sd(out).toFixed(4)}° против ${sd(raw).toFixed(4)}°`);
    }
  },
  'фильтр: поворот на 20° догоняется быстрее 0.6 с'() {
    const f = new F.GravityFilter(), hz = 60; let t = 0;
    for (let i = 0; i < hz; i++, t += 1000 / hz) f.push({ x: 0, y: 0, z: G }, t);
    let reach = -1;
    for (let i = 0; i < hz * 2; i++, t += 1000 / hz) { const s = f.push(flat(20, 0), t); if (reach < 0 && Math.abs(O.tilts(s).tx - 20) < 0.5) reach = (i * 1000) / hz; }
    assert.ok(reach >= 0 && reach < 600, `за ${reach} мс`);
  },
  'stableRound: цифра не мерцает на границе округления'() {
    let shown = null, ch = 0;
    for (let i = 0; i < 200; i++) { const n = F.stableRound(shown, 0.35 + 0.02 * Math.sin(i * 1.7), 0.1); if (n !== shown) ch++; shown = n; }
    assert.ok(ch <= 2, `смен: ${ch}`);
  },
  'hysteresis: порог не дребезжит'() {
    let on = false, fl = 0;
    for (let i = 0; i < 200; i++) { const n = F.hysteresis(on, 0.25 + 0.04 * Math.sin(i * 2.3), 0.2, 0.35); if (n !== on) fl++; on = n; }
    assert.ok(fl <= 2, `переключений: ${fl}`);
  },
  'dampAngle: через 0/360 по короткой дуге'() { const a = F.dampAngle(359, 1, 0.1, 0.1); assert.ok(a > 359 || a < 1.5, `${a}`); },
};
