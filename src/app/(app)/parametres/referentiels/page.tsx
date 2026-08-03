import { LookupsManager } from "@/components/settings/lookups-manager";
import {
  listCommunes,
  listLookups,
  listWilayas,
} from "@/features/lookups/config";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function ReferentielsPage() {
  const [lookups, wilayas, communes, { t }] = await Promise.all([
    listLookups(),
    listWilayas(),
    listCommunes(),
    getServerI18n(),
  ]);

  return (
    <LookupsManager
      lookups={lookups}
      wilayas={wilayas}
      communes={communes}
      description={t("lookups.subtitle")}
    />
  );
}
