import { scope } from '../../core/actions';
import { loadAim, saveAim } from '../../core/aim';
import { t } from '../../core/i18n';
import { attachCamera, detachCamera, setTorch } from '../../core/camera';
import { loadCalib } from '../../core/calib';
import { subscribeGravity } from '../../core/sensors';
import type { Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { cameraElevation } from '../../core/orient';
import { meanStd, zOffsetFromFlipped } from './math';
import './aim.css';

const G = 9.80665;
/** Масштаб шкалы-«ленты», px на градус (в системе viewBox ленты). */
const PX_DEG = 6;
const TAPE_H = 240;
/** Окно усреднения замера, мс */
const WINDOW_MS = 450;

export interface Mark {
  id: string;
  label: string;
  elev: number;
}

export interface AimView {
  q: <T extends HTMLElement = HTMLElement>(id: string) => T;
  /** Текущее возвышение оси камеры (сглаженное) или null, пока нет данных. */
  elevation(): number | null;
  /** Среднее и разброс за последние ~0.45 с — именно это фиксируется при замере. */
  sample(): { mean: number; std: number } | null;
  /** Проверка и усреднение для кнопки «замер»: null + тост, если телефон дрожит. */
  capture(): number | null;
  setMarks(marks: Mark[]): void;
  /** Вызывается на каждый кадр отрисовки после обновления шкалы. */
  onFrame(cb: () => void): void;
  /** Заморозить / продолжить картинку камеры. Возвращает новое состояние «заморожено». */
  toggleFreeze(): boolean;
  dispose(): void;
}

function tapeSvg(): string {
  let s = '';
  for (let d = -90; d <= 90; d++) {
    const y = TAPE_H / 2 - d * PX_DEG;
    const x1 = d % 10 === 0 ? 38 : d % 5 === 0 ? 44 : 50;
    s += `<line class="tk${d % 10 === 0 ? ' big' : ''}" x1="${x1}" y1="${y}" x2="56" y2="${y}"/>`;
    if (d % 10 === 0) s += `<text class="tl" x="16" y="${y + 3.5}">${d > 0 ? '+' : ''}${d}</text>`;
  }
  // линия горизонта (0°) через всю ленту
  s += `<line class="hz" x1="12" y1="${TAPE_H / 2}" x2="58" y2="${TAPE_H / 2}"/>`;
  return s;
}

/**
 * Общий «прицел на камере» для высотомера и дальномера: видео, перекрестие в центре кадра
 * (это и есть оптическая ось), шкала возвышения, фонарик, калибровка горизонта.
 * Не зависит от угла обзора камеры: измеряется угол оси, а не положение точки на картинке.
 */
export async function createAimView(
  root: HTMLElement,
  panelHtml: string,
  tipHtml: string,
): Promise<AimView> {
  const calib = await loadCalib();
  const aim = await loadAim();

  const q = mount(
    root,
    `<section class="camsight">
      <div class="cs-view">
        <video data-id="video" playsinline muted autoplay></video>
        <svg class="cs-cross" viewBox="-60 -60 120 120" aria-hidden="true">
          <path d="M-52 0H-12M12 0H52M0 -52V-12M0 12V52"/>
          <circle r="2.2" class="dot"/>
          <circle r="30" class="ring"/>
        </svg>
        <svg class="cs-tape" viewBox="0 0 100 ${TAPE_H}" aria-hidden="true">
          <g data-id="tape">${tapeSvg()}<g data-id="marks"></g></g>
          <path class="ptr" d="M0 ${TAPE_H / 2}l12 -7.5v15z"/>
        </svg>
        <div class="cs-top">
          <button type="button" class="cs-btn" data-action="aim.torch" data-id="torch">${t('Вспышка')}</button>
          <div class="cs-chip"><b data-id="ang">—</b><span data-id="stab">${t('угол к горизонту')}</span></div>
        </div>
        <div class="cs-read">
          <div class="big" data-id="res">—</div>
          <div class="note" data-id="how">&nbsp;</div>
        </div>
      </div>
      <div class="cs-ui">
        <div class="cs-panel box">
          ${panelHtml}
          <div class="cs-cal-row">
            <button type="button" class="btn small" data-action="aim.calbtn" data-id="calbtn">${t('Калибровка горизонта')}</button>
            <span class="note" data-id="calinfo"></span>
          </div>
          <div class="cs-cal" data-id="calbox" hidden>
            <div class="note">${t('Нужна ровная поверхность (стол). Положите телефон экраном вверх и нажмите «Замер 1», затем переверните экраном вниз и нажмите «Замер 2». Это убирает смещение нуля датчика.')}</div>
            <div class="btns">
              <button type="button" class="btn" data-action="aim.cal1" data-id="cal1">${t('Замер 1: экраном вверх')}</button>
              <button type="button" class="btn" data-action="aim.cal2" data-id="cal2">${t('Замер 2: экраном вниз')}</button>
            </div>
            <div class="btns"><button type="button" class="btn" data-action="aim.calreset">${t('Сбросить')}</button></div>
          </div>
        </div>
        <div class="note cs-tip">${tipHtml}</div>
      </div>
    </section>`,
  );

  const video = q<HTMLVideoElement>('video');
  const tape = root.querySelector<SVGGElement>('[data-id="tape"]') as SVGGElement;
  const marksG = root.querySelector<SVGGElement>('[data-id="marks"]') as SVGGElement;

  let camOk = true;
  await attachCamera(video).catch(() => {
    camOk = false;
    q('torch').setAttribute('disabled', '');
    q('how').textContent = t('Нет доступа к камере — разрешите её в настройках приложения');
  });

  let torchOn = false;
  const toggleTorch = () => {
    torchOn = !torchOn;
    void setTorch(torchOn).then((ok) => {
      if (!ok && torchOn) {
        torchOn = false;
        toast(t('Подсветка недоступна'));
      }
      q('torch').classList.toggle('on', torchOn);
    });
  };

  // ---------- датчик ----------
  let g: Vec3 | null = null;
  let elev: number | null = null;
  const win: Array<{ t: number; e: number }> = [];
  let frameCb: (() => void) | null = null;

  const unsub = subscribeGravity((v) => {
    g = v;
    const e = cameraElevation(v, calib, aim.zoff);
    elev = e;
    const now = performance.now();
    win.push({ t: now, e });
    while (win.length > 1 && now - win[0].t > WINDOW_MS) win.shift();
  });

  const sample = () => (win.length ? meanStd(win.map((w) => w.e)) : null);

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (elev === null) return;
    tape.setAttribute('transform', `translate(0 ${(elev * PX_DEG).toFixed(2)})`);
    q('ang').textContent = `${elev < 0 ? '−' : '+'}${Math.abs(elev).toFixed(1)}°`;
    const s = sample();
    if (s) {
      const steady = s.std < 0.15;
      q('stab').textContent = steady ? t('стабильно') : t('разброс ±{0}°', s.std.toFixed(1));
      q('stab').classList.toggle('ok', steady);
    }
    frameCb?.();
  };
  raf = requestAnimationFrame(frame);

  // ---------- калибровка горизонта ----------
  const zOf = () => g?.z ?? 0;
  let zUp: number | null = null;
  let zDown: number | null = null;

  const showCalInfo = () => {
    const deg = (Math.asin(Math.max(-1, Math.min(1, aim.zoff / G))) * 180) / Math.PI;
    q('calinfo').textContent =
      aim.zoff === 0 ? t('не калибровался') : t('поправка {0}{1}°', deg >= 0 ? '+' : '−', Math.abs(deg).toFixed(2));
  };
  showCalInfo();

  const toggleCalBox = () => {
    const box = q('calbox');
    box.hidden = !box.hidden;
  };

  const measureZ = (): Promise<number | null> =>
    new Promise((resolve) => {
      const zs: number[] = [];
      const t0 = performance.now();
      const timer = window.setInterval(() => {
        zs.push(zOf());
        if (performance.now() - t0 >= 1200) {
          window.clearInterval(timer);
          const { mean, std } = meanStd(zs);
          resolve(std < 0.08 ? mean : null);
        }
      }, 30);
    });

  const finishCal = async () => {
    if (zUp === null || zDown === null) return;
    const off = zOffsetFromFlipped(zUp, zDown);
    if (off === null || Math.abs(off) > 1.5) {
      toast(t('Не получилось: телефон должен лежать ровно, сначала экраном вверх'));
    } else {
      aim.zoff = off;
      await saveAim(aim);
      toast(t('Горизонт откалиброван'));
      showCalInfo();
    }
    zUp = zDown = null;
    q('cal1').classList.remove('on');
    q('cal2').classList.remove('on');
  };

  const calStep = (id: 'cal1' | 'cal2', up: boolean) => {
    if (!g) {
      toast(t('Нет данных с датчика'));
      return;
    }
    void measureZ().then((z) => {
      if (z === null) {
        toast(t('Телефон двигается — положите ровно и повторите'));
        return;
      }
      if (up) zUp = z;
      else zDown = z;
      q(id).classList.add('on');
      void finishCal();
    });
  };
  const calReset = () => {
    aim.zoff = 0;
    void saveAim(aim);
    showCalInfo();
    toast(t('Калибровка горизонта сброшена'));
  };
  const sc = scope()
    .on('aim.torch', toggleTorch)
    .on('aim.calbtn', toggleCalBox)
    .on('aim.cal1', () => calStep('cal1', true))
    .on('aim.cal2', () => calStep('cal2', false))
    .on('aim.calreset', calReset);

  // ---------- публичный интерфейс ----------
  let frozen = false;

  return {
    q,
    elevation: () => elev,
    sample,
    capture() {
      const s = sample();
      if (!s || elev === null) {
        toast(t('Нет данных с датчика'));
        return null;
      }
      if (s.std > 1) {
        toast(t('Телефон двигается — удержите прицел и повторите'));
        return null;
      }
      if (s.std > 0.4) toast(t('Телефон дрожит — результат менее точный'));
      return s.mean;
    },
    setMarks(marks) {
      marksG.innerHTML = marks
        .map((m) => {
          const y = TAPE_H / 2 - m.elev * PX_DEG;
          return `<g class="mk"><line x1="12" y1="${y}" x2="58" y2="${y}"/><text x="61" y="${y + 3.5}">${m.label}</text></g>`;
        })
        .join('');
    },
    onFrame(cb) {
      frameCb = cb;
    },
    toggleFreeze() {
      if (!camOk) return false;
      frozen = !frozen;
      if (frozen) video.pause();
      else void video.play().catch(() => undefined);
      return frozen;
    },
    dispose() {
      cancelAnimationFrame(raf);
      sc.dispose();
      unsub();
      detachCamera(video);
      root.replaceChildren();
    },
  };
}
