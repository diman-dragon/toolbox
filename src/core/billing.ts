import { Capacitor, registerPlugin } from '@capacitor/core';
import { PRODUCT_PREMIUM, setPurchased, type TipId } from './premium';

export interface ProductInfo {
  id: string;
  /** Цена в валюте магазина, уже отформатированная («4,99 €») */
  price: string;
}
export type BuyResult = 'ok' | 'cancelled' | 'unavailable' | 'error';

interface BillingPlugin {
  products(o: { ids: string[] }): Promise<{ items: ProductInfo[] }>;
  buy(o: { id: string; consumable: boolean }): Promise<{ result: BuyResult }>;
  /** Возвращает ключи купленных непотребляемых товаров. */
  owned(): Promise<{ ids: string[] }>;
}

/** Нативный плагин native-src/BillingPlugin.java.tpl (Play Billing Library 8.0.0). */
const Native = registerPlugin<BillingPlugin>('Billing');
export const billingAvailable = (): boolean => Capacitor.isNativePlatform();

export async function loadProducts(ids: string[]): Promise<Record<string, string>> {
  if (!billingAvailable()) return {};
  try {
    const r = await Native.products({ ids });
    return Object.fromEntries(r.items.map((i) => [i.id, i.price]));
  } catch {
    return {};
  }
}

/** Синхронизация с магазином: «Восстановить покупки» и проверка при запуске. */
export async function syncPurchases(): Promise<boolean> {
  if (!billingAvailable()) return false;
  try {
    const r = await Native.owned();
    const has = r.ids.includes(PRODUCT_PREMIUM);
    if (has) setPurchased(true);
    return has;
  } catch {
    return false;
  }
}

export async function buy(id: typeof PRODUCT_PREMIUM | TipId): Promise<BuyResult> {
  if (!billingAvailable()) return 'unavailable';
  try {
    const r = await Native.buy({ id, consumable: id !== PRODUCT_PREMIUM });
    if (r.result === 'ok' && id === PRODUCT_PREMIUM) setPurchased(true);
    return r.result;
  } catch {
    return 'error';
  }
}
