import { getCompanyProfile } from "@/features/settings/config";
import { CompanySettingsCenter } from "@/components/settings/company-settings-center";

export const dynamic = "force-dynamic";

export default async function ParametresHomePage() {
  const profile = await getCompanyProfile();

  return (
    <div>
      <CompanySettingsCenter profile={profile} />
    </div>
  );
}
