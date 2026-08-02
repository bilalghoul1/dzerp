import { requirePermission } from "@/features/auth/rbac";
import { PageHeader } from "@/components/page/page-header";
import { ParametresTabs } from "@/components/settings/parametres-tabs";
import { getServerI18n } from "@/features/i18n/server";

export default async function ParametresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission("parametres.view");
  const { t } = await getServerI18n();

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t("parametres.title") }]}
        title={t("parametres.title")}
        description={t("parametres.subtitle")}
      />
      <ParametresTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
