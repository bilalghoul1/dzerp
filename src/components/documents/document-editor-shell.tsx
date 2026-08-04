"use client";

import { DocumentEditorProvider } from "@/components/documents/document-editor-context";
import type { EditorLookups } from "@/components/documents/document-editor-context";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type { DocumentDetailModel } from "@/features/documents/framework/ui-types";
import { DocumentWorkflowBar } from "@/components/documents/document-workflow-bar";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentTabs } from "@/components/documents/document-tabs";
import { DocumentTotalsPanel } from "@/components/documents/document-totals-panel";
import { DocumentSidebar } from "@/components/documents/document-sidebar";

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
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <DocumentHeader />
            <DocumentTabs />
          </div>
          <aside className="space-y-4">
            <DocumentTotalsPanel />
            <DocumentSidebar />
          </aside>
        </div>
      </div>
    </DocumentEditorProvider>
  );
}
