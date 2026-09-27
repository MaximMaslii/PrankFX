# PrankFX — что нужно, чтобы выложиться в Google Play и App Store

Состояние на 20.09.2026. Разбор по коду проекта, не общий список из интернета.

---

## 0. Уже готово

- Правовые страницы: `/privacy`, `/terms`, `/support`, `/data-deletion` на трёх языках.
- Удаление аккаунта внутри приложения (Настройки → Удалить аккаунт) с каскадным удалением контента — Google Play требует и то, и другое.
- Возрастное предупреждение при первом запуске, фильтр эффектов 18+.
- Локализация EN/RU/DE, тёмная и светлая темы.
- Вотермарк на бесплатных клипах, чистый клип для премиума.
- Нет рекламных SDK, аналитики и трекеров — анкеты о данных заполняются легко.

---

## 1. Блокеры Google Play

### 1.1 Релизная подпись

`android/app/build.gradle`: сейчас **release подписан debug-ключом**.

```gradle
release {
    signingConfig signingConfigs.debug   // ← так в Play нельзя
```

Правильный путь — отдать ключи EAS и включить Play App Signing:

```bash
cd frontend
eas login
eas build:configure
eas build --platform android --profile production
```

На первом запуске EAS предложит сгенерировать upload keystore — соглашайтесь, он сохранится в вашем аккаунте Expo. Если хотите свой:

```bash
keytool -genkeypair -v -keystore prankfx-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias prankfx
```

**Потеря этого ключа = невозможность обновить приложение.** Храните копию вне компьютера.

### 1.2 SHA-1 релизного ключа в Google Cloud Console

Вы это уже проходили с debug-сборкой: Google-вход завязан на отпечаток ключа. После сборки релиза:

```bash
eas credentials --platform android      # покажет SHA-1 upload-ключа
```

Плюс отпечаток **ключа Play App Signing** (Play Console → Настройка → Целостность приложения). Оба SHA-1 добавить в Google Cloud Console → Credentials → Android client (package `com.prankfx.app`). Без этого вход через Google в опубликованной версии не работает — самая частая причина «у всех не логинится после релиза».

### 1.3 Экран согласия OAuth — опубликовать

Сейчас проект в статусе Testing: входить могут только email из списка тестовых. Google Cloud Console → OAuth consent screen → **Publish app**. Для scopes `openid/profile/email` проверка Google не нужна, но ссылки на политику и условия должны открываться публично.

### 1.4 Публичный бэкенд

`192.168.100.6:8000` не существует для ревьюера и для пользователей. Нужен хостинг с HTTPS-доменом:

