import { requirePermission } from "@/features/auth/rbac";
import { PageHeader } from "@/components/page/page-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { getServerI18n } from "@/features/i18n/server";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission("admin.company.view");
  const { t } = await getServerI18n();

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t("admin.title") }]}
        title={t("admin.title")}
        description={t("admin.subtitle")}
      />
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
