import { getCompanyProfile, getCurrencies } from "@/features/settings/config";
import {
  listLookups,
  listWilayas,
  listCommunes,
} from "@/features/lookups/config";
import { CompanyForm } from "@/components/settings/company-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function ParametresHomePage() {
  const [profile, currencies, lookups, wilayas, communes, { t }] =
    await Promise.all([
      getCompanyProfile(),
      getCurrencies(),
      listLookups(),
      listWilayas(),
      listCommunes(),
      getServerI18n(),
    ]);

  const countries = lookups.countries
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.code, label: c.name, labelAr: c.nameAr }));
  const legalForms = lookups.legalForms
    .filter((f) => f.isActive)
    .map((f) => ({ value: f.code, label: f.name, labelAr: f.nameAr }));
  const banks = lookups.banks
    .filter((b) => b.isActive)
    .map((b) => ({ value: b.code, label: b.name, labelAr: b.nameAr }));
  const wilayaOptions = wilayas.map((w) => ({
    value: w.code,
    label: w.name,
    labelAr: w.nameAr,
  }));
  const communeOptions = communes.map((c) => ({
    wilayaCode: c.wilayaCode,
    value: c.code,
    label: c.name,
    labelAr: c.nameAr,
  }));

  return (
    <CompanyForm
      profile={profile}
      currencies={currencies}
      countries={countries}
      legalForms={legalForms}
      banks={banks}
      wilayas={wilayaOptions}
      communes={communeOptions}
      description={t("parametres.companyDescription")}
    />
  );
}
