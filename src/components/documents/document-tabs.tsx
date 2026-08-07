"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { DocumentLineEditor } from "@/components/documents/document-line-editor";
import { DocumentAttachments } from "@/components/documents/document-attachments";
import { DocumentHistory } from "@/components/documents/document-history";
import { DocumentComments } from "@/components/documents/document-comments";

function NotesTab() {
  const { t } = useI18n();
  const editor = useDocumentEditor();
  const isEditable = !editor.detail || editor.detail.status === "DRAFT";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            notes
          </span>
          {t("documentsUI.notesSection")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="doc-notes-full">{t("documentsUI.fieldNotes")}</Label>
          <Textarea
            id="doc-notes-full"
            rows={10}
            value={editor.header.notes}
            onChange={(e) => editor.setHeaderField("notes", e.target.value)}
            placeholder={t("documentsUI.notesPlaceholder")}
            disabled={!isEditable || editor.busy}
            className="min-h-[220px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function DocumentTabs() {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="lines" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="lines">
          <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
            edit_note
          </span>
          {t("documentsUI.linesSection")}
        </TabsTrigger>
        <TabsTrigger value="notes">
          <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
            notes
          </span>
          {t("documentsUI.notesSection")}
        </TabsTrigger>
        <TabsTrigger value="attachments">
          <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
            attach_file
          </span>
          {t("documentsUI.attachmentsSection")}
        </TabsTrigger>
        <TabsTrigger value="history">
          <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
            history
          </span>
          {t("documentsUI.historySection")}
        </TabsTrigger>
        <TabsTrigger value="comments">
          <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
            comment
          </span>
          {t("documentsUI.commentsSection")}
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">
        <TabsContent value="lines">
          <DocumentLineEditor />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab />
        </TabsContent>
        <TabsContent value="attachments">
          <DocumentAttachments />
        </TabsContent>
        <TabsContent value="history">
          <DocumentHistory />
        </TabsContent>
        <TabsContent value="comments">
          <DocumentComments />
        </TabsContent>
      </div>
    </Tabs>
  );
}
