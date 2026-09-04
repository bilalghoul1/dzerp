import {
  getSetting,
  setSetting,
  type SettingValue,
} from "@/features/settings/server";
import { getCurrentUser } from "@/features/auth/rbac";
import { resolveCompanyContext } from "@/features/company/resolver";
import {
  getCompanySettings,
  updateCompanySettings,
  type CompanyField,
} from "@/features/company/settings";

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

/**
 * @deprecated Compatibility wrapper — reads from the canonical Company model
 * (via `getCompanySettings`) and global Setting for app-wide preferences only.
 * Company identity, legal, contact, branding, print, and QR data are read
 * exclusively from the `Company` model, never from the global `Setting` table.
 *
 * Prefer using `getCompanySettings(companyId)` + `getSetting()` directly.
 * Phase 4 has rebuilt the settings UI. This function is no longer used by any
 * active component. Scheduled for removal in a future cleanup.
 */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const session = await getCurrentUser();
  if (!session) return DEFAULT_COMPANY_PROFILE;

  try {
    const context = await resolveCompanyContext(session);
    const cs = await getCompanySettings(context.company.id);

    // Read app-wide preferences from global Setting (the ONLY legitimate Setting reads).
    const [localeVal, themeVal, notifVal, fiscalVal] = await Promise.all([
      getSetting("locale.default"),
      getSetting("theme.default"),
      getSetting("notifications.email"),
      getSetting("fiscal.year"),
    ]);

    const s = (key: CompanyField) => (cs[key] as string) ?? "";

    return {
      name: s("name") || DEFAULT_COMPANY_PROFILE.name,
      nameAr: s("nameAr"),
      legalName: s("legalName"),
      legalForm: s("legalForm"),
      capital: s("capital"),
      activity: s("activity"),
      secondaryActivity: s("secondaryActivity"),
      establishedAt: s("establishedAt"),
      taxId: s("taxId"),
      rc: s("rc"),
      nis: s("nis"),
      ai: s("ai"),
      vatNumber: s("vatNumber"),
      country: s("country") || "DZ",
      wilaya: s("wilaya"),
      commune: s("commune"),
      postalCode: s("postalCode"),
      address: s("address"),
      phone: s("phone"),
      mobile: s("mobile"),
      email: s("email"),
      website: s("website"),
      bank: s("bank"),
      bankAgency: s("bankAgency"),
      bankAccount: s("bankAccount"),
      rib: s("rib"),
      iban: s("iban"),
      swift: s("swift"),
      logoKey: s("logoKey"),
      stampKey: s("stampKey"),
      signatureKey: s("signatureKey"),
      primaryColor: s("primaryColor"),
      printHeader: s("printHeader"),
      invoiceFooter: s("invoiceFooter"),
      printFormat: s("printFormat") || "A4",
      currency: s("currency") || "DZD",
      qrEnabled: Boolean(cs.qrEnabled),
      fiscalYear: asNumber(fiscalVal, DEFAULT_COMPANY_PROFILE.fiscalYear),
      locale: asString(localeVal, DEFAULT_COMPANY_PROFILE.locale),
      theme: asString(themeVal, DEFAULT_COMPANY_PROFILE.theme),
      notificationsEmail: asBoolean(notifVal, DEFAULT_COMPANY_PROFILE.notificationsEmail),
    };
  } catch {
    // Fallback: company resolution failed (no access), return defaults.
    return DEFAULT_COMPANY_PROFILE;
  }
}

/**
 * @deprecated Compatibility wrapper — delegates to `updateCompanySettings()`
 * for company-owned fields and `setSetting()` for app-wide preferences.
 * Never writes company identity to the global Setting table.
 * Scheduled for removal in Phase 4.
 */
