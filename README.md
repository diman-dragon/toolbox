# Мультитул — DataLaw Design

Android-приложение: Capacitor 8 + Vite + TypeScript, без UI-фреймворка, без сети, аналитики и рекламы.
Инструменты: Уровень, Угломер, Шаблоны углов, Высотомер, Дальномер, Металлоискатель, Компас, Отвес, Линейка, Сканер, Шумомер.
Расширенные (Premium): шаблоны углов, высотомер, дальномер, металлоискатель, шумомер — 30 дней пробного периода, затем разовая покупка `premium_lifetime` или код.

## Структура
- `src/core` — чистая логика: `filter.ts` (фильтры), `orient.ts` (геометрия углов и калибровка), датчики, i18n, настройки, Premium, Billing.
- `src/tools/*` — инструменты; `src/ui` — окна, настройки, поддержка, иконки.
- `src/variables.css` — единственное место с цветами (темы: классика, AMOLED, бумага); `tools/make-colors.mjs` дублирует их в `native-res/res/values/colors.xml`.
- Тексты: русский — ключ, английский — `tools/en.txt` → `python3 tools/gen-en.py` → `src/i18n-en.ts`.
- `store/` — политика, условия, лицензии, описания Play, чек-лист релиза, `site.json`.
- `native-src/*.java.tpl` — нативные плагины (Magnetometer, Shortcuts, System, Billing 8.0.0); `scripts/patch-android.sh` вставляет их в проект после `npx cap add android`.

## Команды
```
npm install
npm run dev        # браузер: мышь = наклон, E = стоит на ребре, M = металл
npm run check      # tsc
npm test           # тесты (orient, i18n, gestures, premium, audit)
npm run build
npm run codes 10   # коды Premium для тестеров
npm run colors     # colors.xml из variables.css
```

## Сборка
- `android.yml` — отладочный APK (открытый ключ из `keystore/`, в Play не загружать).
- `release.yml` — AAB для Play вручную; секреты `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- `versionCode = major*10000 + minor*100 + patch` из `package.json`.

## Уровень и углы
Время фильтра задано в секундах (не зависит от частоты датчика), пузырёк плывёт с инерцией, цифры не мерцают, ноль и «стоит» — с гистерезисом.
Калибровка — поворотом вектора, а не вычитанием углов; уровень калибруется в два положения (180°), так наклон стола не попадает в ноль.
