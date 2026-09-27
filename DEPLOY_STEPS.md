# PrankFX — пошаговый выпуск в Google Play и App Store

Порядок имеет значение: каждый следующий шаг опирается на предыдущий.
Отмечайте галочками по ходу.

---

# ЧАСТЬ 1. Правки в файлах

## Шаг 1.1 — `backend/.env`

Откройте файл и **добавьте в конец** этот блок:

```
# --- Покупки (RevenueCat) -------------------------------------
# Придумайте длинную случайную строку и вставьте её же в RevenueCat
# (Integrations → Webhooks → Authorization header).
# Сгенерировать: python -c "import secrets; print(secrets.token_urlsafe(32))"
REVENUECAT_WEBHOOK_AUTH=

# Секретный ключ RevenueCat (sk_...). Нужен только для «Восстановить покупки».
REVENUECAT_SECRET_KEY=

# Идентификатор entitlement для премиума в RevenueCat.
PREMIUM_ENTITLEMENT_ID=premium

# --- Sign in with Apple ---------------------------------------
APPLE_CLIENT_IDS=com.prankfx.app

# --- Защита входа ---------------------------------------------
AUTH_RATE_LIMIT_ATTEMPTS=10
AUTH_RATE_LIMIT_WINDOW_SECONDS=300
```

Там же **проверьте**, что уже есть:

- `ALLOW_MOCK_PURCHASES=false` — у вас стоит `false`, это правильно. Оставьте.
- `GEMINI_API_KEY`, `DECART_API_KEY` — **перевыпустите оба**, они проходили
  через нашу переписку. Новые значения впишите сюда же.
- `MONGO_URL` — заменить на строку Atlas на шаге 2.2.
- Последние пять строк файла записаны с отступом в три пробела. Парсер это
  переживает, но лучше выровнять по левому краю, чтобы не спотыкаться глазами.

## Шаг 1.2 — `frontend/.env`

Приведите файл к такому виду (DECART-ключи отсюда **удалить** — их читает
только бэкенд, во фронтенде им делать нечего):

```
# Адрес бэкенда, без слеша на конце и без /api.
# Для разработки на телефоне — LAN-адрес компьютера, не 127.0.0.1:
#   Windows: ipconfig → IPv4 вашего Wi-Fi адаптера
# Для эмулятора Android: http://10.0.2.2:8000
EXPO_PUBLIC_BACKEND_URL=http://192.168.100.6:8000

# Публичные SDK-ключи RevenueCat (появятся на шаге 4.6).
# Это НЕ секретный sk_... — эти два предназначены для клиента.
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
```

> Сейчас там `http://127.0.0.1:8000` — с телефона это адрес самого телефона,
> сервер по нему не найдётся. Для эмулятора нужен `10.0.2.2`, для реального
> устройства — LAN-адрес компьютера.

## Шаг 1.3 — `frontend/eas.json`

Найдите **два** места со словом `REPLACE-WITH-YOUR-DOMAIN` (в профилях
`preview` и `production`) и впишите адрес продакшен-бэкенда с https:

```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://api.prankfx.app"
}
```

Профиль `development` трогать не нужно — он для локальной разработки.

## Шаг 1.4 — установить пакеты

**Без этого приложение не запустится** («Unable to resolve module
react-native-purchases»).

```bash
cd frontend
npx expo install expo-apple-authentication react-native-purchases
npx expo prebuild --clean
```

`prebuild --clean` пересоздаёт папку `android/` — это нормально, все настройки
берутся из `app.json`.

## Шаг 1.5 — мелочь для отладки (по желанию)

В `frontend/app/_layout.tsx` строка `LogBox.ignoreAllLogs(true)` прячет
предупреждения и от вас тоже. На время подготовки релиза закомментируйте.

---

# ЧАСТЬ 2. Продакшен-сервер

Без публичного бэкенда приложение не работает ни у вас, ни у ревьюера.

## Шаг 2.1 — хостинг и домен

Любой вариант, где есть Docker и постоянный диск: Railway, Render, Fly.io,
Hetzner + Caddy. Нужны:

- домен (например `api.prankfx.app`) и HTTPS-сертификат;
- в образе установлен **ffmpeg** (`apt-get install -y ffmpeg`);
- **постоянный диск**, примонтированный в `backend/media` — на эфемерной
  файловой системе готовые Snap-клипы пропадут при первом же рестарте.

Запуск: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Шаг 2.2 — MongoDB Atlas

Создайте бесплатный кластер M0, пользователя базы, разрешите IP сервера,
скопируйте connection string в `MONGO_URL` в `backend/.env`.

## Шаг 2.3 — проверка

Откройте `https://<домен>/api/health`. Должно быть:

