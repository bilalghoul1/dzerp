import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";
import { DepartmentsManager } from "@/components/rh/departments-manager";
import { listDepartments, listRhOrgOptions } from "@/features/rh/config";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.department.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const [rows, options] = await Promise.all([listDepartments(), listRhOrgOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("rh.title"), href: "/rh" },
          { label: t("rh.departments") },
        ]}
        title={t("rh.departments")}
        description={t("rh.subtitle")}
      />
      <DepartmentsManager
        title={t("rh.departments")}
        description={t("rh.subtitle")}
        rows={rows}
        options={{ branches: options.branches }}
      />
    </div>
  );
}
