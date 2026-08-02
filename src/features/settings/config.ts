import {
  getSetting,
  setSetting,
  type SettingValue,
} from "@/features/settings/server";

export type TaxRate = {
  key: string;
  label: string;
  rate: number;
  isDefault?: boolean;
  exempt?: boolean;
};

export type CurrencyItem = {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UnitItem = {
  key: string;
  label: string;
  labelAr?: string;
  precision?: number;
};

export const DEFAULT_TAX_RATES: TaxRate[] = [
  { key: "TVA_19", label: "TVA 19%", rate: 19, isDefault: true },
  { key: "TVA_09", label: "TVA 9%", rate: 9 },
  { key: "TVA_00", label: "Exonéré (0%)", rate: 0, exempt: true },
];

export const DEFAULT_CURRENCIES: CurrencyItem[] = [
  { code: "DZD", name: "Dinar Algérien", symbol: "دج", rate: 1, isDefault: true, isActive: true },
  { code: "EUR", name: "Euro", symbol: "€", rate: 145, isActive: true },
  { code: "USD", name: "Dollar US", symbol: "$", rate: 135, isActive: true },
];

export const DEFAULT_UNITS: UnitItem[] = [
  { key: "u", label: "Unité", labelAr: "وحدة" },
  { key: "m", label: "Mètre", labelAr: "متر" },
  { key: "kg", label: "Kilogramme", labelAr: "كيلوغرام" },
  { key: "rouleau", label: "Rouleau", labelAr: "لفة" },
  { key: "carton", label: "Carton", labelAr: "كرتون" },
];

export type CompanyProfile = {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  fiscalYear: number;
  locale: string;
  theme: string;
  notificationsEmail: boolean;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "DzERP Algérie",
  taxId: "",
  address: "",
  phone: "",
  email: "",
  currency: "DZD",
  fiscalYear: new Date().getFullYear(),
  locale: "fr",
  theme: "light",
  notificationsEmail: true,
};

function asString(value: SettingValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: SettingValue | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function asBoolean(value: SettingValue | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asArray<T>(value: SettingValue | undefined, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const [
    name,
    taxId,
    address,
    phone,
    email,
    currency,
    fiscalYear,
    locale,
    theme,
    notificationsEmail,
  ] = await Promise.all([
    getSetting("company.name"),
    getSetting("company.taxId"),
    getSetting("company.address"),
    getSetting("company.phone"),
    getSetting("company.email"),
    getSetting("company.currency"),
    getSetting("fiscal.year"),
    getSetting("locale.default"),
    getSetting("theme.default"),
    getSetting("notifications.email"),
  ]);

  return {
    name: asString(name, DEFAULT_COMPANY_PROFILE.name),
    taxId: asString(taxId, DEFAULT_COMPANY_PROFILE.taxId),
    address: asString(address, DEFAULT_COMPANY_PROFILE.address),
    phone: asString(phone, DEFAULT_COMPANY_PROFILE.phone),
    email: asString(email, DEFAULT_COMPANY_PROFILE.email),
    currency: asString(currency, DEFAULT_COMPANY_PROFILE.currency),
    fiscalYear: asNumber(fiscalYear, DEFAULT_COMPANY_PROFILE.fiscalYear),
    locale: asString(locale, DEFAULT_COMPANY_PROFILE.locale),
    theme: asString(theme, DEFAULT_COMPANY_PROFILE.theme),
    notificationsEmail: asBoolean(
      notificationsEmail,
      DEFAULT_COMPANY_PROFILE.notificationsEmail,
    ),
  };
}

export async function updateCompanyProfile(
  input: Partial<CompanyProfile>,
  updatedById?: string | null,
): Promise<void> {
  const updates: { key: string; value: SettingValue; type?: "STRING" | "NUMBER" | "BOOLEAN" }[] = [
    { key: "company.name", value: input.name ?? "", type: "STRING" },
    { key: "company.taxId", value: input.taxId ?? "", type: "STRING" },
    { key: "company.address", value: input.address ?? "", type: "STRING" },
    { key: "company.phone", value: input.phone ?? "", type: "STRING" },
    { key: "company.email", value: input.email ?? "", type: "STRING" },
    { key: "company.currency", value: input.currency ?? "DZD", type: "STRING" },
    { key: "fiscal.year", value: input.fiscalYear ?? new Date().getFullYear(), type: "NUMBER" },
    { key: "locale.default", value: input.locale ?? "fr", type: "STRING" },
    { key: "theme.default", value: input.theme ?? "light", type: "STRING" },
    { key: "notifications.email", value: input.notificationsEmail ?? true, type: "BOOLEAN" },
  ];

  await Promise.all(
    updates.map((u) => setSetting({ ...u, updatedById })),
  );
}

export async function getTaxRates(): Promise<TaxRate[]> {
  return asArray<TaxRate>(await getSetting("tax.rates"), DEFAULT_TAX_RATES);
}

export async function setTaxRates(rates: TaxRate[], updatedById?: string | null): Promise<void> {
  await setSetting({
    key: "tax.rates",
    value: rates,
    type: "JSON",
    description: "Taux de TVA configurés",
    updatedById,
  });
}

export async function getCurrencies(): Promise<CurrencyItem[]> {
  return asArray<CurrencyItem>(
    await getSetting("currency.list"),
    DEFAULT_CURRENCIES,
  );
}

export async function setCurrencies(
  currencies: CurrencyItem[],
  updatedById?: string | null,
): Promise<void> {
  await setSetting({
    key: "currency.list",
    value: currencies,
    type: "JSON",
    description: "Liste des devises",
    updatedById,
  });
}

export async function getUnits(): Promise<UnitItem[]> {
  return asArray<UnitItem>(await getSetting("units.list"), DEFAULT_UNITS);
}

export async function setUnits(
  units: UnitItem[],
  updatedById?: string | null,
): Promise<void> {
  await setSetting({
    key: "units.list",
    value: units,
    type: "JSON",
    description: "Unités de mesure",
    updatedById,
  });
}
