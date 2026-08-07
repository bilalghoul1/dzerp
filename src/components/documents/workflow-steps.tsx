import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import {
  getUiConfig,
} from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";

/**
 * Guided "where am I / what is next?" stepper for the commercial workflow.
 * Reuses getUiConfig (icon/label) — no new business logic. The current step is
 * derived from the editor's doc type + status. Pure UX.
 */
const SALES_FLOW: CommercialDocType[] = [
  "QUOTATION",
  "SALES_ORDER",
  "DELIVERY_NOTE",
  "INVOICE",
];
const PURCHASING_FLOW: CommercialDocType[] = [
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "SUPPLIER_INVOICE",
];

export function WorkflowSteps() {
  const { t } = useI18n();
  const editor = useDocumentEditor();
  const category = getUiConfig(editor.type).category;

  const flow =
    category === "purchasing" ? PURCHASING_FLOW : SALES_FLOW;
  const currentIndex = editor.docId
    ? flow.indexOf(editor.type)
    : -1;

  // Customer step is the implied origin for sales documents.
  const showCustomerStep = category === "sales";

  return (
    <nav
      aria-label={t("documentsUI.workflowSteps")}
      className="flex flex-wrap items-center gap-1 text-xs"
    >
      {showCustomerStep ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            group
          </span>
          {t("nav.customers")}
        </span>
      ) : null}

      {flow.map((type, index) => {
        const cfg = getUiConfig(type);
        const isCurrent = index === currentIndex;
        const isDone = currentIndex > -1 && index < currentIndex;
        return (
          <React.Fragment key={type}>
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                isCurrent
                  ? "bg-primary/15 font-semibold text-primary"
                  : isDone
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
              ].join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                {cfg.icon}
              </span>
              {t(`docTypes.${type}`)}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** Category helpers reused by callers that render a standalone stepper. */
export function salesFlowSteps(): CommercialDocType[] {
  return SALES_FLOW;
}

export function purchasingFlowSteps(): CommercialDocType[] {
  return PURCHASING_FLOW;
}
