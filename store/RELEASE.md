# Выпуск в Google Play: пошагово

## 1. Один раз
0. Имя разработчика в Play Console — **DataLaw International**. Для личного аккаунта это допустимо: публичное имя разработчика — просто название, оно не обязано совпадать с юрлицом. Проверка личности по документам всё равно проходит, а по правилам ЕС (DSA) в карточке могут показываться ваши контактные данные. D-U-N-S нужен только для аккаунта организации.
1. **Политика конфиденциальности.** В `docs/index.html` замените `YOUR_EMAIL` на свою почту. В репозитории GitHub: Settings → Pages → Source: *Deploy from a branch*, ветка `main`, папка `/docs`. Адрес вида `https://<логин>.github.io/<репозиторий>/` вставьте в Play Console.
2. **Ключ подписи** (храните файл и пароли в надёжном месте; потеряете — обновить приложение нельзя):
   `keytool -genkeypair -v -keystore release.jks -alias toolbox -keyalg RSA -keysize 2048 -validity 10000`
   `base64 -w0 release.jks` (в Windows: `certutil -encode release.jks out.txt`, без строк BEGIN/END).
3. GitHub → Settings → Secrets and variables → Actions: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
4. Play Console: создать приложение → «Тесты» → при первой загрузке включить **Play App Signing**.

## 2. Каждый выпуск
1. Поднять `version` в `package.json` → push в `main`.
2. В GitHub Actions скачать артефакт `toolbox-release` → файл `.aab`.
3. Play Console → Тестирование → Закрытое тестирование → новый выпуск → загрузить `.aab`.
4. Для личного аккаунта (создан после 13.11.2023): набрать **12 тестировщиков**, держать тест **14 дней**, затем подать заявку на Production.

## 3. Заполнить в консоли
Карточка — `store/listing.md`; графика — `store/icon-512.png`, `store/feature-graphic-1024x500.png`, `store/screenshots/`; анкеты — `store/data-safety.md`. Контактная почта и URL политики обязательны.

## 4. Проверка перед отправкой
- Target API 36 (Capacitor 8) — уже в проекте.
- `versionCode` растёт автоматически (номер запуска CI).
- Соберите и проверьте на реальном телефоне: камерные инструменты, шумомер, ярлыки, отступы под системные панели (Android 15/16 рисует приложение под строкой состояния и навигацией).

## Обновления
Тестовые APK обновляются поверх друг друга (постоянный `keystore/toolbox-debug.jks`). Сборка из Play подписана ключом Play, поэтому ставится только после удаления тестовой, и наоборот.
