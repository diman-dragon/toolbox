import { scope } from '../../core/actions';
import { t } from '../../core/i18n';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool } from '../../core/types';
import { mount, num } from '../../ui/dom';
import { toast } from '../../ui/toast';
import {
  A_CHAIN,
  aCompensation,
  describe,
  firstOrderCoefs,
  fmtDuration,
  levelDb,
  safeSeconds,
  smoothingK,
} from './math';
import './sound.css';

const KEY = 'sound.settings';
/** Типичная привязка шкалы телефона: 0 dBFS ≈ 90 дБ SPL. Уточняется калибровкой. */
const DEFAULT_OFFSET = 90;
const FFT = 1024;
const HIST_MS = 250;
const HIST_LEN = 240; // 60 с

interface Saved {
  offset: number;
  weighting: 'A' | 'Z';
  speed: 'fast' | 'slow';
}

export default async function createSound(root: HTMLElement): Promise<Tool> {
  const st: Saved = { offset: DEFAULT_OFFSET, weighting: 'A', speed: 'fast', ...(await loadJSON<Partial<Saved>>(KEY, {})) };

  const q = mount(
    root,
    `<section class="snd">
      <div class="readout">
        <div class="db" data-id="db">—</div>
        <div class="unit" data-id="unit">${t('дБ(A)')}</div>
        <div class="desc" data-id="desc">${t('Запуск микрофона…')}</div>
      </div>
      <div class="lvlbar"><i data-id="bar"></i></div>
      <div class="stats">
        <div><b data-id="min">—</b><span>${t('мин')}</span></div>
        <div><b data-id="avg">—</b><span>${t('среднее')}</span></div>
        <div><b data-id="max">—</b><span>${t('макс')}</span></div>
      </div>
      <canvas data-id="cv"></canvas>
      <div class="note" data-id="safe">&nbsp;</div>
      <div class="seg" data-id="wt"><button type="button" data-action="snd.w" data-w="A">dB(A)</button><button type="button" data-action="snd.w" data-w="Z">${t('dB(Z) без взвешивания')}</button></div>
      <div class="seg" data-id="sp"><button type="button" data-action="snd.s" data-s="fast">${t('Fast 125 мс')}</button><button type="button" data-action="snd.s" data-s="slow">${t('Slow 1 с')}</button></div>
      <div class="btns">
        <button type="button" class="btn" data-action="snd.hold" data-id="hold">${t('Пауза')}</button>
        <button type="button" class="btn" data-action="snd.reset">${t('Сбросить мин/макс')}</button>
      </div>
      <div class="box">
        <div class="note left">${t('Калибровка. У каждого телефона своя чувствительность микрофона, поэтому без эталона цифры ориентировочные (±5 дБ и более). Поднесите телефон к эталонному шумомеру и введите его показание.')}</div>
        <div class="cal">
          <button type="button" class="btn" data-action="snd.m1">−1</button>
          <button type="button" class="btn" data-action="snd.p1">+1</button>
          <span class="grow" data-id="off"></span>
          <input class="in" data-id="ref" inputmode="decimal" placeholder="${t('эталон')}">
          <button type="button" class="btn" data-action="snd.fit">${t('Подогнать')}</button>
        </div>
      </div>
      <div class="note">${t('Не является поверенным средством измерений. Шум выше 85 дБ вреден при длительном воздействии.')}</div>
    </section>`,
  );

  const bar = q('bar');
  const cv = q<HTMLCanvasElement>('cv');
  const ctx2d = cv.getContext('2d') as CanvasRenderingContext2D;

  // ---------- микрофон и цепочка A-взвешивания ----------
  let ac: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let anA: AnalyserNode | null = null;
  let anZ: AnalyserNode | null = null;
  let comp = 1;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const fs = ac.sampleRate;

    anZ = ac.createAnalyser();
    anZ.fftSize = FFT;
    src.connect(anZ);

    let node: AudioNode = src;
    for (const s of A_CHAIN) {
      const c = firstOrderCoefs(s, fs);
      const f = ac.createIIRFilter(c.b, c.a);
      node.connect(f);
      node = f;
    }
    comp = aCompensation(fs);
    const g = ac.createGain();
    g.gain.value = comp;
    node.connect(g);
    anA = ac.createAnalyser();
    anA.fftSize = FFT;
    g.connect(anA);
    void ac.resume();
    q('desc').textContent = '';
  } catch {
    q('desc').textContent = t('Нет доступа к микрофону — разрешите его в настройках приложения');
    q('db').textContent = '—';
  }

  // ---------- измерение ----------
  const bufA = new Float32Array(FFT);
  const bufZ = new Float32Array(FFT);
  let pw = 0; // сглаженная мощность
  let held = false;
  let minDb = Infinity;
  let maxDb = -Infinity;
  let sumP = 0;
  let sumT = 0;
  let lastT = performance.now();
  let lastHist = 0;
  const hist: number[] = [];
  let curDb = 0;

  const meanSquare = (a: Float32Array) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    return s / a.length;
  };

  const paintGraph = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--line').trim();
    const acc = css.getPropertyValue('--accent').trim();
    ctx2d.strokeStyle = line;
    ctx2d.lineWidth = 1;
    for (const d of [40, 60, 80, 100]) {
      const y = h - ((d - 20) / 100) * h;
      ctx2d.beginPath();
      ctx2d.moveTo(0, y);
      ctx2d.lineTo(w, y);
      ctx2d.stroke();
    }
    if (hist.length < 2) return;
    ctx2d.strokeStyle = acc;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    hist.forEach((v, i) => {
      const x = (i / (HIST_LEN - 1)) * w;
      const y = h - ((Math.min(120, Math.max(20, v)) - 20) / 100) * h;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    });
    ctx2d.stroke();
  };

  const paint = () => {
    q('db').textContent = curDb.toFixed(0);
    const pct = Math.min(100, Math.max(0, ((curDb - 20) / 100) * 100));
    bar.style.width = `${pct}%`;
    bar.className = curDb >= 85 ? 'hi' : curDb >= 70 ? 'mid' : '';
    q('desc').textContent = describe(curDb);
    q('min').textContent = Number.isFinite(minDb) ? minDb.toFixed(0) : '—';
    q('max').textContent = Number.isFinite(maxDb) ? maxDb.toFixed(0) : '—';
    q('avg').textContent = sumT > 0 ? levelDb(sumP / sumT, st.offset).toFixed(0) : '—';
    const safe = safeSeconds(curDb);
    const el = q('safe');
    el.textContent =
      curDb >= 80
        ? t('Допустимая длительность такого шума: {0}', fmtDuration(safe))
        : t('Уровень безопасен при длительном воздействии');
    el.classList.toggle('warn', curDb >= 85);
  };

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const an = st.weighting === 'A' ? anA : anZ;
    if (!an || held) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastT) / 1000);
    lastT = now;
    const buf = st.weighting === 'A' ? bufA : bufZ;
    an.getFloatTimeDomainData(buf);
    const p = meanSquare(buf);
    pw += (p - pw) * smoothingK(dt, st.speed === 'fast' ? 0.125 : 1);
    curDb = levelDb(pw, st.offset);
    if (p > 0) {
      sumP += p * dt;
      sumT += dt;
    }
    if (curDb > 0) {
      minDb = Math.min(minDb, curDb);
      maxDb = Math.max(maxDb, curDb);
    }
    if (now - lastHist >= HIST_MS) {
      lastHist = now;
      hist.push(curDb);
      if (hist.length > HIST_LEN) hist.shift();
      paintGraph();
    }
    paint();
  };
  if (anA) raf = requestAnimationFrame(frame);

  // ---------- управление ----------
  const save = () => void saveJSON(KEY, st);
  const refresh = () => {
    q('unit').textContent = st.weighting === 'A' ? t('дБ(A)') : t('дБ(Z)');
    for (const b of q('wt').querySelectorAll<HTMLElement>('button'))
      b.classList.toggle('on', b.dataset.w === st.weighting);
    for (const b of q('sp').querySelectorAll<HTMLElement>('button'))
      b.classList.toggle('on', b.dataset.s === st.speed);
    q('hold').classList.toggle('on', held);
    q('hold').textContent = held ? t('Продолжить') : t('Пауза');
    q('off').textContent = t('поправка {0}{1} дБ', st.offset >= 0 ? '+' : '', st.offset.toFixed(1));
  };

  const resetStats = () => {
    minDb = Infinity;
    maxDb = -Infinity;
    sumP = sumT = 0;
  };
  const nudge = (d: number) => {
    st.offset += d;
    save();
    refresh();
  };
  const sc = scope()
    .on('snd.w', (el) => {
      st.weighting = el.dataset.w as 'A' | 'Z';
      resetStats();
      save();
      refresh();
    })
    .on('snd.s', (el) => {
      st.speed = el.dataset.s as 'fast' | 'slow';
      save();
      refresh();
    })
    .on('snd.hold', () => {
      held = !held;
      lastT = performance.now();
      refresh();
    })
    .on('snd.reset', () => {
      resetStats();
      hist.length = 0;
      toast(t('Мин, макс и среднее сброшены'));
    })
    .on('snd.m1', () => nudge(-1))
    .on('snd.p1', () => nudge(1))
    .on('snd.fit', () => {
      const ref = num(q<HTMLInputElement>('ref'));
      if (!(ref > 20 && ref < 140) || curDb <= 0) {
        toast(t('Введите показание эталона от 20 до 140 дБ'));
        return;
      }
      st.offset += ref - curDb;
      pw = 0;
      save();
      refresh();
      toast(t('Поправка сохранена'));
    });

  refresh();
  return {
    unmount() {
      cancelAnimationFrame(raf);
      sc.dispose();
      stream?.getTracks().forEach((t) => t.stop());
      void ac?.close().catch(() => undefined);
      root.replaceChildren();
    },
  };
}
