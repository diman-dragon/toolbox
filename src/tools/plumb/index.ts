import { loadCalib } from '../../core/calib';
import { getScreenAngle } from '../../core/screen';
import { subscribeGravity } from '../../core/sensors';
import type { Tool, Vec3 } from '../../core/types';
import { mount } from '../../ui/dom';
import { deviceTilts } from '../level/math';
import { applyCalibration, inPlaneAngle } from '../protractor/math';

const FLAT_LIMIT = 0.9;

export default async function createPlumb(root: HTMLElement): Promise<Tool> {
  const calib = await loadCalib();
  const q = mount(
    root,
    `<section class="plumb">
      <video data-id="video" playsinline muted autoplay></video>
      <div class="pl-line" data-id="line"></div>
      <div class="pl-fix"></div>
      <div class="pl-read"><div class="big" data-id="val">—</div><div class="note pl-note" data-id="sub">Запуск камеры…</div></div>
      <button type="button" class="btn pl-btn" data-id="freeze">Стоп-кадр</button>
    </section>`,
  );
  const video = q<HTMLVideoElement>('video');
  let stream: MediaStream | null = null;
  let frozen = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = stream;
    q('sub').textContent = 'Совместите красную линию с вертикалью (стена, косяк, колонна)';
  } catch {
    q('sub').textContent = 'Нет доступа к камере — работает только линия отвеса';
    q('freeze').setAttribute('disabled', '');
  }

  let g: Vec3 | null = null;
  const unsub = subscribeGravity((v) => (g = v));

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!g || frozen) return;
    const v0 = calib.invert ? { x: -g.x, y: -g.y, z: -g.z } : g;
    const v = applyCalibration(v0, calib.ox, calib.oy);
    if (deviceTilts(v).flatness >= FLAT_LIMIT) {
      q('val').textContent = '—';
      return;
    }
    const a = inPlaneAngle(v, getScreenAngle());
    q('line').style.transform = `translateX(-50%) rotate(${a.toFixed(2)}deg)`;
    q('val').textContent = `${Math.abs(a).toFixed(1)}°`;
  };
  raf = requestAnimationFrame(frame);

  q('freeze').addEventListener('click', () => {
    frozen = !frozen;
    if (frozen) video.pause();
    else void video.play();
    q('freeze').classList.toggle('on', frozen);
  });

  return {
    unmount() {
      cancelAnimationFrame(raf);
      unsub();
      stream?.getTracks().forEach((t) => t.stop());
      root.replaceChildren();
    },
  };
}
