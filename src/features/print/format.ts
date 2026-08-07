import type { Locale } from "@/lib/constants";

/**
 * Helpers de formatage pour le rendu PDF (serveur). Aucune dépendance UI :
 * produit des chaînes localisées (fr / ar / en) pour les montants, dates et
 * montants en lettres.
 */

export function intlLocale(locale: Locale): string {
  switch (locale) {
    case "ar":
      return "ar-DZ";
    case "en":
      return "en-US";
    default:
      return "fr-FR";
  }
}

export function formatAmount(
  value: number,
  locale: Locale,
  currency = "DZD",
): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(value)
      .replace(/\b(DZD|DA)\b/, "DA");
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatQuantity(value: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      maximumFractionDigits: 3,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function formatRate(value: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Montant en lettres
// ---------------------------------------------------------------------------

const FR_UNITS = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const FR_TENS = [
  "", "dix", "vingt", "trente", "quarante", "cinquante", "soixante",
  "soixante-dix", "quatre-vingt", "quatre-vingt-dix",
];

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7) {
    if (unit === 1) return "soixante et onze";
    return `soixante-${FR_UNITS[10 + unit]}`;
  }
  if (tens === 9) return `quatre-vingt-${FR_UNITS[10 + unit]}`;
  if (unit === 0) return tens === 8 ? "quatre-vingts" : FR_TENS[tens];
  if (unit === 1 && tens !== 8) return `${FR_TENS[tens]} et un`;
  return `${FR_TENS[tens]}-${FR_UNITS[unit]}`;
}

function frBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return frBelow100(rest);
  const hundredWord =
    hundreds === 1
      ? "cent"
      : `${FR_UNITS[hundreds]} cent${rest === 0 ? "s" : ""}`;
  if (rest === 0) return hundredWord;
  return `${hundredWord} ${frBelow100(rest)}`;
}

function numberToWordsFr(n: number): string {
  if (n === 0) return "zéro";
  if (n < 0) return `moins ${numberToWordsFr(-n)}`;
  const groups = ["", "mille", "million", "milliard"];
  const parts: string[] = [];
  let groupIndex = 0;
  let value = n;
  while (value > 0) {
    const chunk = value % 1000;
    if (chunk > 0) {
      const chunkWords = frBelow1000(chunk);
      if (groupIndex === 0) {
        parts.unshift(chunkWords);
      } else if (groupIndex === 1) {
        parts.unshift(chunk === 1 ? "mille" : `${chunkWords} mille`);
      } else {
        const name = groups[groupIndex] ?? `10^${groupIndex * 3}`;
        parts.unshift(
          `${chunkWords} ${name}${chunk > 1 ? "s" : ""}`,
        );
      }
    }
    value = Math.floor(value / 1000);
    groupIndex += 1;
  }
  return parts.join(" ");
}

const EN_UNITS = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];

const EN_TENS = [
  "", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety",
];

function enBelow100(n: number): string {
  if (n < 20) return EN_UNITS[n];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) return EN_TENS[tens];
  return `${EN_TENS[tens]}-${EN_UNITS[unit]}`;
}

function enBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return enBelow100(rest);
  const hundredWord =
    hundreds === 1 ? "one hundred" : `${EN_UNITS[hundreds]} hundred`;
  if (rest === 0) return hundredWord;
  return `${hundredWord} ${enBelow100(rest)}`;
}

function numberToWordsEn(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return `minus ${numberToWordsEn(-n)}`;
  const groups = ["", "thousand", "million", "billion"];
  const parts: string[] = [];
  let groupIndex = 0;
  let value = n;
  while (value > 0) {
    const chunk = value % 1000;
    if (chunk > 0) {
      const chunkWords = enBelow1000(chunk);
      parts.unshift(
        groupIndex === 0 ? chunkWords : `${chunkWords} ${groups[groupIndex]}`,
      );
    }
    value = Math.floor(value / 1000);
    groupIndex += 1;
  }
  return parts.join(" ");
}

const AR_DIGITS = [
  "صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية",
  "تسعة",
];
const AR_TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const AR_TENS = [
  "", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون",
  "ثمانون", "تسعون",
];
const AR_HUNDREDS = [
  "", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة",
  "سبعمائة", "ثمانمائة", "تسعمائة",
];

function arBelow100(n: number): string {
  if (n < 10) return AR_DIGITS[n];
  if (n < 20) return AR_TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) return AR_TENS[tens];
  return `${AR_DIGITS[unit]} و${AR_TENS[tens]}`;
}

function arBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return arBelow100(rest);
  if (rest === 0) return AR_HUNDREDS[hundreds];
  return `${AR_HUNDREDS[hundreds]} و${arBelow100(rest)}`;
}

