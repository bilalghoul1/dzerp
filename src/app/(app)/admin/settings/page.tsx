import { getAdminActor } from "@/features/company-admin/api";
import { listSettings } from "@/features/settings/server";
import { getServerI18n } from "@/features/i18n/server";
import { PlatformSettingsTable } from "@/components/admin/platform-settings-table";
import type { PlatformSettingRow } from "@/features/company-admin/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const [settings, { t }] = await Promise.all([
    listSettings({ includeSecrets: true }),
    getServerI18n(),
  ]);

  const rows: PlatformSettingRow[] = settings.map((s) => ({
    key: s.key,
    value: s.value,
    type: s.type,
    description: s.description,
    isPublic: s.isPublic,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("admin.settingsTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.settingsSubtitle")}
        </p>
      </div>
      <PlatformSettingsTable settings={rows} />
    </div>
  );
}
