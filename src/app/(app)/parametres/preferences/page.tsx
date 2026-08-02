import { getCompanyProfile } from "@/features/settings/config";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const [profile, { t }] = await Promise.all([
    getCompanyProfile(),
    getServerI18n(),
  ]);
  return (
    <PreferencesForm
      profile={profile}
      description={t("parametres.preferencesDescription")}
    />
  );
}
