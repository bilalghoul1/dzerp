import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";
import { EmployeesManager } from "@/components/rh/employees-manager";
import { listEmployees, type EmployeeRow } from "@/features/rh/employees";
import { listRhOrgOptions, type RhOrgOptions } from "@/features/rh/config";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.employee.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const [rows, options] = await Promise.all([
    listEmployees() as Promise<EmployeeRow[]>,
    listRhOrgOptions() as Promise<RhOrgOptions>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("rh.title"), href: "/rh" },
          { label: t("rh.employees") },
        ]}
        title={t("rh.employees")}
        description={t("rh.subtitle")}
      />
      <EmployeesManager
        title={t("rh.employees")}
        description={t("rh.subtitle")}
        rows={rows}
        options={options}
      />
    </div>
  );
}
