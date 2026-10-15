import { Capacitor, registerPlugin } from '@capacitor/core';

interface SystemPlugin {
  /** Цвет системных панелей (#rrggbb); light — значки панелей тёмные (светлая тема). */
  setBars(o: { color: string; light: boolean }): Promise<void>;
  /** Экран «О приложении» в системных настройках Android — там выдаются разрешения. */
  openAppSettings(): Promise<void>;
}

/** Нативный плагин native-src/SystemPlugin.java.tpl (ставится scripts/patch-android.sh). */
const Native = registerPlugin<SystemPlugin>('System');
const native = Capacitor.isNativePlatform();

export async function setSystemBars(color: string, light: boolean): Promise<void> {
  if (!native) return;
  try {
    await Native.setBars({ color, light });
  } catch {
    /* без плагина панели красятся только через edge-to-edge */
  }
}

export async function openAppSettings(): Promise<boolean> {
  if (!native) return false;
  try {
    await Native.openAppSettings();
    return true;
  } catch {
    return false;
  }
}
