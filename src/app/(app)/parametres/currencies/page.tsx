import { getCurrencies } from "@/features/settings/config";
import { CurrenciesForm } from "@/components/settings/currencies-form";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const [rows, { t }] = await Promise.all([getCurrencies(), getServerI18n()]);
  return <CurrenciesForm rows={rows} description={t("parametres.currenciesDescription")} />;
}