```json
{
  "database": "connected",
  "ffmpeg": "/usr/bin/ffmpeg",
  "ffprobe": "/usr/bin/ffprobe",
  "decart": "configured",
  "revenuecat_webhook": "configured",
  "apple_sign_in": "configured",
  "mock_purchases": "off"
}
```

Любое `missing` здесь — это сломанная функция в приложении. И откройте
`https://<домен>/legal` — страницы политики должны открываться публично, их
адреса пойдут в обе консоли.

---

# ЧАСТЬ 3. Google Play: аккаунт, товары, ключи

## Шаг 3.1 — аккаунт разработчика

[play.google.com/console](https://play.google.com/console) → регистрация,
единоразовые **$25**. Верификация личности занимает от пары часов до недели —
начните с этого.

## Шаг 3.2 — создать приложение

Create app → название PrankFX, язык, тип «App», платное/бесплатное — **Free**
(покупки внутри приложения этому не мешают).

## Шаг 3.3 — товары для покупок

Monetise → In-app products → Create product, пять штук, тип **consumable**:

| Product ID | Название | FX | Цена |
|---|---|---|---|
| `fx_starter` | Starter | 5 | $0.99 |
| `fx_basic` | Basic | 15 | $2.49 |
| `fx_popular` | Popular | 40 | $6.99 |
| `fx_pro` | Pro | 100 | $14.99 |
| `fx_ultimate` | Ultimate | 250 | $34.99 |

ID должны совпадать с таблицей — код сопоставляет товары по ним.

## Шаг 3.4 — тестировщики покупок

Setup → License testing → добавьте свой Google-аккаунт. Тогда покупки в
тестовых сборках проходят бесплатно.

---

# ЧАСТЬ 4. RevenueCat

## Шаг 4.1

Зарегистрируйтесь, создайте проект PrankFX.

## Шаг 4.2 — подключить Play

Project settings → Apps → Google Play. Нужен service account JSON из Google
Cloud Console с доступом к Play Console (инструкция там же в RevenueCat,
делается за 10 минут).

## Шаг 4.3 — подключить App Store

Тот же экран → App Store. Нужен ключ App Store Connect API (создаётся в ASC →
Users and Access → Integrations).

## Шаг 4.4 — импортировать товары

Products → Import — подтянутся пять consumable из Play и ASC.

## Шаг 4.5 — Offering

Offerings → создайте offering с идентификатором **`default`** и добавьте в
него все пять пакетов. Экран покупки читает именно текущий offering; если его
нет, кнопка покупки будет отключена.

## Шаг 4.6 — ключи

Project settings → API keys:

- **Public SDK key** для Android (`goog_...`) → в `frontend/.env`
  → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- **Public SDK key** для iOS (`appl_...`) → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- **Secret key** (`sk_...`) → в `backend/.env` → `REVENUECAT_SECRET_KEY`

Старый `sk_`-ключ, который засветился в переписке, удалите здесь же.

## Шаг 4.7 — вебхук

Integrations → Webhooks → Add:

- URL: `https://<домен>/api/purchases/revenuecat`
- Authorization header: строка из `REVENUECAT_WEBHOOK_AUTH`
- Нажмите **Send test event** — в логах сервера появится
  `RevenueCat test event received`, ответ 200. Если 401 — строки не совпали.

---

# ЧАСТЬ 5. Сборка загрузочных файлов

## Шаг 5.1 — EAS

```bash
npm install -g eas-cli
eas login            # аккаунт expo.dev
cd frontend
eas build:configure
```

## Шаг 5.2 — тестовый APK

```bash
eas build --platform android --profile preview
```

EAS предложит создать keystore — **соглашайтесь**, он сохранится в вашем
аккаунте Expo. Через 10–20 минут придёт ссылка на APK: установите на телефон и
пройдите весь путь — регистрация, Google-вход, фотоэффект, Snap, покупка,
удаление аккаунта.

> **Потеря keystore = невозможность обновлять приложение.** Сделайте резервную
> копию: `eas credentials` → Android → Download keystore, и положите файл туда,
> где он переживёт смерть компьютера.

## Шаг 5.3 — SHA-1 в Google Cloud Console (иначе Google-вход не заработает)

```bash
eas credentials --platform android
```

Скопируйте SHA-1 вашего upload-ключа. Затем в
[Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
Credentials → ваш **Android OAuth client**:

- Package name: `com.prankfx.app`
- Добавьте этот SHA-1

Позже, когда приложение появится в Play Console, добавьте **второй** SHA-1 —
из Play Console → Test and release → Setup → App integrity → App signing key
certificate. Google подписывает загруженный AAB своим ключом, и без этого
отпечатка вход через Google у скачавших из стора работать не будет.

## Шаг 5.4 — опубликовать экран согласия OAuth

Google Cloud Console → OAuth consent screen → **Publish app**. Пока он в
Testing, входить могут только аккаунты из списка тестовых.

## Шаг 5.5 — продакшен-сборка Android

```bash
eas build --platform android --profile production
```

На выходе **.aab** — это и есть загрузочный файл для Google Play.

## Шаг 5.6 — сборка iOS

Нужен [Apple Developer Program](https://developer.apple.com/programs/) —
**$99 в год**. Mac не нужен, EAS собирает в облаке.

Перед сборкой: Apple Developer → Certificates, IDs & Profiles → Identifiers →
`com.prankfx.app` → включить **Sign in with Apple**.

```bash
eas build --platform ios --profile production
```

EAS попросит Apple ID и сам создаст сертификаты и профили. На выходе **.ipa**.

---

# ЧАСТЬ 6. Заливка в Google Play

## Шаг 6.1 — загрузить сборку

Test and release → Testing → **Internal testing** → Create new release →
загрузите `.aab` → добавьте себя в тестировщики → пройдите по ссылке и
проверьте покупки на живом сторе.

## Шаг 6.2 — Store listing

- Название (до 30 символов), краткое описание (до 80), полное (до 4000)
- Иконка **512×512** PNG
- Feature graphic **1024×500** — обязательна
- Скриншоты телефона: минимум 2, лучше 6–8 (главная, эффекты, до/после,
  Snap-запись, результат, магазин FX)

## Шаг 6.3 — App content (анкеты)

| Раздел | Что указать |
|---|---|
| Privacy policy | `https://<домен>/privacy` |
| Data deletion | `https://<домен>/data-deletion` |
| Data safety | email, имя, user ID, фото, видео, аудио, история покупок; шифрование при передаче — да; удаление по запросу — да; реклама и аналитика — нет |
| Content rating | анкета; честно отметить имитацию травм → ожидайте 12+/13+ |
| Target audience | 13+ (не для детей) |
| Ads | нет |
| Government apps / Financial features | нет |

## Шаг 6.4 — демо-аккаунт для ревью

App content → App access → «All functionality is restricted» → укажите
тестовый email и пароль. **Начислите этому пользователю FX прямо в базе**,
иначе ревьюер упрётся в пейволл и отклонит за недоступный функционал.

## Шаг 6.5 — продакшен

Production → Create new release → тот же `.aab` → Roll out. Первое ревью
обычно занимает от нескольких часов до нескольких дней.

---

# ЧАСТЬ 7. Заливка в App Store

## Шаг 7.1 — создать приложение

[App Store Connect](https://appstoreconnect.apple.com) → My Apps → «+» →
bundle id `com.prankfx.app`.

## Шаг 7.2 — товары

Features → In-App Purchases → те же пять **Consumable** с теми же ID.
Заполните Review Information и скриншот для каждого — Apple проверяет товары
отдельно от приложения.

## Шаг 7.3 — загрузить сборку

```bash
eas submit --platform ios --latest
```

Или скачайте `.ipa` и залейте через Transporter. Сборка появится в TestFlight
через 10–30 минут.

## Шаг 7.4 — App Privacy

Анкета того же содержания, что Data safety в Play. Укажите: почта, имя,
user ID, фото, видео, аудио, история покупок; всё — «связано с пользователем»,
не используется для трекинга.

## Шаг 7.5 — метаданные

- Иконка **1024×1024**, без альфа-канала и без скруглений
- Скриншоты **6.7"** (1290×2796) — обязательный набор
- Описание, ключевые слова (100 символов), Support URL
  `https://<домен>/support`, Privacy Policy URL `https://<домен>/privacy`
- Age rating: отметьте «Realistic Violence — Infrequent/Mild» из-за эффектов
  с синяками; ожидайте 12+

## Шаг 7.6 — демо-аккаунт

App Review Information → Sign-in required → тот же тестовый аккаунт с FX на
балансе. В Notes напишите, что приложение создаёт заведомо фальшивые
изображения и содержит возрастное предупреждение при первом запуске — это
снимает половину вопросов ревьюера.

## Шаг 7.7 — отправить

Submit for Review. Первое ревью Apple — обычно 1–3 дня.

---

# ЧАСТЬ 8. Финальная проверка перед отправкой

- [ ] `/api/health` — все поля зелёные, `mock_purchases: off`
- [ ] Ключи Gemini, Decart и RevenueCat перевыпущены
- [ ] Google-вход работает **в релизной сборке** (не только в debug)
- [ ] Покупка проходит и FX начисляются (проверено на internal testing)
- [ ] «Восстановить покупки» отвечает корректно
- [ ] Удаление аккаунта действительно удаляет историю и клипы
- [ ] Резервная копия keystore лежит вне рабочего компьютера
- [ ] Демо-аккаунт создан, FX начислены, данные вписаны в обе консоли
- [ ] Посчитана себестоимость генерации против цены пакетов
