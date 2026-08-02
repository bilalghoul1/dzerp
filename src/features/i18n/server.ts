import { cookies } from "next/headers";
import {
  createTranslator,
  getDictionary,
  normalizeLocale,
  type TranslateFn,
} from "@/i18n";
import { STORAGE_KEYS, type Locale } from "@/lib/constants";

export async function getServerI18n(): Promise<{
  t: TranslateFn;
  locale: Locale;
}> {
  const store = await cookies();
  const locale = normalizeLocale(store.get(STORAGE_KEYS.locale)?.value);
  return { t: createTranslator(getDictionary(locale)), locale };
}
