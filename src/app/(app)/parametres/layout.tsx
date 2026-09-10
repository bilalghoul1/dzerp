import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { PageHeader } from "@/components/page/page-header";
import { ParametresTabs } from "@/components/settings/parametres-tabs";
import {
  SettingsReadOnlyBanner,
  SettingsReadOnlyProvider,
} from "@/components/settings/settings-readonly-provider";
import { getServerI18n } from "@/features/i18n/server";

export default async function ParametresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission("parametres.view");
  const session = await getCurrentUser();
  const canManage =
    !!session && session.permissions.includes("parametres.manage");
  const { t } = await getServerI18n();

  return (
    <SettingsReadOnlyProvider readOnly={!canManage}>
      <div>
        <PageHeader
          breadcrumbs={[{ label: t("parametres.title") }]}
          title={t("parametres.title")}
          description={t("parametres.subtitle")}
        />
        <SettingsReadOnlyBanner />
        <ParametresTabs />
        <div className="mt-6">{children}</div>
      </div>
    </SettingsReadOnlyProvider>
  );
}
