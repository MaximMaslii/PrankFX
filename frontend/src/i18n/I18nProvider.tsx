/**
 * Localization (EN + RU) with device auto-detection and manual override.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getLocales } from "expo-localization";
import { storage } from "@/src/utils/storage";

export type Lang = "en" | "ru";

const dict = {
  en: {
    // Onboarding
    onboarding_1_title: "Transform photos with AI",
    onboarding_1_sub: "Turn any picture into a cinematic Hollywood scene in seconds.",
    onboarding_2_title: "Create cinematic visual effects",
    onboarding_2_sub: "Movie bruises, explosions, monster attacks, and much more.",
    onboarding_3_title: "Faces, vehicles, houses and more",
    onboarding_3_sub: "Apply premium FX to anything in your photo library.",
    onboarding_4_title: "Start Creating",
    onboarding_4_sub: "Your first cinematic transformation is just one tap away.",
    next: "Next",
    skip: "Skip",
    start: "Start Creating",
    // Auth
    welcome_back: "Welcome back",
    create_account: "Create your account",
    email: "Email",
    password: "Password",
    name: "Your name",
    log_in: "Log In",
    sign_up: "Sign Up",
    continue_google: "Continue with Google",
    forgot_password: "Forgot password?",
    reset_password: "Reset password",
    have_account: "Already have an account? Log in",
    no_account: "Don't have an account? Sign up",
    or: "or",
    // Home
    hi: "Hi",
    home_lead: "Ready to create some cinematic magic?",
    take_photo: "Take Photo",
    upload_photo: "Upload Photo",
    popular_effects: "Popular Effects",
    recent_projects: "Recent Projects",
    no_projects: "No projects yet — create your first!",
    view_all: "See all",
    premium_banner_title: "Unlock Cinematic Pro",
    premium_banner_sub: "Unlimited FX, HD export, no watermark.",
    upgrade: "Upgrade",
    // Effects
    effects: "Effects",
    all: "All",
    face: "Face",
    vehicle: "Vehicle",
    house: "House",
    object: "Object",
    apply_effect: "Apply Effect",
    // Processing
    processing_title: "Applying Cinematic Magic",
    processing_sub: "Our AI is crafting your masterpiece…",
    // Result
    result_title: "Ready!",
    save_gallery: "Save",
    share: "Share",
    done: "Done",
    before: "Before",
    after: "After",
    // History
    history: "History",
    favorites: "Favorites",
    search: "Search effects…",
    empty_history: "No cinematic shots yet",
    empty_history_sub: "Your creations will appear here.",
    delete: "Delete",
    // Premium
    premium: "Premium",
    monthly: "Monthly",
    yearly: "Yearly",
    face_plan: "Face Effects Premium",
    face_plan_desc: "Unlimited Face Effects, HD Export, No Watermark, Priority AI, Unlimited History",
    ultimate_plan: "Ultimate Premium",
    ultimate_plan_desc: "Everything in Face + Vehicles, Houses, Objects, Unlimited AI, Priority Servers",
    per_month: "/mo",
    per_year: "/yr",
    most_popular: "Most Popular",
    subscribe: "Subscribe",
    restore_purchases: "Restore Purchases",
    cancel_subscription: "Cancel Subscription",
    active_plan: "Active plan",
    // Settings
    settings: "Settings",
    preferences: "Preferences",
    language: "Language",
    dark_mode: "Appearance",
    system: "System",
    light: "Light",
    dark: "Dark",
    notifications: "Notifications",
    account: "Account",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    support: "Support",
    logout: "Log Out",
    delete_account: "Delete Account",
    delete_account_confirm: "This will permanently delete your account and all projects. Continue?",
    yes: "Yes",
    cancel: "Cancel",
    // Tabs
    tab_home: "Home",
    tab_effects: "Effects",
    tab_history: "History",
    tab_premium: "Premium",
    tab_settings: "Settings",
    // Misc
    generate: "Generate",
    processing: "Processing…",
    permission_camera: "Camera permission is required",
    permission_media: "Media permission is required",
    open_settings: "Open Settings",
    error_generic: "Something went wrong",
    retry: "Retry",
    close: "Close",
    premium_required: "Premium required",
    premium_required_sub: "Upgrade to unlock this effect.",
    saved: "Saved to gallery",
    // Credits paywall
    credits_free: "free credit",
    credits_free_plural: "free credits",
    credits_left: "left",
    paywall_title: "Unlock Unlimited FX",
    paywall_sub: "You've used your free cinematic transformation. Upgrade to keep creating without limits.",
    paywall_cta: "Get Premium",
    paywall_later: "Maybe later",
  },
  ru: {
    onboarding_1_title: "Преображайте фото с ИИ",
    onboarding_1_sub: "Превратите любое фото в кинокадр за секунды.",
    onboarding_2_title: "Кинематографические эффекты",
    onboarding_2_sub: "Синяки, взрывы, атаки монстров и многое другое.",
    onboarding_3_title: "Лица, машины, дома и не только",
    onboarding_3_sub: "Применяйте премиум-эффекты ко всему.",
    onboarding_4_title: "Начать творить",
    onboarding_4_sub: "Первое кинопреображение — в одно касание.",
    next: "Далее",
    skip: "Пропустить",
    start: "Начать",
    welcome_back: "С возвращением",
    create_account: "Создать аккаунт",
    email: "Email",
    password: "Пароль",
    name: "Ваше имя",
    log_in: "Войти",
    sign_up: "Регистрация",
    continue_google: "Войти через Google",
    forgot_password: "Забыли пароль?",
    reset_password: "Сброс пароля",
    have_account: "Уже есть аккаунт? Войти",
    no_account: "Нет аккаунта? Зарегистрироваться",
    or: "или",
    hi: "Привет",
    home_lead: "Готовы создать киномагию?",
    take_photo: "Сделать фото",
    upload_photo: "Загрузить фото",
    popular_effects: "Популярные эффекты",
    recent_projects: "Последние проекты",
    no_projects: "Ещё нет проектов — создайте первый!",
    view_all: "Все",
    premium_banner_title: "Открой Cinematic Pro",
    premium_banner_sub: "Безлимит эффектов, HD экспорт, без вотермарки.",
    upgrade: "Обновить",
    effects: "Эффекты",
    all: "Все",
    face: "Лицо",
    vehicle: "Авто",
    house: "Дом",
    object: "Объект",
    apply_effect: "Применить",
    processing_title: "Творим киномагию",
    processing_sub: "ИИ создаёт ваш шедевр…",
    result_title: "Готово!",
    save_gallery: "Сохранить",
    share: "Поделиться",
    done: "Готово",
    before: "До",
    after: "После",
    history: "История",
    favorites: "Избранное",
    search: "Поиск эффектов…",
    empty_history: "Пока нет работ",
    empty_history_sub: "Ваши творения появятся здесь.",
    delete: "Удалить",
    premium: "Premium",
    monthly: "Месяц",
    yearly: "Год",
    face_plan: "Face Effects Premium",
    face_plan_desc: "Безлимит эффектов лица, HD, без вотермарки, приоритетный ИИ, вся история",
    ultimate_plan: "Ultimate Premium",
    ultimate_plan_desc: "Всё из Face + Авто, Дома, Объекты, безлимитный ИИ, приоритет",
    per_month: "/мес",
    per_year: "/год",
    most_popular: "Популярный",
    subscribe: "Подписаться",
    restore_purchases: "Восстановить покупки",
    cancel_subscription: "Отменить подписку",
    active_plan: "Активный план",
    settings: "Настройки",
    preferences: "Настройки",
    language: "Язык",
    dark_mode: "Оформление",
    system: "Системное",
    light: "Светлое",
    dark: "Тёмное",
    notifications: "Уведомления",
    account: "Аккаунт",
    privacy: "Политика конфиденциальности",
    terms: "Условия использования",
    support: "Поддержка",
    logout: "Выйти",
    delete_account: "Удалить аккаунт",
    delete_account_confirm: "Аккаунт и все проекты будут удалены навсегда. Продолжить?",
    yes: "Да",
    cancel: "Отмена",
    tab_home: "Главная",
    tab_effects: "Эффекты",
    tab_history: "История",
    tab_premium: "Premium",
    tab_settings: "Настройки",
    generate: "Создать",
    processing: "Обработка…",
    permission_camera: "Нужен доступ к камере",
    permission_media: "Нужен доступ к галерее",
    open_settings: "Открыть настройки",
    error_generic: "Что-то пошло не так",
    retry: "Повторить",
    close: "Закрыть",
    premium_required: "Требуется Premium",
    premium_required_sub: "Обновите план, чтобы открыть эффект.",
    saved: "Сохранено в галерею",
    credits_free: "бесплатный кредит",
    credits_free_plural: "бесплатных кредитов",
    credits_left: "осталось",
    paywall_title: "Открой безлимитные эффекты",
    paywall_sub: "Вы использовали бесплатный кредит. Оформите Premium и создавайте без ограничений.",
    paywall_cta: "Получить Premium",
    paywall_later: "Позже",
  },
} as const;

export type TranslationKey = keyof typeof dict.en;

const KEY = "prankfx.lang";

type I18nContextValue = {
  lang: Lang;
  t: (k: TranslationKey) => string;
  setLang: (l: Lang) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectDeviceLang(): Lang {
  try {
    const locales = getLocales();
    const code = (locales?.[0]?.languageCode || "en").toLowerCase();
    if (code.startsWith("ru")) return "ru";
    return "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, "");
      if (stored === "en" || stored === "ru") setLangState(stored);
      else setLangState(detectDeviceLang());
      setReady(true);
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await storage.setItem(KEY, l);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    t: (k: TranslationKey) => (dict[lang][k] as string) ?? (dict.en[k] as string) ?? k,
  }), [lang, setLang]);

  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
