import { attachCamera, detachCamera, setTorch } from '../../core/camera';
import { scope } from '../../core/actions';
import { locale, t } from '../../core/i18n';
import { confirmSheet } from '../../ui/sheet';
import { tick } from '../../core/haptics';
import { loadJSON, saveJSON } from '../../core/storage';
import type { Tool } from '../../core/types';
import { mount } from '../../ui/dom';
import { toast } from '../../ui/toast';
import { createDecoder, type Decoded, type Decoder, type ScanMode } from './decode';
import { formatName, isSafeHref, parseCode, type Parsed } from './parse';
import './scanner.css';
import '../height/aim.css';

const HIST_KEY = 'scanner.history';
const HIST_MAX = 30;
const MAX_SIDE = 720;
const INTERVAL_MS = 90;

interface Entry {
  text: string;
  format: string;
  ts: number;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export default async function createScanner(root: HTMLElement): Promise<Tool> {
  let history = await loadJSON<Entry[]>(HIST_KEY, []);
  let mode: ScanMode = 'all';

  const q = mount(
    root,
    `<section class="scan" data-id="scan">
      <div class="sc-view">
        <video data-id="video" playsinline muted autoplay></video>
        <div class="sc-frame"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>
        <div class="sc-top">
          <button type="button" class="cs-btn" data-action="scan.torch" data-id="torch">${t('Вспышка')}</button>
          <button type="button" class="cs-btn" data-action="scan.photo">${t('Из фото')}</button>
          <button type="button" class="cs-btn" data-action="scan.hist">${t('История')}</button>
          <input type="file" accept="image/*" data-id="file" hidden>
        </div>
        <div class="sc-hint" data-id="hint">${t('Наведите камеру на QR-код или штрихкод')}</div>
      </div>
      <div class="sc-ui">
        <div class="seg" data-id="modes">
          <button type="button" data-action="scan.mode" data-m="all">${t('Все коды')}</button>
          <button type="button" data-action="scan.mode" data-m="qr">QR</button>
          <button type="button" data-action="scan.mode" data-m="bar">${t('Штрихкод')}</button>
        </div>
      </div>
      <div class="sc-ui sc-res box" data-id="res" hidden></div>
      <div class="sc-ui sc-hist" data-id="hist" hidden></div>
    </section>`,
  );

  const section = q('scan');
  const video = q<HTMLVideoElement>('video');
  const canvas = document.createElement('canvas');
  const cctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  let camOk = true;
  await attachCamera(video).catch(() => {
    camOk = false;
    q('hint').textContent = t('Нет доступа к камере — разрешите её в настройках приложения или используйте «Из фото»');
    q('torch').setAttribute('disabled', '');
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

  // ---------- результат ----------
  const saveHist = () => void saveJSON(HIST_KEY, history);

  let copyText = '';
  const showResult = (d: Decoded, fromHistory = false) => {
    const p: Parsed = parseCode(d.text, d.format);
    section.classList.add('found');
    paused = true;
    video.pause();
    tick('Medium');
    if (!fromHistory) {
      history = [{ text: d.text, format: d.format, ts: Date.now() }, ...history.filter((h) => h.text !== d.text)].slice(0, HIST_MAX);
      saveHist();
    }
    const res = q('res');
    res.hidden = false;
    q('hist').hidden = true;
    q('modes').parentElement!.hidden = true;
    res.innerHTML = `
      <div class="fmt">${esc(formatName(d.format))}</div>
      <h3>${esc(p.title)}</h3>
      ${p.fields.map(([k, v]) => `<div class="f"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
      <div class="btns">
        <button type="button" class="btn primary" data-action="scan.again">${t('Сканировать ещё')}</button>
        <button type="button" class="btn" data-action="scan.copy">${t('Копировать')}</button>
        ${isSafeHref(p.href) ? `<a class="btn linkbtn" target="_blank" rel="noopener noreferrer" href="${esc(p.href)}">${t('Открыть')}</a>` : ''}
        ${p.kind === 'product' ? `<a class="btn linkbtn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(p.copy)}">${t('Найти товар')}</a>` : ''}
      </div>`;
    copyText = p.copy;
  };

  // ---------- распознавание ----------
  let decoder: Decoder | null = null;
  let paused = false;
  let busy = false;
  let alive = true;
  let timer = 0;
  let lastText = '';
  let lastAt = 0;

  const grab = (src: CanvasImageSource, w: number, h: number): void => {
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    cctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  };

  const loop = async () => {
    if (!alive) return;
    if (!paused && !busy && decoder && camOk && video.videoWidth > 0 && video.readyState >= 2) {
      busy = true;
      try {
        grab(video, video.videoWidth, video.videoHeight);
        const d = await decoder.decode(canvas);
        const now = Date.now();
        if (d && !paused && (d.text !== lastText || now - lastAt > 2000)) {
          lastText = d.text;
          lastAt = now;
          showResult(d);
        }
      } catch {
        /* кадр не распознан */
      }
      busy = false;
    }
    timer = window.setTimeout(() => void loop(), INTERVAL_MS);
  };

  const setDecoder = async () => {
    try {
      decoder = await createDecoder(mode);
    } catch {
      decoder = null;
      q('hint').textContent = t('Не удалось загрузить распознаватель кодов');
    }
  };

  const resume = () => {
    paused = false;
    lastAt = Date.now();
    section.classList.remove('found');
    q('res').hidden = true;
    q('modes').parentElement!.hidden = false;
    if (camOk) void video.play().catch(() => undefined);
  };

  const markModes = () => {
    for (const b of q('modes').querySelectorAll<HTMLElement>('button'))
      b.classList.toggle('on', b.dataset.m === mode);
    q('hint').textContent =
      mode === 'qr'
        ? t('Наведите камеру на QR-код')
        : mode === 'bar'
          ? t('Расположите штрихкод горизонтально в кадре')
          : t('Наведите камеру на QR-код или штрихкод');
  };

  // ---------- из фото ----------
  const file = q<HTMLInputElement>('file');
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    void (async () => {
      try {
        if (!decoder) await setDecoder();
        const bmp = await createImageBitmap(f);
        let found: Decoded | null = null;
        for (const scale of [1, 0.5]) {
          grab(bmp, bmp.width * scale, bmp.height * scale);
          found = (await decoder?.decode(canvas)) ?? null;
          if (found) break;
        }
        bmp.close();
        if (found) showResult(found);
        else toast(t('На фото код не найден'));
      } catch {
        toast(t('Не удалось прочитать изображение'));
      }
    })();
  });

  // ---------- история ----------
  const drawHist = () => {
    const box = q('hist');
    const closeBtn = `<button type="button" class="btn" data-action="scan.hclose">${t('Закрыть')}</button>`;
    box.innerHTML = history.length
      ? `${history
          .map(
            (h, i) =>
              `<button type="button" class="it" data-action="scan.hit" data-i="${i}"><b>${esc(h.text)}</b><span>${esc(formatName(h.format))} · ${new Date(h.ts).toLocaleString(locale())}</span></button>`,
          )
          .join('')}<div class="btns"><button type="button" class="btn danger" data-action="scan.hclear">${t('Очистить историю')}</button>${closeBtn}</div>`
      : `<div class="note">${t('История пуста')}</div><div class="btns">${closeBtn}</div>`;
  };

  const sc = scope()
    .on('scan.torch', toggleTorch)
    .on('scan.photo', () => file.click())
    .on('scan.mode', (el) => {
      mode = el.dataset.m as ScanMode;
      markModes();
      void setDecoder();
    })
    .on('scan.again', resume)
    .on('scan.copy', () => {
      void navigator.clipboard
        ?.writeText(copyText)
        .then(() => toast(t('Скопировано')))
        .catch(() => toast(t('Не удалось скопировать')));
    })
    .on('scan.hist', () => {
      q('res').hidden = true;
      q('modes').parentElement!.hidden = true;
      q('hist').hidden = false;
      drawHist();
    })
    .on('scan.hclose', () => {
      q('hist').hidden = true;
      q('modes').parentElement!.hidden = false;
    })
    .on('scan.hclear', () =>
      confirmSheet({
        title: t('Очистить историю?'),
        text: t('Все сохранённые коды будут удалены с телефона.'),
        confirm: t('Очистить'),
        danger: true,
        onConfirm: () => {
          history = [];
          saveHist();
          drawHist();
        },
      }),
    )
    .on('scan.hit', (el) => {
      const h = history[Number(el.dataset.i)];
      if (h) showResult({ text: h.text, format: h.format }, true);
    });

  markModes();
  await setDecoder();
  void loop();

  return {
    unmount() {
      alive = false;
      window.clearTimeout(timer);
      sc.dispose();
      detachCamera(video);
      root.replaceChildren();
    },
  };
}
