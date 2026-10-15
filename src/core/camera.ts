/**
 * Переиспользуемый поток камеры (задняя камера).
 * Высотомер, дальномер и отвес берут один и тот же MediaStream:
 * при переходе между инструментами поток не пересоздаётся каждый раз.
 */

let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
const users = new Set<HTMLVideoElement>();

async function open(): Promise<MediaStream> {
  const s = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  stream = s;
  s.getVideoTracks()[0]?.addEventListener('ended', () => {
    stream = null;
    pending = null;
    for (const v of [...users]) detachCamera(v);
  });
  return s;
}

/** Подписывает <video> на поток камеры; бросает Error, если камера недоступна. */
export async function attachCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!pending) {
    pending = open().catch((err) => {
      pending = null;
      throw err;
    });
  }
  const s = await pending;
  if (s !== stream) return attachCamera(video); // поток был перезапущен — берём новый
  users.add(video);
  video.srcObject = s;
  void video.play().catch(() => undefined);
  return s;
}

/** Отвязывает <video>; если подписчиков не осталось — гасит подсветку (поток держим для скорости). */
export function detachCamera(video: HTMLVideoElement): void {
  users.delete(video);
  if (video.srcObject) {
    try {
      video.pause();
    } catch {
      /* уже остановлено */
    }
    video.srcObject = null;
  }
  if (users.size === 0) void turnTorchOff();
}

/** Полная остановка потока (используется при выходе из приложения/ошибке). */
export function stopCamera(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  pending = null;
  users.clear();
}

/** Включить/выключить подсветку (если у камеры есть torch). Возвращает факт успеха. */
export async function setTorch(on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0] as
    | (MediaStreamTrack & { applyConstraints?: (c: MediaTrackConstraints) => Promise<void> })
    | undefined;
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

async function turnTorchOff(): Promise<void> {
  await setTorch(false).catch(() => undefined);
}
