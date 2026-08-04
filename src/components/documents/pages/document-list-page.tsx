import { requirePermission } from "@/features/auth/rbac";
import { getServerI18n } from "@/features/i18n/server";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listDocuments } from "@/features/documents/engine/service";
import { normalizeDocumentRow } from "@/features/documents/framework/normalize";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import { PageHeader } from "@/components/page/page-header";
import { DocumentList } from "@/components/documents/document-list";
import { docTypeSlug } from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";

export const dynamic = "force-dynamic";

export async function DocumentListPage({
  type,
}: {
  type: CommercialDocType;
}) {
  await requirePermission("documents.read");
  const [{ t }, context, ui] = await Promise.all([
    getServerI18n(),
    getOrResolveCompanyContext(),
    Promise.resolve(getUiConfig(type)),
  ]);

  const companyId = context?.company.id ?? "";
  const initial =
    companyId && context
      ? await listDocuments(type, companyId, { page: 1, pageSize: 20 })
      : { items: [], total: 0, page: 1, pageSize: 20 };

  const items = initial.items.map((raw) =>
    normalizeDocumentRow(raw as Record<string, unknown>, type),
  );

  const sectionKey =
    ui.category === "purchasing" ? "documentsUI.achatsTitle" : "documentsUI.ventesTitle";

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t(sectionKey) },
          { label: t(`docTypes.${type}`) },
        ]}
        title={t(`docTypes.${type}`)}
        description={t("documentsUI.listSubtitle")}
      />
      <DocumentList
        type={type}
        initialItems={items}
        initialTotal={initial.total}
        initialPageSize={20}
        basePath={`/documents/${docTypeSlug(type)}`}
      />
    </div>
  );
}
