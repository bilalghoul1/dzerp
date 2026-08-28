"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/spinner";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { DocumentConvertDialog } from "@/components/documents/document-convert-dialog";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { getTransitions } from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { StatusTransition } from "@/features/documents/engine/types";
import type { DocumentStatus } from "@/generated/prisma/enums";

function transitionButtonClass(to: DocumentStatus): string {
  switch (to) {
    case "APPROVED":
      return "bg-emerald-600 text-white hover:bg-emerald-700";
    case "REJECTED":
      return "bg-destructive text-white hover:bg-destructive/90";
    case "CANCELLED":
      return "bg-destructive/10 text-destructive hover:bg-destructive/20";
    case "CONFIRMED":
      return "bg-amber-600 text-white hover:bg-amber-700";
    default:
      return "";
  }
}

export function DocumentWorkflowBar() {
  const { t } = useI18n();
  const editor = useDocumentEditor();
  const router = useRouter();
  const ui = getUiConfig(editor.type);

  const [transitions, setTransitions] = React.useState<StatusTransition[]>([]);
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [initialTarget, setInitialTarget] = React.useState<CommercialDocType | null>(null);
  const [convertSession, setConvertSession] = React.useState(0);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const loadTransitions = React.useCallback(async () => {
    if (!editor.docId) return;
    try {
      const result = await getTransitions(editor.type, editor.docId);
      setTransitions(result.transitions);
    } catch {
      setTransitions([]);
    }
  }, [editor.docId, editor.type]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des transitions distantes
    void loadTransitions();
  }, [loadTransitions, editor.detail?.status]);

  const canEdit =
    !editor.detail || editor.detail.status === "DRAFT";
  const canSave =
    (editor.permissions.create || editor.permissions.update) &&
    canEdit &&
    editor.dirty &&
    !editor.busy;

  const canDeliver =
    editor.type === "SALES_ORDER" &&
    (editor.detail?.lines.some((line) => (line.remainingQty ?? 0) > 0) ?? false);

  const openConvert = () => {
    setInitialTarget(null);
    setConvertSession((s) => s + 1);
    setConvertOpen(true);
  };

  const openDelivery = () => {
    setInitialTarget("DELIVERY_NOTE");
    setConvertSession((s) => s + 1);
    setConvertOpen(true);
  };

  const handleTransition = async (transition: StatusTransition) => {
    const statusLabel = t(`status.${transition.to}`);
    const confirmed = window.confirm(
      t("documentsUI.confirmTransition", { status: statusLabel }),
    );
    if (!confirmed) return;
    await editor.applyStatus(transition.to);
  };

  const handleConverted = (target: string) => {
    setConvertOpen(false);
    if (target) {
      void router.push(`/documents/${target.toLowerCase()}`);
      toast.success(t("documentsUI.convertedSuccess"));
    } else {
      void router.refresh();
      void editor.refresh();
    }
  };

  const handleDuplicate = async () => {
    if (!editor.docId) return;
    const saved = await editor.save();
    if (!saved) return;
    const payload = {
      branchId: saved.branchId,
      ...(ui.category === "purchasing"
        ? { supplierId: saved.partyId ?? "" }
        : { customerId: saved.partyId ?? "" }),
      clientId: saved.clientId ?? null,
      currency: saved.currency || "DZD",
      exchangeRate: saved.exchangeRate || 1,
      notes: saved.notes ?? null,
      lines: editor.lines.map((line) => ({
        kind: line.kind,
        productId: line.productId ?? undefined,
        label: line.label,
        unit: line.unit ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPct: line.discountPct,
        taxPct: line.taxPct,
      })),
    };
    const created = await import("@/features/documents/framework/api").then((m) =>
      m.createDocument(editor.type, payload),
    );
    if (created) {
      router.push(`/documents/${editor.type.toLowerCase()}/${created.id}`);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("documentsUI.transitionsTitle")} :
        </span>
        {transitions.length === 0 && (
          <span className="text-sm text-muted-foreground">
            {t("documentsUI.noTransitions")}
          </span>
        )}
        {transitions.map((transition) => {
          const requiresApproval =
            transition.to === "APPROVED" || transition.to === "REJECTED";
          if (requiresApproval && !editor.permissions.approve) return null;
          const className = transitionButtonClass(transition.to);
          return (
            <Button
              key={`${transition.from}-${transition.to}`}
              type="button"
              size="sm"
              variant={className ? "default" : "outline"}
              className={className || undefined}
              onClick={() => handleTransition(transition)}
              disabled={editor.busy}
            >
              {t(`status.${transition.to}`)}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editor.permissions.convert && editor.docId && (
          <>
            {canDeliver && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openDelivery}
                disabled={editor.busy}
              >
                <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                  local_shipping
                </span>
                {t("documentsUI.deliverAction")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openConvert}
              disabled={editor.busy}
            >
              <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                swap_horiz
              </span>
              {t("documentsUI.convert")}
            </Button>
            <DocumentConvertDialog
              key={convertSession}
              open={convertOpen}
              onOpenChange={setConvertOpen}
              sourceType={editor.type}
              sourceId={editor.docId}
              initialTarget={initialTarget}
              onConverted={handleConverted}
            />
          </>
        )}

        {editor.permissions.print && editor.docId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={editor.busy}
          >
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              picture_as_pdf
            </span>
            {t("documentsUI.actionPreview")}
          </Button>
        )}

        {editor.permissions.create && editor.docId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={editor.busy || !canEdit}
          >
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              content_copy
            </span>
            {t("documentsUI.duplicate")}
          </Button>
        )}

        {(editor.permissions.create || editor.permissions.update) && canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={() => void editor.save()}
            disabled={!canSave}
          >
            {editor.busy ? (
              <Spinner className="me-1 h-4 w-4" />
            ) : (
              <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                save
              </span>
            )}
            {t("documentsUI.save")}
          </Button>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          {t("documentsUI.onlyDraftEditable")}
        </p>
      )}

      {editor.permissions.print && editor.docId && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          docId={editor.docId}
          docType={editor.type}
          title={
            editor.detail?.number
              ? t("documentsUI.preview")
              : t("documentsUI.preview")
          }
        />
      )}
    </div>
  );
}
