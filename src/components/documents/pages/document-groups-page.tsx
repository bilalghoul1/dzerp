import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/rbac";
import { getServerI18n } from "@/features/i18n/server";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listDocumentsOverview } from "@/features/documents/engine/service";
import { PageHeader } from "@/components/page/page-header";
import { DocumentGroups } from "@/components/documents/document-groups";

export const dynamic = "force-dynamic";

export async function DocumentGroupsPage() {
  await requirePermission("documents.read");
  const [{ t }, context] = await Promise.all([
    getServerI18n(),
    getOrResolveCompanyContext(),
  ]);
  if (!context) redirect("/admin/companies");

  const rows = await listDocumentsOverview(context.company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("nav.documents"), href: "/documents" },
          { label: t("documentsUI.groupsTitle") },
        ]}
        title={t("documentsUI.groupsTitle")}
        description={t("documentsUI.groupsSubtitle")}
      />
      <DocumentGroups initialRows={rows} />
    </div>
  );
}