- домен → бэкенд (Caddy/nginx с Let's Encrypt, или платформа вроде Railway/Fly/Render);
- MongoDB — управляемая (Atlas), не локальная;
- **персистентный диск** для `backend/media/snaps` — на эфемерной файловой системе готовые клипы исчезнут при рестарте;
- ffmpeg в образе (`apt-get install ffmpeg` в Dockerfile);
- `EXPO_PUBLIC_BACKEND_URL=https://<домен>` в `eas.json` (профили preview и production — я подготовил, вставьте домен вместо `REPLACE-WITH-YOUR-DOMAIN`).

После этого те же URL пойдут в Play Console как privacy policy и data deletion.

### 1.5 Реальные покупки

Сейчас FX покупаются через `POST /subscription/fx/mock-purchase` — дев-эндпоинт, раздающий кредиты бесплатно, и `ALLOW_MOCK_PURCHASES=true` в вашем `.env`. Два варианта:

**A. Выпустить бесплатную версию** (быстро): `ALLOW_MOCK_PURCHASES=false`, убрать из приложения экран покупки FX или оставить его с текстом «скоро», начислять ежедневный бесплатный FX. Приложение проходит ревью, деньги не зарабатывает.

**B. Подключить покупки** (правильно, ~1–2 дня работы):

1. `npx expo install react-native-purchases` (SDK RevenueCat).
2. В Play Console создать consumable-товары под каждый FX-пак (id должны совпасть с `fx_service`), в App Store Connect — то же самое.
3. В RevenueCat завести проект, привязать Play/App Store, создать Offerings.
4. На бэкенде принять вебхук RevenueCat (`INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`) и начислять FX по `app_user_id` = вашему `user_id`. **Начисление только по вебхуку или после серверной проверки чека** — клиенту в этом вопросе верить нельзя.
5. Покупку нужно подтвердить (acknowledge/consume) в течение 3 суток, иначе Google автоматически вернёт деньги покупателю.
6. `ALLOW_MOCK_PURCHASES=false` на проде (теперь при включённом флаге сервер пишет предупреждение в лог, а `/api/health` показывает `mock_purchases: ENABLED — NOT FOR PRODUCTION`).

Кнопка «Restore purchases» в настройках сейчас дёргает `/subscription/restore`, который ничего не восстанавливает — с RevenueCat она заработает через `Purchases.restorePurchases()`.

### 1.6 Экономика — посчитайте до запуска, а не после

1 FX = одна генерация Gemini, 10 FX = один клип Decart Lucy. Возьмите текущие прайсы обоих провайдеров, посчитайте себестоимость пакета и сравните с ценой за вычетом комиссии магазина (10% сервисный сбор + 5% billing fee при биллинге Google). Если себестоимость Snap-клипа окажется выше цены 10 FX — каждый вирусный ролик будет приносить убыток. Новым аккаунтам сейчас выдаётся 1 бесплатный FX (`SIGNUP_FX_CREDITS`) — это ваш CAC, тоже посчитайте.

---

## 2. Дополнительно для App Store

### 2.1 Sign in with Apple — обязателен

Guideline 4.8: если в приложении есть вход через сторонний сервис (у вас Google), Apple требует предложить и Sign in with Apple. Без этого ревью отклонят. Нужно:

```bash
npx expo install expo-apple-authentication
```

плюс кнопка на экранах входа/регистрации и эндпоинт `POST /api/auth/apple`, который проверяет identity token по ключам Apple (аналог того, что уже сделано для Google). Работы примерно на полдня.

### 2.2 Планшеты

`supportsTablet` был `true` — Apple тогда требует отдельные скриншоты для iPad и проверяет вёрстку на нём. Я поставил `false`; если iPad вам нужен, верните и подготовьте скриншоты.

### 2.3 Экспорт шифрования

Добавил `ITSAppUsesNonExemptEncryption: false` — иначе App Store Connect спрашивает об этом при каждой загрузке сборки.

### 2.4 Демо-аккаунт для ревью

Вход в приложение обязателен, поэтому и Apple, и Google требуют тестовый аккаунт в форме ревью: email + пароль, на балансе несколько FX (иначе ревьюер упрётся в пейволл и отклонит за «недоступный функционал»). Создайте отдельного пользователя и начислите ему FX прямо в базе.

---

## 3. Материалы для страниц в сторах

**Google Play**

- Иконка 512×512 PNG.
- Feature graphic 1024×500 — обязательна.
- Минимум 2 скриншота телефона (делайте 6–8: главная, эффекты, до/после, Snap-запись, результат, премиум).
- Краткое описание (80 символов) и полное (до 4000).
- Заполнить Data safety, Content rating, Target audience, Ads (реклама — «нет»).

**App Store**

- Иконка 1024×1024 без альфа-канала и без скруглений.
- Скриншоты 6.7" (1290×2796) и 6.5" — обязательный набор.
- Описание, ключевые слова (100 символов), promotional text, URL поддержки (`https://<домен>/support`) и политики.
- Age rating: из-за эффектов с имитацией травм честно отмечайте «Realistic Violence — Infrequent/Mild», ожидайте 12+.

Скриншоты снимайте **после** редизайна — текущая тёмная неоновая тема визуально сильно выигрывает у старой.

---

## 4. Что я уже поправил в этом заходе

- `app.json`: сплэш на логотипе PrankFX вместо чужого `elimax-splash.png`; фон сплэша и адаптивной иконки — цвет темы; `userInterfaceStyle: dark`; `supportsTablet: false`; `ITSAppUsesNonExemptEncryption: false`; человеческие тексты разрешений (их читают в ревью); из разрешений убраны `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE`, добавлен `blockedPermissions` с ними и с `SYSTEM_ALERT_WINDOW` — последнее тянется транзитивно из dev-библиотек, и Play за «показ поверх других приложений» задаёт неприятные вопросы.
- `eas.json`: профиль `production` собирает AAB, `preview` — APK для тестирования, у каждого свой `EXPO_PUBLIC_BACKEND_URL` (вставьте домен), submit-профиль отправляет в internal-трек.
- `backend/app/main.py`: предупреждение в логе при старте и поле `mock_purchases` в `/api/health`, если включена бесплатная раздача FX.

---

## 5. Порядок действий

1. Отозвать засвеченные ключи (RevenueCat, Decart, Gemini), выпустить новые.
2. Поднять бэкенд на домене с HTTPS, Mongo Atlas, ffmpeg и персистентным диском.
3. Вписать домен в `eas.json` (оба профиля).
4. Собрать `preview`-APK, проверить на живом телефоне весь путь: регистрация → Google-вход → фотоэффект → Snap → покупка (или её отсутствие) → удаление аккаунта.
5. Собрать `production`, получить SHA-1, добавить оба отпечатка в Google Cloud Console, опубликовать OAuth consent screen.
6. Перепроверить Google-вход на релизной сборке — до загрузки в стор.
7. Заполнить Play Console: листинг, Data safety, Content rating, политика, удаление данных, демо-аккаунт.
8. Залить в internal testing, пройти самому, затем production.
9. Для App Store: сначала Sign in with Apple, потом всё остальное.

---

## 6. Не блокеры, но сделать стоит

- **Rate limiting** на `/api/auth/login` и `/api/auth/register` — сейчас пароль можно перебирать без ограничений.
- **Sentry** (`npx expo install @sentry/react-native`) — без него о крашах у пользователей вы узнаете из отзывов в сторе.
- `LogBox.ignoreAllLogs(true)` в `app/_layout.tsx` прячет предупреждения и от вас тоже — на время подготовки релиза лучше выключить.
- `expo-dev-client` лежит в обычных `dependencies`; в релизной сборке он не активен, но в `devDependencies` ему место логичнее.
- Ротация логов на сервере ≤30 дней — политика конфиденциальности это обещает.
