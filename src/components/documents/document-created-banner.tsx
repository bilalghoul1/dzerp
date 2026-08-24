"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useCompany } from "@/features/company/company-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { WorkflowSteps } from "@/components/documents/workflow-steps";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { DocumentConvertDialog } from "@/components/documents/document-convert-dialog";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import type { CommercialDocType } from "@/features/documents/engine/types";

/**
 * Large success panel shown right after a document is created.
 * Answers: "What have I just done?" (number/status/customer) and
 * "What is the next logical action?" (primary actions).
 * Reuses the existing preview + convert dialogs — no new business logic.
 */
export function DocumentCreatedBanner({ type }: { type: CommercialDocType }) {
  const { t } = useI18n();
  const router = useRouter();
  const editor = useDocumentEditor();
  const detail = editor.detail;

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [convertOpen, setConvertOpen] = React.useState(false);
  const company = useCompany();

  if (!detail) return null;

  const customerName = detail.partyName ?? "—";
  const listPath = `/documents/${type.toLowerCase()}`;

  // Guided "next step" in the commercial flow (sales). Stops at INVOICE
  // (no client-side payment/collection module yet).
  const NEXT_STEP: Partial<Record<CommercialDocType, CommercialDocType>> = {
    QUOTATION: "SALES_ORDER",
    SALES_ORDER: "DELIVERY_NOTE",
    DELIVERY_NOTE: "INVOICE",
  };
  const nextStepType = NEXT_STEP[type];

  // Le passage à l'étape suivante requiert le droit de création du document
  // cible ; le client est pré-rempli via `?customerId=` quand il est connu.
  const NEXT_STEP_PERMISSION: Partial<Record<CommercialDocType, string>> = {
    SALES_ORDER: "ventes.commande.create",
    DELIVERY_NOTE: "ventes.livraison.create",
    INVOICE: "ventes.facture.create",
  };
  const canNextStep =
    nextStepType !== undefined &&
    (NEXT_STEP_PERMISSION[nextStepType]
      ? company.permissions.includes(
          NEXT_STEP_PERMISSION[nextStepType] as never,
        )
      : true);
  const nextStepHref =
    nextStepType &&
    `/documents/${nextStepType.toLowerCase()}/nouveau${
      detail.partyId ? `?customerId=${detail.partyId}` : ""
    }`;

  const handleSend = () => {
    const subject = encodeURIComponent(`${t("documentsUI.createdNumber")} : ${detail.number}`);
    const body = encodeURIComponent(
      `${detail.number} — ${t(`docTypes.${type}`)}\n${t("documentsUI.createdStatus")} : ${t(`status.${detail.status}`)}\n`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast.success(t("documentsUI.sentToast", { customer: customerName }));
  };

  const handleConverted = (target?: string) => {
    setConvertOpen(false);
    if (target) {
      router.push(`/documents/${target.toLowerCase()}`);
    } else {
      void router.refresh();
      void editor.refresh();
    }
  };

  return (
    <Card className="border-emerald-600/40 bg-emerald-50/60 dark:bg-emerald-950/20">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-emerald-600" aria-hidden="true">
              check_circle
            </span>
            <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              {t("documentsUI.createdTitle")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("documentsUI.createdDescription")}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("documentsUI.createdNumber")}</dt>
              <dd className="font-medium tabular-nums">{detail.number}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("documentsUI.createdStatus")}</dt>
              <dd>
                <DocumentStatusBadge status={detail.status} showDot={false} withHint />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("documentsUI.createdCustomer")}</dt>
              <dd className="font-medium">{customerName}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{t("documentsUI.createdBranch")}</dt>
              <dd className="font-medium">{detail.branchName ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              picture_as_pdf
            </span>
            {t("documentsUI.actionPreview")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              print
            </span>
            {t("documentsUI.actionPrint")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleSend}>
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              send
            </span>
            {t("documentsUI.actionSend")}
          </Button>
          {editor.permissions.convert && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConvertOpen(true)}>
              <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                swap_horiz
              </span>
              {t("documentsUI.actionConvert")}
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => router.push(listPath)}>
            {t("documentsUI.returnToList")}
          </Button>
        </div>
      </div>

      {/* Guided: where am I + what is the next step in the commercial flow. */}
      <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <WorkflowSteps />
        {canNextStep && nextStepHref ? (
          <Button asChild size="sm" className="shrink-0">
            <a href={nextStepHref}>
              <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                arrow_forward
              </span>
              {t("documentsUI.nextStep", { target: t(`docTypes.${nextStepType}`) })}
            </a>
          </Button>
        ) : null}
      </div>

      {editor.permissions.print && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          docId={detail.id}
          docType={type}
          title={t("documentsUI.preview")}
        />
      )}
      {editor.permissions.convert && editor.docId && (
        <DocumentConvertDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          sourceType={type}
          sourceId={editor.docId}
          onConverted={handleConverted}
        />
      )}
    </Card>
  );
}
