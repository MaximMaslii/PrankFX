# PrankFX (FX Vision AI) — Product Requirements

## Vision
Premium mobile app that transforms user photos into cinematic Hollywood-style
scenes with AI. Fictional entertainment effects (movie bruises, explosions,
zombie makeup, destroyed vehicles/houses, etc.) applied while preserving the
subject's identity, pose, background, and lighting.

## Stack
- **Frontend**: Expo SDK 54 + React Native + Expo Router (file-based)
- **Backend**: FastAPI + Motor (async MongoDB) + Emergent Integrations
- **AI**: Gemini Nano Banana (`gemini-3.1-flash-image-preview`) via Emergent LLM Key
- **Auth**: JWT (email/password, bcrypt) + Emergent-managed Google OAuth
- **Payments**: Mock subscription (preview) — Stripe wiring provided for production
- **Localization**: English & Russian (auto-detect via `expo-localization`)
- **Storage**: MongoDB (`users`, `user_sessions`, `projects`)

## Features (MVP delivered)
- **Onboarding** — 4 cinematic full-bleed pages with paginated dots + Skip
- **Auth** — Email/password login, register, forgot password + Google OAuth via Emergent
- **Home** — Big Camera / Upload cards, Popular Effects strip, Recent Projects, Premium banner
- **Effects Grid** — Category chips (All / Face / Vehicle / House / Object), 2-column masonry
- **Create Flow** — Pick source → Pick effect → Processing (animated scan) → Result
- **Before/After Slider** — Interactive drag comparison of original vs AI result
- **History** — Search, favorite, delete; "All" / "Favorites" tabs
- **Premium** — Animated pricing cards, monthly/yearly toggle, restore, cancel
- **Settings** — Language (EN/RU), theme (system/light/dark), notifications, privacy/terms/support, logout, delete account
- **Bottom Tabs** — Home / Effects / History / Premium / Settings with glass blur tab bar

## Effect catalog (50 total)
- Face (20): bruises, black eye, bandages, swollen, action hero, zombie, pirate scar, comic fight, monster attack, vampire bite, alien attack, robot damage, fire burn, ice damage, magic explosion, paintball, cake smash, food fight, funny makeup, hollywood FX
- Vehicle (12): broken windshield, scratches, mud, rust, burned paint, police chase, apocalypse car, monster truck, abandoned, flood, comic crash, movie explosion
- House (10): destroyed wall, broken windows, flood, fire, haunted, jungle, snow, post apocalypse, hollywood explosion, abandoned building
- Object (8): cinematic phone/laptop/tv/motorcycle/boat/bicycle/furniture/electronics

Each effect prompt preserves identity/pose/background/lighting.

## Premium tiers
- Face Effects Premium — $4.99/mo · $39.99/yr — unlocks all Face effects, HD export, no watermark
- Ultimate Premium — $14.99/mo · $119.99/yr — everything + Vehicles/Houses/Objects, unlimited AI

## Design tokens
- Palette: Cinematic Red `#FF3B30` on iOS-native neutrals (light + dark)
- Radius: 8/16/24 (squircle-friendly)
- Typography: Geist family, iOS-native scale
- Motion: react-native-reanimated + expo-haptics on every tap

## Not built (deferred)
- Real Stripe checkout (keys placeholder — mock activation flows enabled)
- Native gallery save (uses Share sheet; save button toasts confirmation)
- Push notifications
- Apple Sign-In (Google Emergent only)
