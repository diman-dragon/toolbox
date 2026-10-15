import { scope } from '../../core/actions';
import { attachCamera, detachCamera } from '../../core/camera';
import { loadCalib } from '../../core/calib';
import { damp, stableRound } from '../../core/filter';
import { t } from '../../core/i18n';
import { calibrate, inPlaneAngle, tilts } from '../../core/orient';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import type { Tool, Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';

const STAND_ENTER = 0.88;
const STAND_LEAVE = 0.93;

export default async function createPlumb(root: HTMLElement): Promise<Tool> {
  const calib = await loadCalib();
  const q = mount(
    root,
    `<section class="plumb">
      <video data-id="video" playsinline muted autoplay></video>
      <div class="pl-line" data-id="line"></div>
      <div class="pl-fix"></div>
      <div class="pl-read"><div class="big" data-id="val">—</div><div class="note pl-note" data-id="sub">${t('Запуск камеры…')}</div></div>
      <button type="button" class="btn pl-btn" data-action="plumb.freeze" data-id="freeze">${t('Стоп-кадр')}</button>
    </section>`,
  );
  const video = q<HTMLVideoElement>('video');
  let frozen = false;

  await attachCamera(video).catch(() => {
    q('sub').textContent = t('Нет доступа к камере — работает только линия отвеса');
    q('freeze').setAttribute('disabled', '');
  });
  if (video.srcObject) q('sub').textContent = t('Совместите красную линию с вертикалью (стена, косяк, колонна)');

  let g: Vec3 | null = null;
  let standing = false;
  let ang = 0;
  let shown: number | null = null;
  const unsub = subscribeGravity((v) => (g = v));

  let raf = 0;
  let lastT = performance.now();
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (!g || frozen) return;
    const v = calibrate(g, calib);
    const flat = tilts(v).flatness;
    standing = standing ? flat <= STAND_LEAVE : flat < STAND_ENTER;
    if (!standing) {
      q('val').textContent = '—';
      return;
    }
    const a = inPlaneAngle(v, getScreenAngle());
    ang = damp(ang, a, dt, 0.07);
    q('line').style.transform = `translateX(-50%) rotate(${ang.toFixed(2)}deg)`;
    shown = stableRound(shown, Math.abs(a), 0.1);
    q('val').textContent = `${shown.toFixed(1)}°`;
  };
  raf = requestAnimationFrame(frame);

  const sc = scope().on('plumb.freeze', () => {
    frozen = !frozen;
    if (frozen) video.pause();
    else void video.play().catch(() => undefined);
    q('freeze').classList.toggle('on', frozen);
  });

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsub();
      sc.dispose();
      detachCamera(video);
      root.replaceChildren();
    },
  };
}
