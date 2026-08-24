import { notFound } from "next/navigation";
import { requirePermission } from "@/features/auth/rbac";
import { getAdminActor } from "@/features/company-admin/api";
import {
  getCompanyDetail,
  getStatistics,
  listCompanyActivity,
  listCompanyAudit,
  listCompanyBranches,
  listCompanySeries,
  listMembers,
} from "@/features/company-admin/service";
import { isApiError } from "@/lib/http";
import { CompanyDetail } from "@/components/admin/company-detail";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePermission("admin.company.view");
  const { companyId } = await params;
  // Acteur d'administration : SUPER_ADMIN global (sans société) ou admin de
  // société (scoped). Porte les permissions correctes (globales pour le SA).
  const actor = await getAdminActor();
  if (!actor) notFound();

  let detail;
  try {
    detail = await getCompanyDetail(actor, companyId);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
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

  return (
    <CompanyDetail
      company={detail}
      members={members}
      branches={branches}
      series={series}
      statistics={statistics}
      audit={audit}
      activity={activity}
      canUpdate={actor.permissions.includes("admin.company.update")}
      canArchive={actor.permissions.includes("admin.company.archive")}
      canDelete={actor.permissions.includes("admin.company.delete")}
      canManageUsers={actor.isSuperAdmin}
      isSuperAdmin={actor.isSuperAdmin}
    />
  );
}
