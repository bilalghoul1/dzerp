import { requirePermission } from "@/features/auth/rbac";
import { getServerI18n } from "@/features/i18n/server";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { getDocConfig } from "@/features/documents/engine/config";
import { getDocument } from "@/features/documents/engine/service";
import { normalizeDocumentDetail } from "@/features/documents/framework/normalize";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import { getTaxRates, getCurrencies, getUnits } from "@/features/settings/config";
import { listCustomers } from "@/features/customers/config";
import { listSuppliers } from "@/features/suppliers/config";
import { PageHeader } from "@/components/page/page-header";
import { DocumentEditorShell } from "@/components/documents/document-editor-shell";
import type { EditorLookups } from "@/components/documents/document-editor-context";
import type { CommercialDocType } from "@/features/documents/engine/types";

export const dynamic = "force-dynamic";

export async function DocumentEditorPage({
  type,
  docId,
  initialCustomerId,
}: {
  type: CommercialDocType;
  docId?: string | null;
  /** Client à pré-remplir depuis `?customerId=` (CRM, conversion). */
  initialCustomerId?: string | null;
}) {
  await requirePermission(docId ? "documents.read" : "documents.create");
  const config = getDocConfig(type);
  const ui = getUiConfig(type);

  const [{ t }, context] = await Promise.all([
    getServerI18n(),
    getOrResolveCompanyContext(),
  ]);

  const companyId = context?.company.id ?? "";

  const parties =
    config.partyField === "customerId"
      ? await listCustomers()
      : await listSuppliers();

  // Le client cible (`?customerId=`) n'est pré-rempli que s'il existe réellement
  // dans la société active — jamais un id arbitraire provenant de l'URL.
  const customerId =
    config.partyField === "customerId" &&
    !docId &&
    initialCustomerId &&
    parties.some((party) => party.id === initialCustomerId)
      ? initialCustomerId
      : null;

  const [taxRates, currencies, units] = await Promise.all([
    getTaxRates(),
    getCurrencies(),
    getUnits(),
  ]);

  const detail =
    docId && companyId
      ? await getDocument(type, docId, companyId).catch(() => null)
      : null;
  const normalizedDetail = detail
    ? normalizeDocumentDetail(detail, type)
    : null;

  const lookups: EditorLookups = {
    parties: parties.map((party) => ({ id: party.id, name: party.name })),
    currencies: currencies.map((currency) => ({
      code: currency.code,
      name: currency.name,
      rate: currency.rate,
      isDefault: currency.isDefault,
    })),
    units: units.map((unit) => ({ key: unit.key, label: unit.label })),
    taxRates: taxRates.map((rate) => ({
      key: rate.key,
      label: rate.label,
      rate: rate.rate,
      isDefault: rate.isDefault,
      exempt: rate.exempt,
    })),
  };

  const sectionKey =
    ui.category === "purchasing" ? "documentsUI.achatsTitle" : "documentsUI.ventesTitle";

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t(sectionKey) },
          { label: t(`docTypes.${type}`) },
          {
            label:
              normalizedDetail?.number ??
              t("documentsUI.createTitle", {
                label: t(`docTypes.${type}`),
              }),
          },
        ]}
        title={
          normalizedDetail?.number ??
          t(
            docId
              ? "documentsUI.editTitle"
              : "documentsUI.createTitle",
            { label: t(`docTypes.${type}`) },
          )
        }
        description={t("documentsUI.listSubtitle")}
      />
      <DocumentEditorShell
        type={type}
        docId={docId}
        initialDetail={normalizedDetail}
        lookups={lookups}
        initialCustomerId={customerId}
      />
    </div>
  );
}
