import { getUnits } from "@/features/settings/config";
import { UnitsForm } from "@/components/settings/units-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const [rows, { t }] = await Promise.all([getUnits(), getServerI18n()]);
  return <UnitsForm rows={rows} description={t("parametres.unitsDescription")} />;
}
