import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServerI18n } from "@/features/i18n/server";
import { getUiConfig, docTypeSlug } from "@/features/documents/framework/ui-config";
import { getAllDocTypes, getDocConfig } from "@/features/documents/engine/config";
import { listDocuments } from "@/features/documents/engine/service";
import { normalizeDocumentRow } from "@/features/documents/framework/normalize";
import { DocumentsHubList, type HubDocType } from "@/components/documents/documents-hub-list";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DocumentsHubPage() {
  await requirePermission("documents.read");
  const [{ t }, ctx, session] = await Promise.all([
    getServerI18n(),
    getOrResolveCompanyContext(),
    getCurrentUser(),
  ]);
  if (!ctx) redirect("/admin/companies");

  const companyId = ctx.company.id;
  const permissions = session?.permissions ?? [];
  const has = (p: string) => permissions.includes(p as never);

  // Types visibles + créables pour l'utilisateur (registre autoritatif).
  const visibleTypes: HubDocType[] = [];
  const creatableTypes: HubDocType[] = [];
  for (const type of getAllDocTypes()) {
    const ui = getUiConfig(type);
    const prefix = getDocConfig(type).permissionPrefix;
    const entry: HubDocType = {
      type,
      slug: docTypeSlug(type),
      label: t(`docTypes.${type}`),
      icon: ui.icon,
    };
    if (has(`${prefix}.view`)) visibleTypes.push(entry);
    if (has(`${prefix}.create`)) creatableTypes.push(entry);
  }

  // Liste agrégée de tous les documents visibles (réutilise le moteur existant).
  const aggregated = (
    await Promise.all(
      visibleTypes.map(async (e) => {
        const res = await listDocuments(e.type, companyId, { page: 1, pageSize: 12 });
        return res.items.map((raw) =>
          normalizeDocumentRow(raw as Record<string, unknown>, e.type),
        );
      }),
    )
  )
    .flat()
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .slice(0, 60);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("nav.documents") }]}
        title={t("nav.documents")}
        description={t("documentsUI.listSubtitle")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/documents/groups">
              <span className="material-symbols-outlined mr-1 text-[18px]" aria-hidden="true">
                group
              </span>
              {t("documentsUI.viewGroups")}
            </Link>
          </Button>
        }
      />

      {creatableTypes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("documentsUI.hubCreate")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("documentsUI.hubCreateHint")}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {creatableTypes.map((e) => (
              <Button key={e.type} variant="default" asChild>
                <a href={`/documents/${e.slug}/nouveau`}>
                  <span className="material-symbols-outlined mr-1 text-[18px]" aria-hidden="true">
                    {e.icon}
                  </span>
                  {e.label}
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("documentsUI.allDocuments")}</CardTitle>
          <CardDescription>{t("documentsUI.allDocumentsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("documentsUI.hubNoAccess")}</p>
          ) : (
            <DocumentsHubList rows={aggregated} types={visibleTypes} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
