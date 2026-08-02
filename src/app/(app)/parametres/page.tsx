import { getCompanyProfile, getCurrencies } from "@/features/settings/config";
import { CompanyForm } from "@/components/settings/company-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function ParametresHomePage() {
  const [profile, currencies, { t }] = await Promise.all([
    getCompanyProfile(),
    getCurrencies(),
    getServerI18n(),
  ]);

  return (
    <CompanyForm
      profile={profile}
      currencies={currencies}
      description={t("parametres.companyDescription")}
    />
  );
}
