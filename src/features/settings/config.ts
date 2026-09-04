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
  // Général
  name: string;
  nameAr: string;
  legalName: string;
  legalForm: string;
  capital: string;
  activity: string;
  secondaryActivity: string;
  establishedAt: string;
  // Légal
  taxId: string;
  rc: string;
  nis: string;
  ai: string;
  vatNumber: string;
  // Adresse
  country: string;
  wilaya: string;
  commune: string;
  postalCode: string;
  address: string;
  // Contacts
  phone: string;
  mobile: string;
  email: string;
  website: string;
  // Banque
  bank: string;
  bankAgency: string;
  bankAccount: string;
  rib: string;
  iban: string;
  swift: string;
  // Identité visuelle & Impression
  logoKey: string;
  stampKey: string;
  signatureKey: string;
  primaryColor: string;
  printHeader: string;
  invoiceFooter: string;
  printFormat: string;
  // Technique
  currency: string;
  fiscalYear: number;
  locale: string;
  theme: string;
  notificationsEmail: boolean;
  qrEnabled: boolean;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "DzERP Algérie",
  nameAr: "",
  legalName: "",
  legalForm: "",
  capital: "",
  activity: "",
  secondaryActivity: "",
  establishedAt: "",
  taxId: "",
  rc: "",
  nis: "",
  ai: "",
  vatNumber: "",
  country: "DZ",
  wilaya: "",
  commune: "",
  postalCode: "",
  address: "",
  phone: "",
  mobile: "",
  email: "",
  website: "",
  bank: "",
  bankAgency: "",
  bankAccount: "",
  rib: "",
  iban: "",
  swift: "",
  logoKey: "",
  stampKey: "",
  signatureKey: "",
  primaryColor: "",
  printHeader: "",
  invoiceFooter: "",
  printFormat: "A4",
  currency: "DZD",
  fiscalYear: new Date().getFullYear(),
  locale: "fr",
  theme: "light",
  notificationsEmail: true,
  qrEnabled: false,
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
  const keys = [
    "company.name",
    "company.nameAr",
    "company.legalName",
    "company.legalForm",
    "company.capital",
    "company.activity",
    "company.secondaryActivity",
    "company.establishedAt",
    "company.taxId",
    "company.rc",
    "company.nis",
    "company.ai",
    "company.vatNumber",
    "company.country",
    "company.wilaya",
    "company.commune",
    "company.postalCode",
    "company.address",
    "company.phone",
    "company.mobile",
    "company.email",
    "company.website",
    "company.bank",
    "company.bankAgency",
    "company.bankAccount",
    "company.rib",
    "company.iban",
    "company.swift",
    "company.logoKey",
    "company.stampKey",
    "company.signatureKey",
    "company.primaryColor",
    "company.printHeader",
    "company.invoiceFooter",
    "company.printFormat",
    "company.currency",
    "fiscal.year",
    "locale.default",
    "theme.default",
    "notifications.email",
    "print.defaultFormat",
    "documents.qr.enabled",
  ] as const;

  const values = await Promise.all(
    keys.map((key) => getSetting(key)),
  );

  const pick = (index: number, fallback: string) =>
    asString(values[index], fallback);

  return {
    name: pick(0, DEFAULT_COMPANY_PROFILE.name),
    nameAr: pick(1, DEFAULT_COMPANY_PROFILE.nameAr),
    legalName: pick(2, DEFAULT_COMPANY_PROFILE.legalName),
    legalForm: pick(3, DEFAULT_COMPANY_PROFILE.legalForm),
    capital: pick(4, DEFAULT_COMPANY_PROFILE.capital),
    activity: pick(5, DEFAULT_COMPANY_PROFILE.activity),
    secondaryActivity: pick(6, DEFAULT_COMPANY_PROFILE.secondaryActivity),
    establishedAt: pick(7, DEFAULT_COMPANY_PROFILE.establishedAt),
    taxId: pick(8, DEFAULT_COMPANY_PROFILE.taxId),
    rc: pick(9, DEFAULT_COMPANY_PROFILE.rc),
    nis: pick(10, DEFAULT_COMPANY_PROFILE.nis),
    ai: pick(11, DEFAULT_COMPANY_PROFILE.ai),
    vatNumber: pick(12, DEFAULT_COMPANY_PROFILE.vatNumber),
    country: pick(13, DEFAULT_COMPANY_PROFILE.country),
    wilaya: pick(14, DEFAULT_COMPANY_PROFILE.wilaya),
    commune: pick(15, DEFAULT_COMPANY_PROFILE.commune),
    postalCode: pick(16, DEFAULT_COMPANY_PROFILE.postalCode),
    address: pick(17, DEFAULT_COMPANY_PROFILE.address),
    phone: pick(18, DEFAULT_COMPANY_PROFILE.phone),
    mobile: pick(19, DEFAULT_COMPANY_PROFILE.mobile),
    email: pick(20, DEFAULT_COMPANY_PROFILE.email),
    website: pick(21, DEFAULT_COMPANY_PROFILE.website),
    bank: pick(22, DEFAULT_COMPANY_PROFILE.bank),
    bankAgency: pick(23, DEFAULT_COMPANY_PROFILE.bankAgency),
    bankAccount: pick(24, DEFAULT_COMPANY_PROFILE.bankAccount),
    rib: pick(25, DEFAULT_COMPANY_PROFILE.rib),
    iban: pick(26, DEFAULT_COMPANY_PROFILE.iban),
    swift: pick(27, DEFAULT_COMPANY_PROFILE.swift),
    logoKey: pick(28, DEFAULT_COMPANY_PROFILE.logoKey),
    stampKey: pick(29, DEFAULT_COMPANY_PROFILE.stampKey),
    signatureKey: pick(30, DEFAULT_COMPANY_PROFILE.signatureKey),
    primaryColor: pick(31, DEFAULT_COMPANY_PROFILE.primaryColor),
    printHeader: pick(32, DEFAULT_COMPANY_PROFILE.printHeader),
    invoiceFooter: pick(33, DEFAULT_COMPANY_PROFILE.invoiceFooter),
    printFormat: pick(34, DEFAULT_COMPANY_PROFILE.printFormat),
    currency: pick(35, DEFAULT_COMPANY_PROFILE.currency),
    fiscalYear: asNumber(values[36], DEFAULT_COMPANY_PROFILE.fiscalYear),
    locale: pick(37, DEFAULT_COMPANY_PROFILE.locale),
    theme: pick(38, DEFAULT_COMPANY_PROFILE.theme),
    notificationsEmail: asBoolean(
      values[39],
      DEFAULT_COMPANY_PROFILE.notificationsEmail,
    ),
    qrEnabled: asBoolean(values[41], DEFAULT_COMPANY_PROFILE.qrEnabled),
  };
}

