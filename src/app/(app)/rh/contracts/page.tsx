import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";
import { ContractsManager } from "@/components/rh/contracts-manager";
import { listContracts, type ContractRow } from "@/features/rh/contracts";
import { listRhOrgOptions, type RhOrgOptions } from "@/features/rh/config";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.contract.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();
  const { employeeId } = await searchParams;

  const [rows, options] = await Promise.all([
    listContracts(employeeId) as Promise<ContractRow[]>,
    listRhOrgOptions() as Promise<RhOrgOptions>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("rh.title"), href: "/rh" },
          { label: t("rh.contracts") },
        ]}
        title={t("rh.contracts")}
        description={t("rh.subtitle")}
      />
      <ContractsManager
        title={t("rh.contracts")}
        description={t("rh.subtitle")}
        rows={rows}
        options={options}
        employeeId={employeeId}
      />
    </div>
  );
}
