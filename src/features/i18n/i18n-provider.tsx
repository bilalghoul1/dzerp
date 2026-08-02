"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  DEFAULT_LOCALE,
  LOCALES,
  STORAGE_KEYS,
  type Locale,
} from "@/lib/constants";
import {
  createTranslator,
  getDictionary,
  getDirection,
  type TranslateFn,
} from "@/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  dir: "ltr" | "rtl";
  locales: readonly Locale[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = usePersistedState<Locale>(
    STORAGE_KEYS.locale,
    DEFAULT_LOCALE,
  );

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getDirection(locale);
    document.cookie = `${STORAGE_KEYS.locale}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const t = useMemo(() => createTranslator(getDictionary(locale)), [locale]);
  const dir = getDirection(locale);

  const setLocale = useCallback(
    (next: Locale) => setLocaleState(next),
    [setLocaleState],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, dir, locales: LOCALES }),
    [locale, setLocale, t, dir],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
