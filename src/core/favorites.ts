import { loadJSON, saveJSON } from './storage';

const KEY = 'app.favs';
let favs: string[] = [];

export async function loadFavorites(): Promise<void> {
  const v = await loadJSON<unknown>(KEY, []);
  favs = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export const favorites = (): string[] => favs;
export const isFavorite = (id: string): boolean => favs.includes(id);

export function toggleFavorite(id: string): boolean {
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  void saveJSON(KEY, favs);
  return favs.includes(id);
}

export function replaceFavorites(v: string[]): void {
  favs = v;
  void saveJSON(KEY, favs);
}
