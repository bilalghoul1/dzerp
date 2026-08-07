import { redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listDocumentSeries } from "@/features/documents/series";
import { SeriesManager } from "@/components/settings/series-manager";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function NumberingPage() {
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

  const [series, { t }] = await Promise.all([
    listDocumentSeries(),
    getServerI18n(),
  ]);
  return (
    <SeriesManager
      series={series.map((s) => ({
        ...s,
        nextValue: Number(s.nextValue),
      }))}
      description={t("parametres.numberingDescription")}
    />
  );
}
