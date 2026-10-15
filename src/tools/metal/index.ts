import { scope } from '../../core/actions';
import { tick } from '../../core/haptics';
import { t } from '../../core/i18n';
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
        <div class="note" data-id="sub">${t('Ожидание датчика…')}</div></div>
      <div class="meter"><i data-id="bar"></i></div>
      <div class="big verdict" data-id="verdict">&nbsp;</div>
      <div class="note left">${t('Чувствительность')}</div>
      <div class="seg" data-id="seg">
        <button type="button" data-action="metal.range" data-r="20">${t('Низкая')}</button>
        <button type="button" data-action="metal.range" data-r="8">${t('Средняя')}</button>
        <button type="button" data-action="metal.range" data-r="3">${t('Высокая')}</button>
      </div>
      <div class="btns">
        <button type="button" class="btn primary" data-action="metal.zero">${t('Обнулить')}</button>
        <button type="button" class="btn" data-action="metal.sound" data-id="sound">${t('Звук')}</button>
      </div>
      <div class="note" data-id="tip">${t('Отведите телефон от металла и нажмите «Обнулить», затем медленно проводите над поверхностью, не меняя наклон. Датчик реагирует на железо, сталь и магниты; цветные металлы (медь, алюминий, золото) не определяются. Это не замена профессиональному детектору проводки и арматуры.')}</div>
    </section>`,
  );

  let b = 0;
  let base = NaN;
  let alive = false;
  let lastBuzz = 0;
  let lastMag = performance.now();
  let raf = 0;

  const unsub = subscribeMag(
    (m) => {
      const n = Math.hypot(m.x, m.y, m.z);
      const now = performance.now();
      const dt = Math.min(0.2, Math.max(0.001, (now - lastMag) / 1000));
      lastMag = now;
      // постоянные времени в секундах, не «на отсчёт»: сглаживание 0.1 с, дрейф опорного уровня 20 с
      b = b ? b + (n - b) * (1 - Math.exp(-dt / 0.1)) : n;
      base = Number.isNaN(base) ? b : base + (b - base) * (1 - Math.exp(-dt / 20));
      alive = true;
    },
    () => {
      q('sub').textContent = t('На этом устройстве нет магнитометра');
      q('tip').textContent = t('Металлоискатель работает только при наличии магнитного датчика.');
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
    q('sub').textContent = t('поле {0} µT', b.toFixed(1));
    q('bar').style.width = `${(sig * 100).toFixed(0)}%`;
    q('verdict').textContent = sig > 0.6 ? t('Металл рядом') : sig > 0.25 ? t('Слабый сигнал') : t('Чисто');
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

  const sc = scope()
    .on('metal.range', (el) => {
      range = Number(el.dataset.r);
      void saveJSON(KEY, { range });
      markSeg();
    })
    .on('metal.zero', () => {
      if (!alive) {
        toast(t('Нет данных с датчика'));
        return;
      }
      base = b;
      toast(t('Обнулено'));
    })
    .on('metal.sound', () => {
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
      sc.dispose();
      root.replaceChildren();
    },
  };
}