export async function updateCompanyProfile(
  input: Partial<CompanyProfile>,
  updatedById?: string | null,
): Promise<void> {
  const session = await getCurrentUser();
  if (!session) return;

  const context = await resolveCompanyContext(session);
  const companyId = context.company.id;

  // Company-owned fields → Company model exclusively
  const companyFields: Record<string, unknown> = {};
  if (input.name !== undefined) companyFields.name = input.name;
  if (input.nameAr !== undefined) companyFields.nameAr = input.nameAr;
  if (input.legalName !== undefined) companyFields.legalName = input.legalName;
  if (input.legalForm !== undefined) companyFields.legalForm = input.legalForm;
  if (input.capital !== undefined) companyFields.capital = input.capital;
  if (input.activity !== undefined) companyFields.activity = input.activity;
  if (input.secondaryActivity !== undefined) companyFields.secondaryActivity = input.secondaryActivity;
  if (input.establishedAt !== undefined) companyFields.establishedAt = input.establishedAt;
  if (input.taxId !== undefined) companyFields.taxId = input.taxId;
  if (input.rc !== undefined) companyFields.rc = input.rc;
  if (input.nis !== undefined) companyFields.nis = input.nis;
  if (input.ai !== undefined) companyFields.ai = input.ai;
  if (input.vatNumber !== undefined) companyFields.vatNumber = input.vatNumber;
  if (input.country !== undefined) companyFields.country = input.country;
  if (input.wilaya !== undefined) companyFields.wilaya = input.wilaya;
  if (input.commune !== undefined) companyFields.commune = input.commune;
  if (input.postalCode !== undefined) companyFields.postalCode = input.postalCode;
  if (input.address !== undefined) companyFields.address = input.address;
  if (input.phone !== undefined) companyFields.phone = input.phone;
  if (input.mobile !== undefined) companyFields.mobile = input.mobile;
  if (input.email !== undefined) companyFields.email = input.email;
  if (input.website !== undefined) companyFields.website = input.website;
  if (input.bank !== undefined) companyFields.bank = input.bank;
  if (input.bankAgency !== undefined) companyFields.bankAgency = input.bankAgency;
  if (input.bankAccount !== undefined) companyFields.bankAccount = input.bankAccount;
  if (input.rib !== undefined) companyFields.rib = input.rib;
  if (input.iban !== undefined) companyFields.iban = input.iban;
  if (input.swift !== undefined) companyFields.swift = input.swift;
  if (input.logoKey !== undefined) companyFields.logoKey = input.logoKey;
  if (input.stampKey !== undefined) companyFields.stampKey = input.stampKey;
  if (input.signatureKey !== undefined) companyFields.signatureKey = input.signatureKey;
  if (input.primaryColor !== undefined) companyFields.primaryColor = input.primaryColor;
  if (input.printHeader !== undefined) companyFields.printHeader = input.printHeader;
  if (input.invoiceFooter !== undefined) companyFields.invoiceFooter = input.invoiceFooter;
  if (input.printFormat !== undefined) companyFields.printFormat = input.printFormat;
  if (input.currency !== undefined) companyFields.currency = input.currency;
  if (input.qrEnabled !== undefined) companyFields.qrEnabled = input.qrEnabled;

  if (Object.keys(companyFields).length > 0) {
    await updateCompanySettings(companyId, companyFields, updatedById ?? session.user.id);
  }

  // App-wide preferences → global Setting (the ONLY legitimate Setting writes)
  const prefUpdates: { key: string; value: SettingValue; type?: "STRING" | "NUMBER" | "BOOLEAN" }[] = [];
  if (input.fiscalYear !== undefined) {
    prefUpdates.push({ key: "fiscal.year", value: input.fiscalYear, type: "NUMBER" });
  }
  if (input.locale !== undefined) {
    prefUpdates.push({ key: "locale.default", value: input.locale, type: "STRING" });
  }
  if (input.theme !== undefined) {
    prefUpdates.push({ key: "theme.default", value: input.theme, type: "STRING" });
  }
  if (input.notificationsEmail !== undefined) {
    prefUpdates.push({ key: "notifications.email", value: input.notificationsEmail, type: "BOOLEAN" });
  }

  if (prefUpdates.length > 0) {
    await Promise.all(
      prefUpdates.map((u) => setSetting({ ...u, updatedById })),
    );
  }
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
