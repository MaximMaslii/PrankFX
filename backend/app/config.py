from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parent.parent


# The Google OAuth clients this backend accepts ID tokens from.
# Android / iOS / Web clients all issue tokens with their own `aud`, so every
# client the app can run as has to be listed here or verification fails with
# "Token has wrong audience".
DEFAULT_GOOGLE_CLIENT_IDS = ",".join(
    [
        # Android
        "917307607930-5mulp0qe4b55gvhrno6qbnvmh2a2e1sc.apps.googleusercontent.com",
        # iOS
        "917307607930-u5kaei1ktf64c8f7h5r6rq7io6hv5gbr.apps.googleusercontent.com",
        # Web
        "917307607930-q5916sbm39ga8bctlvumir4h3jmp4c34.apps.googleusercontent.com",
    ]
)


class Settings(BaseSettings):

    MONGO_URL: str = "mongodb://localhost:27017"

    DB_NAME: str = "prankfx"

    JWT_SECRET: str = "change-me-in-production"

    JWT_ALGORITHM: str = "HS256"

    # 30 days. The app has no refresh-token flow, so a 60-minute access token
    # meant users were silently signed out mid-session.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30

    # Comma-separated list of accepted Google OAuth client IDs.
    GOOGLE_CLIENT_IDS: str = DEFAULT_GOOGLE_CLIENT_IDS

    # --- Sign in with Apple ---------------------------------------
    # Every audience an Apple identity token may carry: the iOS bundle id,
    # plus a Services ID if the web flow is ever added. App Store review
    # rejects an app that offers Google sign-in without this one.
    APPLE_CLIENT_IDS: str = "com.prankfx.app"

    APPLE_KEYS_URL: str = "https://appleid.apple.com/auth/keys"

    APPLE_ISSUER: str = "https://appleid.apple.com"

    # --- Sign in with Apple on Android (web flow) ------------------
    # iOS uses Apple's native sheet. Android has none, so it opens Apple's
    # web sign-in in a browser tab. That needs a *Services ID* created in the
    # Apple Developer portal (Identifiers → Services IDs), with this return
    # URL registered on it:
    #     https://<your-domain>/api/auth/apple/callback
    # Apple only accepts a public https domain — not an IP, not localhost.
    APPLE_SERVICE_ID: str = ""

    # Full public URL of the callback. Empty = built from the request, which
    # is wrong behind a proxy that terminates https, so set it in production.
    APPLE_REDIRECT_URI: str = ""

    # The app's URL scheme (app.json → "scheme"). The callback hands the
    # result back to the app through <scheme>://apple-callback.
    APP_SCHEME: str = "prankfx"

    # --- Purchases (RevenueCat) -----------------------------------
    # The value you type into RevenueCat's webhook "Authorization header"
    # field. Empty means the webhook endpoint refuses everything, which is the
    # right default: an open endpoint that grants FX is a free credit faucet.
    REVENUECAT_WEBHOOK_AUTH: str = ""

    # Secret API key (sk_...), used only to read a customer's entitlements
    # when restoring purchases. Never goes anywhere near the app.
    REVENUECAT_SECRET_KEY: str = ""

    REVENUECAT_API_URL: str = "https://api.revenuecat.com"

    # Entitlement identifier configured in RevenueCat for the premium tier.
    PREMIUM_ENTITLEMENT_ID: str = "premium"

    # --- Rate limiting --------------------------------------------
    # Attempts per IP per window on the authentication endpoints. Ten tries
    # in five minutes is invisible to a person who forgot their password and
    # useless to anyone working through a password list.
    AUTH_RATE_LIMIT_ATTEMPTS: int = 10

    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 300

    # Comma-separated CORS origins, or "*" for any.
    # A mobile app sends no Origin header, so "*" is safe here; tighten it
    # if you ever serve the web build from a known domain.
    CORS_ORIGINS: str = "*"

    # FX credits granted on sign-up.
    SIGNUP_FX_CREDITS: int = 1

    # --- Guest mode -----------------------------------------------
    # Lets someone use the app before registering. The account is real from
    # the first launch — it simply has no identity attached until the person
    # buys something or wants their work on a second device.
    #
    # Turning this off restores the old behaviour, where the first screen
    # after the splash is a sign-up form. That is where most first-time users
    # used to leave, so treat "off" as a deliberate, measured decision.
    GUEST_MODE_ENABLED: bool = True

    EMERGENT_LLM_KEY: str = ""

    GEMINI_API_KEY: str = ""

    # Development-only FX top-up (/subscription/fx/mock-purchase). The router
    # already guards on this flag, but the field was never declared, so
    # Settings raised AttributeError and the endpoint answered 500 instead of
    # the intended 404.
    # Never enable it in a shipped build: an authenticated endpoint that hands
    # out FX for free is an unlimited balance, and every FX spent costs real
    # money at the Gemini and Decart end.
    ALLOW_MOCK_PURCHASES: bool = False

    # --- Snap (video FX through Decart Lucy) ----------------------

    # Decart platform API key. Sent as the `X-API-KEY` header.
    DECART_API_KEY: str = ""

    DECART_API_URL: str = "https://api.decart.ai"

    # Pinned to Lucy 2.5 so behaviour does not shift under you while testing.
    # `lucy-latest` follows whatever Decart ships next.
    DECART_MODEL: str = "lucy-2.5"

    # A 3.8-second clip normally comes back in well under a minute; the job
    # timeout is the hard ceiling before the FX credits are refunded.
    DECART_JOB_TIMEOUT_SECONDS: float = 300.0

    DECART_POLL_INTERVAL_SECONDS: float = 2.0

    DECART_REQUEST_TIMEOUT_SECONDS: float = 120.0

    # --- Snap from a photo: which engine animates it ---------------
    # "pixverse" — PixVerse v5.5 through fal.ai, true image-to-video: the
    #              person actually MOVES and the transformation unfolds over
    #              the 5 seconds. Default.
    # "lucy"     — Decart Lucy 2.5. Lucy only edits video, so the photo is
    #              turned into a still clip first — the result is the photo
    #              with the effect laid over it and almost no motion. Kept
    #              for recorded Snaps (fire) and as a stand-in without FAL_KEY.
    # Switchable in backend/.env at any time; the app never needs an update.
    SNAP_PHOTO_ENGINE: str = "pixverse"

    # When the main engine fails (or is not configured), try the other one
    # before giving up and refunding. Needs both keys to matter.
    # Off by default: a failed PixVerse clip is better refunded than
    # replaced by a motionless Lucy one the user still pays 10 FX for.
    SNAP_PHOTO_FALLBACK: bool = False

    # --- Remote app config (/api/app/config) -----------------------
    # Lets a live app be steered from the server, without a store release.
    # Versions are the app's "version" from app.json, e.g. "1.0.0".
    # Below APP_MIN_VERSION the app shows a blocking "please update" screen —
    # only needed after a NATIVE change that an over-the-air update cannot
    # deliver.
    APP_MIN_VERSION: str = ""

    APP_LATEST_VERSION: str = ""

    # Maintenance mode: the app shows a friendly "back soon" screen.
    APP_MAINTENANCE: bool = False

    APP_MAINTENANCE_MESSAGE_EN: str = ""
    APP_MAINTENANCE_MESSAGE_RU: str = ""
    APP_MAINTENANCE_MESSAGE_DE: str = ""

    APP_STORE_URL_ANDROID: str = "https://play.google.com/store/apps/details?id=com.prankfx.app"

    APP_STORE_URL_IOS: str = ""

    # --- Snap from a photo (PixVerse v5.5 through fal.ai) -----------
    # Key from https://fal.ai/dashboard/keys — sent as `Authorization: Key …`.
    # It never leaves the server: the app uploads the photo here and this
    # backend talks to fal on its behalf.
    FAL_KEY: str = ""

    FAL_QUEUE_URL: str = "https://queue.fal.run"

    PIXVERSE_MODEL: str = "fal-ai/pixverse/v5.5/image-to-video"

    # 720p x 5 s, no audio, single clip = $0.20 per video at fal's list price.
    # 540p is $0.15; 1080p is $0.40. Audio (+$0.05) and multi-clip (+$0.10)
    # stay off so the cost of a Snap is exactly what was budgeted.
    PIXVERSE_RESOLUTION: str = "720p"

    PIXVERSE_DURATION: str = "5"

    # A 5-second clip is usually back in 40-90 s. Past this the job fails and
    # the FX go back to the user.
    PIXVERSE_JOB_TIMEOUT_SECONDS: float = 420.0

    PIXVERSE_POLL_INTERVAL_SECONDS: float = 3.0

    PIXVERSE_REQUEST_TIMEOUT_SECONDS: float = 120.0

    # A phone photo is 2-6 MB. It is downscaled to 1536 px before it goes
    # anywhere, so this only rejects nonsense.
    SNAP_MAX_PHOTO_BYTES: int = 20 * 1024 * 1024

    # A job whose worker vanished (the server was restarted mid-clip) is
    # failed and refunded once it has been silent this long.
    SNAP_STALE_JOB_MINUTES: int = 20

    # Which Snap effects can actually be made. Everything else is shown in
    # the app as "Coming soon" and refused by the API. Comma-separated ids,
    # or "all". Turning an effect on later is one line here + a restart —
    # no app update.
    SNAP_ENABLED_EFFECTS: str = "snap_fire"

    @property
    def snap_enabled_effects(self) -> set[str] | None:
        value = (self.SNAP_ENABLED_EFFECTS or "").strip()
        if value.lower() in ("", "all", "*"):
            return None
        return {item.strip() for item in value.split(",") if item.strip()}

    # What one Snap costs the user. A photo FX is 1.
    SNAP_FX_COST: int = 10

    # Crossfade into the frozen first frame. Raise it to 0.6 if test clips
    # show a visible jump because people drift out of their pose.
    SNAP_XFADE_SECONDS: float = 0.4

    # 5 seconds of phone video is a few MB; this is a sanity ceiling.
    SNAP_MAX_UPLOAD_BYTES: int = 60 * 1024 * 1024

    # Where finished clips live. Relative paths resolve against backend/.
    SNAP_MEDIA_DIR: str = "media/snaps"

    # Royalty-free impact hit, dropped on the snap frame. A trending track
    # here would fail TikTok's rights matching and app-store review.
    SNAP_IMPACT_SOUND: str = "assets/impact.wav"

    # --- Watermark ------------------------------------------------
    # Burned into finished clips for everyone except premium users. The
    # paywall already promises "no watermark", so this is what makes that
    # promise worth anything — and every reposted clip carries the name.
    SNAP_WATERMARK: bool = True

    SNAP_WATERMARK_PATH: str = "assets/watermark.png"

    # Share of the video width the mark takes up. Past ~0.35 it stops signing
    # the clip and starts competing with it.
    SNAP_WATERMARK_WIDTH_RATIO: float = 0.28

    SNAP_WATERMARK_OPACITY: float = 0.85

    FFMPEG_BIN: str = "ffmpeg"

    FFPROBE_BIN: str = "ffprobe"

    @property
    def snap_media_dir(self) -> str:
        path = Path(self.SNAP_MEDIA_DIR)

        if not path.is_absolute():
            path = ROOT_DIR / path

        path.mkdir(parents=True, exist_ok=True)

        return str(path)

    @property
    def snap_impact_path(self) -> str:
        path = Path(self.SNAP_IMPACT_SOUND)

        if not path.is_absolute():
            path = ROOT_DIR / path

        return str(path)

    @property
    def snap_watermark_path(self) -> str:
        path = Path(self.SNAP_WATERMARK_PATH)

        if not path.is_absolute():
            path = ROOT_DIR / path

        return str(path)

    @property
    def apple_client_ids(self) -> list[str]:
        ids = [
            item.strip()
            for item in self.APPLE_CLIENT_IDS.split(",")
            if item.strip()
        ]

        # Tokens from the Android web flow are issued to the Services ID,
        # not to the iOS bundle id, so both audiences must be accepted.
        if self.APPLE_SERVICE_ID.strip() and self.APPLE_SERVICE_ID.strip() not in ids:
            ids.append(self.APPLE_SERVICE_ID.strip())

        return ids

    @property
    def google_client_ids(self) -> list[str]:
        return [
            item.strip()
            for item in self.GOOGLE_CLIENT_IDS.split(",")
            if item.strip()
        ]

    @property
    def cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.CORS_ORIGINS.split(",")
            if item.strip()
        ]

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        extra="ignore",
    )


settings = Settings()