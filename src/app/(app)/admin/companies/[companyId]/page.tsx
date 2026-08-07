import { notFound } from "next/navigation";
import { requirePermission } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import {
  getCompanyDetail,
  getStatistics,
  listCompanyActivity,
  listCompanyAudit,
  listCompanyBranches,
  listCompanySeries,
  listMembers,
} from "@/features/company-admin/service";
import { CompanyDetail } from "@/components/admin/company-detail";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePermission("admin.company.view");
  const { companyId } = await params;
  const context = await getOrResolveCompanyContext();
  const actor = {
    userId: context?.user.id ?? "",
    permissions: context?.permissions ?? [],
    activeCompanyId: context?.company.id ?? null,
  };
  if (!context) notFound();

  const detail = await getCompanyDetail(actor, companyId);
  if (!detail) notFound();

  const [members, branches, series, statistics, audit, activity] =
    await Promise.all([
      listMembers(actor, companyId),
      listCompanyBranches(actor, companyId),
      listCompanySeries(actor, companyId),
      getStatistics(actor, companyId),
      listCompanyAudit(actor, companyId),
      listCompanyActivity(actor, companyId),
    ]);

  const accessibleIds = new Set((context.companies ?? []).map((c) => c.id));

  return (
    <CompanyDetail
      company={detail}
      canUpdate={context.permissions.includes("admin.company.update")}
      isMember={accessibleIds.has(companyId)}
      members={members}
      branches={branches}
      series={series}
      statistics={statistics}
      audit={audit}
      activity={activity}
    />
  );
}
