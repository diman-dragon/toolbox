import { tick } from '../../core/haptics';
import { subscribeMag } from '../../core/magnetometer';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';

const KEY = 'metal.settings';
/** Диапазон шкалы (мкТл) для режимов чувствительности */
const RANGES = [20, 8, 3];

export default async function createMetal(root: HTMLElement): Promise<Tool> {
  const saved = await loadJSON<{ range?: number }>(KEY, {});
  let range = RANGES.includes(saved.range ?? 0) ? (saved.range as number) : 8;

  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="big" data-id="val">0.0 µT</div>
        <div class="note" data-id="sub">Ожидание датчика…</div></div>
      <div class="meter"><i data-id="bar"></i></div>
      <div class="big" data-id="verdict" style="font-size:24px">&nbsp;</div>
      <div class="note" style="text-align:left">Чувствительность</div>
      <div class="seg" data-id="seg">
        <button type="button" data-r="20">Низкая</button>
        <button type="button" data-r="8">Средняя</button>
        <button type="button" data-r="3">Высокая</button>
      </div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="zero">Обнулить</button>
        <button type="button" class="btn" data-id="sound">Звук</button>
      </div>
      <div class="note" data-id="tip">Отведите телефон от металла и нажмите «Обнулить», затем медленно проводите над поверхностью, не меняя наклон. Датчик реагирует на железо, сталь и магниты; цветные металлы (медь, алюминий, золото) не определяются. Это не замена профессиональному детектору проводки и арматуры.</div>
    </section>`,
  );

  let b = 0;
  let base = NaN;
  let alive = false;
  let lastBuzz = 0;
  let raf = 0;

  const unsub = subscribeMag(
    (m) => {
      const n = Math.hypot(m.x, m.y, m.z);
      b = b ? b + (n - b) * 0.3 : n;
      // медленный дрейф опорного уровня: за ~20 с подстраивается под обстановку
      base = Number.isNaN(base) ? b : base + (b - base) * 0.0008;
      alive = true;
    },
    () => {
      q('sub').textContent = 'На этом устройстве нет магнитометра';
      q('tip').textContent = 'Металлоискатель работает только при наличии магнитного датчика.';
      for (const el of root.querySelectorAll<HTMLButtonElement>('button')) el.disabled = true;
    },
  );

  // ---------- звук ----------
  let ac: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  const stopSound = () => {
    try {
      osc?.stop();
      void ac?.close();
    } catch {
      /* уже остановлен */
    }
    ac = osc = gain = null;
  };

  const markSeg = () => {
    for (const el of q('seg').querySelectorAll<HTMLElement>('button'))
      el.classList.toggle('on', Number(el.dataset.r) === range);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!alive) return;
    const d = b - base;
    const sig = Math.min(1, Math.abs(d) / range);
    q('val').textContent = `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} µT`;
    q('sub').textContent = `поле ${b.toFixed(1)} µT`;
    q('bar').style.width = `${(sig * 100).toFixed(0)}%`;
    q('verdict').textContent = sig > 0.6 ? 'Металл рядом' : sig > 0.25 ? 'Слабый сигнал' : 'Чисто';
    q('verdict').classList.toggle('good', sig > 0.25);

    const now = performance.now();
    if (sig > 0.5 && now - lastBuzz > 250) {
      lastBuzz = now;
      tick('Light');
    }
    if (ac && osc && gain) {
      osc.frequency.setTargetAtTime(220 + sig * 1100, ac.currentTime, 0.04);
      gain.gain.setTargetAtTime(sig > 0.12 ? 0.06 : 0, ac.currentTime, 0.04);
    }
  };
  raf = requestAnimationFrame(frame);

  q('seg').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    range = Number(el.dataset.r);
    void saveJSON(KEY, { range });
    markSeg();
  });
  q('zero').addEventListener('click', () => {
    if (!alive) {
      toast('Нет данных с датчика');
      return;
    }
    base = b;
    toast('Обнулено');
  });
  q('sound').addEventListener('click', () => {
    if (ac) {
      stopSound();
    } else {
      ac = new AudioContext();
      osc = ac.createOscillator();
      gain = ac.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination);
      osc.start();
    }
    q('sound').classList.toggle('on', !!ac);
  });

  markSeg();
  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsub();
      stopSound();
      root.replaceChildren();
    },
  };
}
