"use client";

import { DocumentEditorProvider } from "@/components/documents/document-editor-context";
import type { EditorLookups } from "@/components/documents/document-editor-context";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { DocumentDetailModel } from "@/features/documents/framework/ui-types";
import type { PrintFormat } from "@/features/print/types";
import { DocumentWorkflowBar } from "@/components/documents/document-workflow-bar";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentTabs } from "@/components/documents/document-tabs";
import { DocumentWorkspace } from "@/components/documents/document-workspace";

export function DocumentEditorShell({
  type,
  docId,
  initialDetail,
  lookups,
  initialCustomerId,
  nextNumber,
  defaultPrintFormat,
}: {
  type: CommercialDocType;
  docId?: string | null;
  initialDetail?: DocumentDetailModel | null;
  lookups: EditorLookups;
  /** Client pré-sélectionné (`?customerId=`) — ignoré en mode édition. */
  initialCustomerId?: string | null;
  /** Prochain numéro indicatif (création) — jamais réservé. */
  nextNumber?: string | null;
  /** Format d'impression par défaut de la société (réglage utilisateur local possible). */
  defaultPrintFormat?: PrintFormat;
}) {
  return (
    <DocumentEditorProvider
      type={type}
      docId={docId}
      initialDetail={initialDetail}
      lookups={lookups}
      initialCustomerId={initialCustomerId}
    >
      <div className="space-y-4 print:hidden">
        <DocumentWorkflowBar defaultPrintFormat={defaultPrintFormat} />
        <DocumentWorkspace>
          <DocumentHeader nextNumber={nextNumber} />
          <DocumentTabs />
        </DocumentWorkspace>
      </div>
    </DocumentEditorProvider>
  );
}