export async function updateCompanyProfile(
  input: Partial<CompanyProfile>,
  updatedById?: string | null,
): Promise<void> {
  const updates: { key: string; value: SettingValue; type?: "STRING" | "NUMBER" | "BOOLEAN" }[] = [
    { key: "company.name", value: input.name ?? "", type: "STRING" },
    { key: "company.nameAr", value: input.nameAr ?? "", type: "STRING" },
    { key: "company.legalName", value: input.legalName ?? "", type: "STRING" },
    { key: "company.legalForm", value: input.legalForm ?? "", type: "STRING" },
    { key: "company.capital", value: input.capital ?? "", type: "STRING" },
    { key: "company.activity", value: input.activity ?? "", type: "STRING" },
    { key: "company.secondaryActivity", value: input.secondaryActivity ?? "", type: "STRING" },
    { key: "company.establishedAt", value: input.establishedAt ?? "", type: "STRING" },
    { key: "company.taxId", value: input.taxId ?? "", type: "STRING" },
    { key: "company.rc", value: input.rc ?? "", type: "STRING" },
    { key: "company.nis", value: input.nis ?? "", type: "STRING" },
    { key: "company.ai", value: input.ai ?? "", type: "STRING" },
    { key: "company.vatNumber", value: input.vatNumber ?? "", type: "STRING" },
    { key: "company.country", value: input.country ?? "DZ", type: "STRING" },
    { key: "company.wilaya", value: input.wilaya ?? "", type: "STRING" },
    { key: "company.commune", value: input.commune ?? "", type: "STRING" },
    { key: "company.postalCode", value: input.postalCode ?? "", type: "STRING" },
    { key: "company.address", value: input.address ?? "", type: "STRING" },
    { key: "company.phone", value: input.phone ?? "", type: "STRING" },
    { key: "company.mobile", value: input.mobile ?? "", type: "STRING" },
    { key: "company.email", value: input.email ?? "", type: "STRING" },
    { key: "company.website", value: input.website ?? "", type: "STRING" },
    { key: "company.bank", value: input.bank ?? "", type: "STRING" },
    { key: "company.bankAgency", value: input.bankAgency ?? "", type: "STRING" },
    { key: "company.bankAccount", value: input.bankAccount ?? "", type: "STRING" },
    { key: "company.rib", value: input.rib ?? "", type: "STRING" },
    { key: "company.iban", value: input.iban ?? "", type: "STRING" },
    { key: "company.swift", value: input.swift ?? "", type: "STRING" },
    { key: "company.logoKey", value: input.logoKey ?? "", type: "STRING" },
    { key: "company.stampKey", value: input.stampKey ?? "", type: "STRING" },
    { key: "company.signatureKey", value: input.signatureKey ?? "", type: "STRING" },
    { key: "company.primaryColor", value: input.primaryColor ?? "", type: "STRING" },
    { key: "company.printHeader", value: input.printHeader ?? "", type: "STRING" },
    { key: "company.invoiceFooter", value: input.invoiceFooter ?? "", type: "STRING" },
    { key: "company.printFormat", value: input.printFormat ?? "A4", type: "STRING" },
    { key: "company.currency", value: input.currency ?? "DZD", type: "STRING" },
    { key: "fiscal.year", value: input.fiscalYear ?? new Date().getFullYear(), type: "NUMBER" },
    { key: "locale.default", value: input.locale ?? "fr", type: "STRING" },
    { key: "theme.default", value: input.theme ?? "light", type: "STRING" },
    { key: "notifications.email", value: input.notificationsEmail ?? true, type: "BOOLEAN" },
    { key: "print.defaultFormat", value: input.printFormat ?? "A4", type: "STRING" },
    { key: "documents.qr.enabled", value: input.qrEnabled ?? false, type: "BOOLEAN" },
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
