import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { loadJSON, saveJSON } from './storage';

interface Item {
  id: string;
  title: string;
}

interface ShortcutsPlugin {
  pin(o: Item): Promise<{ supported: boolean; requested: boolean }>;
  setDynamic(o: { items: Item[] }): Promise<void>;
  getLaunchTool(): Promise<{ id?: string }>;
  addListener(ev: 'tool', cb: (e: { id: string }) => void): Promise<PluginListenerHandle>;
}

/** Нативный плагин native-src/ShortcutsPlugin.java.tpl (ставится скриптом patch-android.sh). */
const Native = registerPlugin<ShortcutsPlugin>('Shortcuts');
const native = Capacitor.isNativePlatform();

export type PinResult = 'requested' | 'unsupported' | 'web' | 'error';

/** Просит Android добавить на рабочий стол ярлык, который открывает только этот инструмент. */
export async function pinTool(item: Item): Promise<PinResult> {
  if (!native) return 'web';
  try {
    const r = await Native.pin(item);
    if (!r.supported) return 'unsupported';
    return r.requested ? 'requested' : 'error';
  } catch {
    return 'error';
  }
}

/** Инструмент, с которого запущено приложение (ярлык), либо null. В браузере: #tool=<id>. */
export async function getLaunchTool(): Promise<string | null> {
  if (!native) {
    const m = /tool=([a-z0-9_]+)/.exec(location.hash);
    return m ? m[1] : null;
  }
  try {
    return (await Native.getLaunchTool()).id ?? null;
  } catch {
    return null;
  }
}

/** Ярлык нажат, когда приложение уже запущено. */
export function onToolIntent(cb: (id: string) => void): void {
  if (!native) return;
  void Native.addListener('tool', (e) => cb(e.id)).catch(() => undefined);
}

const MRU_KEY = 'app.mru';
const DEFAULT_MRU = ['level', 'compass', 'scanner', 'sound'];
const MAX_DYNAMIC = 4;

/** Меню по долгому нажатию на значок приложения: четыре последних открытых инструмента. */
export async function touchRecent(id: string, titleOf: (id: string) => string | null): Promise<void> {
  const cur = await loadJSON<string[]>(MRU_KEY, DEFAULT_MRU);
  const next = [id, ...cur.filter((x) => x !== id)].slice(0, MAX_DYNAMIC);
  await saveJSON(MRU_KEY, next);
  await syncRecent(next, titleOf);
}

export async function syncRecent(
  ids: string[] | null,
  titleOf: (id: string) => string | null,
): Promise<void> {
  if (!native) return;
  const list = ids ?? (await loadJSON<string[]>(MRU_KEY, DEFAULT_MRU));
  const items: Item[] = [];
  for (const id of list) {
    const title = titleOf(id);
    if (title) items.push({ id, title });
  }
  try {
    await Native.setDynamic({ items });
  } catch {
    /* ярлыки недоступны — не критично */
  }
}
