/** Угол поворота экрана: 0, 90, 180 или 270. */
export function getScreenAngle(): number {
  const a =
    screen.orientation?.angle ??
    (window as unknown as { orientation?: number }).orientation ??
    0;
  return ((Math.round(a / 90) * 90) % 360 + 360) % 360;
}
