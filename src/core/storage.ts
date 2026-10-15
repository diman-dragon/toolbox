import { Preferences } from '@capacitor/preferences';

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, data: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(data) });
  } catch {
    /* хранилище недоступно — настройки просто не сохранятся */
  }
}
