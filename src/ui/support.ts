import { scope } from '../core/actions';
import { billingAvailable, buy, loadProducts, syncPurchases } from '../core/billing';
import { esc, plural, t } from '../core/i18n';
import { TIPS, PRODUCT_PREMIUM, inTrial, isPaid, onPremium, premiumState, redeemCode, trialDaysLeft, type TipId } from '../core/premium';
import { catSvg } from './cat';
import { showSheet } from './sheet';
import { toast } from './toast';

const tipTitle = (id: TipId) =>
  id === 'tip_tea' ? t('Чашка чая') : id === 'tip_cat_treat' ? t('Лакомство для котика') : t('Корм для котика');

const DAY_RU: [string, string, string] = ['день', 'дня', 'дней']; // i18n-ok: формы слова для склонения
let prices: Record<string, string> = {};
export async function refreshPrices(): Promise<void> {
  prices = await loadProducts([PRODUCT_PREMIUM, ...TIPS.map((x) => x.id)]);
}
const priceOf = (id: string, fallback = '') => prices[id] ?? fallback;

/** Статус одной строкой: куплено / код / пробный период / бесплатная часть. */
export function statusLine(): string {
  const s = premiumState();
  if (s.purchased) return t('Premium куплен — навсегда, спасибо!');
  if (s.code) return t('Premium активирован по коду — навсегда');
  if (inTrial()) {
    const d = trialDaysLeft();
    return t('Пробный период: осталось {0} {1}', d, plural(d, DAY_RU, ['day', 'days']));
  }
  return t('Пробный период закончился: бесплатная часть остаётся, расширенные функции — по Premium');
}

function cheer(root: ParentNode): void {
  const cat = root.querySelector('.cat');
  if (!cat) return;
  cat.classList.add('happy');
  window.setTimeout(() => cat.classList.remove('happy'), 3500);
}

export function codeSheet(onDone?: () => void): void {
  const h = showSheet({
    title: t('Код активации'),
    html: `<p class="sheet-text">${esc(t('Код для тестеров даёт Premium навсегда. Проверяется на устройстве, без интернета.'))}</p>
      <input class="in wide" data-id="code" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="DLD-XXXX-XXXX-XXXX-XXXX">`,
    actions: [
      {
        label: t('Применить'),
        primary: true,
        keep: true,
        run: () => {
          const v = (h.el.querySelector('[data-id="code"]') as HTMLInputElement).value;
          void redeemCode(v).then((ok) => {
            if (ok) {
              toast(t('Код принят: Premium навсегда'));
              h.close();
              onDone?.();
            } else {
              toast(t('Код не подошёл. Проверьте символы'));
            }
          });
        },
      },
    ],
  });
}

async function doBuy(id: typeof PRODUCT_PREMIUM | TipId, root: ParentNode): Promise<void> {
  const r = await buy(id);
  if (r === 'ok') {
    toast(id === PRODUCT_PREMIUM ? t('Premium куплен. Спасибо!') : t('Спасибо! Котик очень рад'));
    cheer(root);
  } else if (r === 'unavailable') toast(t('Покупки доступны только в приложении из Google Play'));
  else if (r === 'error') toast(t('Не удалось завершить покупку. Попробуйте позже'));
}

/** Окно «нужен Premium» для заблокированного инструмента. */
export function premiumSheet(toolTitle: string, onUnlocked: () => void): void {
  const sc = scope();
  const h = showSheet({
    title: t('Нужен Premium'),
    html: `<p class="sheet-text">${esc(t('«{0}» — расширенная функция. Premium: разовая покупка {1}, навсегда, без подписки.', toolTitle, priceOf(PRODUCT_PREMIUM, t('4,99 €/$'))))}</p>`,
    actions: [
      { label: t('Купить Premium'), primary: true, keep: true, run: () => void doBuy(PRODUCT_PREMIUM, h.el).then(() => isPaid() && (h.close(), onUnlocked())) },
      { label: t('У меня есть код'), run: () => codeSheet(onUnlocked) },
    ],
    onClose: () => sc.dispose(),
  });
}

/** Раздел «Поддержка»: статус, покупка, ввод кода, чаевые, котик. */
export function renderSupport(root: HTMLElement): () => void {
  const draw = () => {
    root.innerHTML = `<section class="pane support">
      <div class="cat-wrap">${catSvg()}</div>
      <div class="box"><div class="set-title">${esc(t('Premium'))}</div>
        <p class="status" data-id="status">${esc(statusLine())}</p>
        ${
          isPaid()
            ? ''
            : `<div class="btns"><button type="button" class="btn primary" data-action="sup.buy">${esc(t('Купить Premium'))} · ${esc(priceOf(PRODUCT_PREMIUM, t('4,99 €/$')))}</button>
               <button type="button" class="btn" data-action="sup.code">${esc(t('У меня есть код'))}</button>
               <button type="button" class="btn" data-action="sup.restore">${esc(t('Восстановить покупки'))}</button></div>`
        }
        <p class="note left">${esc(t('Разовая покупка, навсегда, без подписки. Бесплатная часть остаётся и после пробного периода.'))}</p>
      </div>
      <div class="box"><div class="set-title">${esc(t('Поддержать'))}</div>
        <p class="note left">${esc(t('Чаевые ничего не открывают — это благодарность.'))}</p>
        <div class="btns">${TIPS.map((x) => `<button type="button" class="btn" data-action="sup.tip" data-id="${x.id}">${esc(tipTitle(x.id))}${priceOf(x.id) ? ` · ${esc(priceOf(x.id))}` : ''}</button>`).join('')}</div>
      </div>
    </section>`;
  };
  draw();

  const sc = scope()
    .on('sup.buy', () => void doBuy(PRODUCT_PREMIUM, root))
    .on('sup.code', () => codeSheet(draw))
    .on('sup.restore', () =>
      void syncPurchases().then((ok) => {
        toast(ok ? t('Покупка восстановлена') : billingAvailable() ? t('Покупок не найдено') : t('Покупки доступны только в приложении из Google Play'));
        draw();
      }),
    )
    .on('sup.tip', (el) => void doBuy(el.dataset.id as TipId, root));

  const off = onPremium(draw);
  void refreshPrices().then(() => root.isConnected && draw());
  return () => {
    off();
    sc.dispose();
  };
}
