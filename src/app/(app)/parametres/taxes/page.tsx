import { getTaxRates } from "@/features/settings/config";
import { TaxesForm } from "@/components/settings/taxes-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function TaxesPage() {
  const [rows, { t }] = await Promise.all([getTaxRates(), getServerI18n()]);
  return <TaxesForm rows={rows} description={t("parametres.taxesDescription")} />;
}
