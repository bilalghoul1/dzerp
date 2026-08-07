"use client";

import { DocumentEditorProvider } from "@/components/documents/document-editor-context";
import type { EditorLookups } from "@/components/documents/document-editor-context";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { DocumentDetailModel } from "@/features/documents/framework/ui-types";
import { DocumentWorkflowBar } from "@/components/documents/document-workflow-bar";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentTabs } from "@/components/documents/document-tabs";
import { DocumentWorkspace } from "@/components/documents/document-workspace";

export function DocumentEditorShell({
  type,
  docId,
  initialDetail,
  lookups,
}: {
  type: CommercialDocType;
  docId?: string | null;
  initialDetail?: DocumentDetailModel | null;
  lookups: EditorLookups;
}) {
  return (
    <DocumentEditorProvider
      type={type}
      docId={docId}
      initialDetail={initialDetail}
      lookups={lookups}
    >
      <div className="space-y-4 print:hidden">
        <DocumentWorkflowBar />
        <DocumentWorkspace>
          <DocumentHeader />
          <DocumentTabs />
        </DocumentWorkspace>
      </div>
    </DocumentEditorProvider>
  );
}
