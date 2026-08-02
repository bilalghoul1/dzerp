import {
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/constants";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

const LOCALES: readonly Locale[] = ["fr", "ar", "en"];

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type TranslateFn = {
  (key: keyof Dictionary): string;
  (key: string, params?: Record<string, string | number>): string;
};

export function createTranslator(dict: Dictionary): TranslateFn {
  return ((key: string, params?: Record<string, string | number>) => {
    const value = key
      .split(".")
      .reduce<unknown>((acc, part) => {
        if (acc === null || acc === undefined) return undefined;
        return (acc as Record<string, unknown>)[part];
      }, dict);
    const template =
      typeof value === "string" ? value : String(key);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`,
    );
  }) as TranslateFn;
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