function arGroupWords(chunk: number, groupIndex: number): string {
  const chunkWords = arBelow1000(chunk);
  if (groupIndex === 0) return chunkWords;
  if (groupIndex === 1) {
    if (chunk === 1) return "ألف";
    if (chunk === 2) return "ألفان";
    if (chunk <= 10) return `${AR_DIGITS[chunk]} آلاف`;
    return `${chunkWords} ألفًا`;
  }
  if (groupIndex === 2) {
    if (chunk === 1) return "مليون";
    if (chunk === 2) return "مليونان";
    if (chunk <= 10) return `${AR_DIGITS[chunk]} ملايين`;
    return `${chunkWords} مليونًا`;
  }
  const name = "مليار";
  if (chunk === 1) return name;
  if (chunk === 2) return "ملياران";
  return `${chunkWords} ${name}ًا`;
}

function numberToWordsAr(n: number): string {
  if (n === 0) return "صفر";
  if (n < 0) return `سالب ${numberToWordsAr(-n)}`;
  const parts: string[] = [];
  let groupIndex = 0;
  let value = n;
  while (value > 0) {
    const chunk = value % 1000;
    if (chunk > 0) parts.unshift(arGroupWords(chunk, groupIndex));
    value = Math.floor(value / 1000);
    groupIndex += 1;
  }
  return parts.join(" ");
}

const CURRENCY_NAMES: Record<
  string,
  Record<Locale, { main: string; fractional: string }>
> = {
  DZD: {
    fr: { main: "dinars algériens", fractional: "centimes" },
    en: { main: "Algerian dinars", fractional: "cents" },
    ar: { main: "دينار جزائري", fractional: "سنتيم" },
  },
  EUR: {
    fr: { main: "euros", fractional: "centimes" },
    en: { main: "euros", fractional: "cents" },
    ar: { main: "يورو", fractional: "سنت" },
  },
  USD: {
    fr: { main: "dollars", fractional: "cents" },
    en: { main: "US dollars", fractional: "cents" },
    ar: { main: "دولار أمريكي", fractional: "سنت" },
  },
  GBP: {
    fr: { main: "livres sterling", fractional: "pence" },
    en: { main: "pounds sterling", fractional: "pence" },
    ar: { main: "جنيه إسترليني", fractional: "بنس" },
  },
  TND: {
    fr: { main: "dinars tunisiens", fractional: "millimes" },
    en: { main: "Tunisian dinars", fractional: "millimes" },
    ar: { main: "دينار تونسي", fractional: "ملّيم" },
  },
  MAD: {
    fr: { main: "dirhams marocains", fractional: "centimes" },
    en: { main: "Moroccan dirhams", fractional: "cents" },
    ar: { main: "درهم مغربي", fractional: "سنتيم" },
  },
  SAR: {
    fr: { main: "riyals saoudiens", fractional: "halalas" },
    en: { main: "Saudi riyals", fractional: "halalas" },
    ar: { main: "ريال سعودي", fractional: "هللة" },
  },
};

function toWords(n: number, locale: Locale): string {
  if (locale === "ar") return numberToWordsAr(n);
  if (locale === "en") return numberToWordsEn(n);
  return numberToWordsFr(n);
}

/**
 * Montant en lettres, ex. « deux mille cinq cents dinars algériens et 50 centimes ».
 * Les décimales sont rendues en chiffres, le tout composé avec la devise localisée.
 */
export function amountToWords(
  value: number,
  locale: Locale,
  currency = "DZD",
): string {
  const safe = Number.isFinite(value) ? Math.abs(Math.round(value * 100)) : 0;
  const integer = Math.floor(safe / 100);
  const decimals = safe % 100;
  const names = CURRENCY_NAMES[currency] ?? {
    fr: { main: currency, fractional: "centimes" },
    en: { main: currency, fractional: "cents" },
    ar: { main: currency, fractional: "سنتيم" },
  };
  const name = names[locale];

  const sign = value < 0 ? (locale === "ar" ? "سالب " : "moins ") : "";
  const integerWords = toWords(integer, locale);
  const base =
    locale === "ar"
      ? `${sign}${integerWords} ${name.main}`
      : `${sign}${integerWords} ${name.main}`;

  if (decimals === 0) return base;
  const dec = String(decimals).padStart(2, "0");
  if (locale === "ar") {
    return `${base} و${dec} ${name.fractional}`;
  }
  if (locale === "en") {
    return `${base} and ${dec} ${name.fractional}`;
  }
  return `${base} et ${dec} ${name.fractional}`;
}
