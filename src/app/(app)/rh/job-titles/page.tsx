import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";
import { JobTitlesManager } from "@/components/rh/job-titles-manager";
import { listJobTitles } from "@/features/rh/config";

export const dynamic = "force-dynamic";

export default async function JobTitlesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.jobtitle.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const rows = await listJobTitles();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("rh.title"), href: "/rh" },
          { label: t("rh.jobTitles") },
        ]}
        title={t("rh.jobTitles")}
        description={t("rh.subtitle")}
      />
      <JobTitlesManager
        title={t("rh.jobTitles")}
        description={t("rh.subtitle")}
        rows={rows}
      />
    </div>
  );
}
