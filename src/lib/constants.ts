export const APP_NAME = "DzERP";
export const APP_TAGLINE = "Algérie Enterprise";
export const APP_VERSION = "0.1.0";

export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const APP_THEMES = ["light", "dark"] as const;
export type Theme = (typeof APP_THEMES)[number];
export const DEFAULT_THEME: Theme = "light";

export const STORAGE_KEYS = {
  locale: "dzerp.lang",
  theme: "dzerp.theme",
  session: "dzerp.session",
} as const;

export const SESSION_COOKIE = "dzerp.session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export const BRANCH_COOKIE = "dzerp.branch";
