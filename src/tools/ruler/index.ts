import { loadJSON, saveJSON } from '../../core/storage';
import { settings } from '../../core/settings';
import type { Tool } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';

const KEY = 'ruler.settings';
/** Ширина банковской карты ISO 7810, мм */
const CARD_MM = 85.6;
/** Типичное значение Android: 160 CSS-пикселей на дюйм */
const DEFAULT_PX_MM = 160 / 25.4;

export default async function createRuler(root: HTMLElement): Promise<Tool> {
  const saved = await loadJSON<{ pxMm?: number }>(KEY, {});
  let pxMm = saved.pxMm && saved.pxMm > 2 && saved.pxMm < 15 ? saved.pxMm : DEFAULT_PX_MM;

  const q = mount(
    root,
    `<section class="ruler">
      <canvas data-id="cv"></canvas>
      <div class="ru-info"><div class="note" data-id="info"></div>
        <button type="button" class="btn" data-id="cal">Калибровка</button></div>
      <div class="ru-cal box" data-id="calbox" hidden>
        <div class="note">Приложите банковскую карту к полосе и подгоните ширину, чтобы края совпали.</div>
        <div class="ru-card" data-id="card"></div>
        <input type="range" data-id="slider" min="200" max="900" step="1">
        <div class="btns"><button type="button" class="btn primary" data-id="save">Сохранить</button>
          <button type="button" class="btn" data-id="reset">Сброс</button></div>
      </div>
    </section>`,
  );
  const cv = q<HTMLCanvasElement>('cv');
  const slider = q<HTMLInputElement>('slider');
  const card = q('card');
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const imperial = settings().lenUnit === 'ft';

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue('--fg').trim();
    const muted = css.getPropertyValue('--muted').trim();
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    // шаг делений в пикселях, длина малого деления, подпись каждые N делений
    const step = imperial ? (pxMm * 25.4) / 8 : pxMm;
    const perLabel = imperial ? 8 : 10;
    const tickLen = (i: number) =>
      i % perLabel === 0 ? 26 : imperial ? (i % 4 === 0 ? 20 : i % 2 === 0 ? 14 : 9) : i % 5 === 0 ? 18 : 10;

    const ruler = (len: number, vertical: boolean) => {
      for (let i = 0; i * step <= len; i++) {
        const p = i * step;
        const t = tickLen(i);
        ctx.strokeStyle = i % perLabel === 0 ? fg : muted;
        ctx.lineWidth = i % perLabel === 0 ? 1.5 : 1;
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(0, p);
          ctx.lineTo(t, p);
        } else {
          ctx.moveTo(p, 0);
          ctx.lineTo(p, t);
        }
        ctx.stroke();
        if (i % perLabel === 0 && i > 0) {
          ctx.fillStyle = fg;
          const label = String(i / perLabel);
          if (vertical) ctx.fillText(label, 32, p - 6);
          else ctx.fillText(label, p - 3, 30);
        }
      }
    };
    ruler(h, true);
    ruler(w, false);
    ctx.fillStyle = muted;
    ctx.fillText(imperial ? 'дюймы' : 'см', 56, 56);
  };

  const info = () => {
    q('info').textContent = `Масштаб ${pxMm.toFixed(2)} px/мм · ${imperial ? 'дюймы' : 'сантиметры'}. Для точности откалибруйте по карте.`;
  };

  const syncCal = () => {
    card.style.width = `${slider.value}px`;
  };

  q('cal').addEventListener('click', () => {
    const box = q('calbox');
    box.hidden = !box.hidden;
    slider.value = String(Math.round(pxMm * CARD_MM));
    syncCal();
  });
  slider.addEventListener('input', syncCal);
  q('save').addEventListener('click', () => {
    pxMm = Number(slider.value) / CARD_MM;
    void saveJSON(KEY, { pxMm });
    q('calbox').hidden = true;
    info();
    draw();
    toast('Калибровка сохранена');
  });
  q('reset').addEventListener('click', () => {
    pxMm = DEFAULT_PX_MM;
    void saveJSON(KEY, { pxMm });
    slider.value = String(Math.round(pxMm * CARD_MM));
    syncCal();
    info();
    draw();
  });

  const ro = new ResizeObserver(draw);
  ro.observe(cv);
  info();
  draw();

  return {
    unmount() {
      ro.disconnect();
      root.replaceChildren();
    },
  };
}
