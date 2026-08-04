"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import {
  listAttachments,
  deleteAttachment,
  uploadAttachments,
  DocumentApiError,
} from "@/features/documents/framework/api";
import type { AttachmentItem } from "@/features/documents/framework/ui-types";
import { formatDate } from "@/lib/utils";

function attachmentUrl(storageKey: string): string {
  return `/api/files/${encodeURIComponent(storageKey)}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DocumentAttachments() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const dateLocale = locale === "ar" ? "ar-DZ" : locale;

  const [attachments, setAttachments] = React.useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canEdit = !editor.detail || editor.detail.status === "DRAFT";

  const load = React.useCallback(async () => {
    if (!editor.docId) return;
    try {
      setAttachments(await listAttachments(editor.type, editor.docId));
    } catch {
      setAttachments([]);
    }
  }, [editor.docId, editor.type]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des pièces jointes
    void load();
  }, [load]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!editor.docId || files.length === 0) return;
    setUploading(true);
    try {
      await uploadAttachments(Array.from(files), editor.type, editor.docId);
      toast.success(t("documentsUI.saved"));
      await load();
    } catch (error) {
      toast.error(
        error instanceof DocumentApiError && error.code === "FORBIDDEN"
          ? t("documentsUI.onlyDraftEditable")
          : error instanceof Error
            ? error.message
            : t("upload.uploadError"),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!editor.docId) return;
    if (!window.confirm(t("documentsUI.confirmDelete"))) return;
    try {
      await deleteAttachment(editor.type, editor.docId, attachmentId);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      toast.success(t("documentsUI.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("upload.uploadError"),
      );
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            attach_file
          </span>
          {t("documentsUI.attachmentsSection")}
        </CardTitle>
        {canEdit && editor.docId && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
              }}
              aria-label={t("documentsUI.attachmentDrop")}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
                upload
              </span>
              {uploading ? t("documentsUI.uploading") : t("upload.upload")}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed p-6 text-xs text-muted-foreground hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={!canEdit || !editor.docId}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              file_upload
            </span>
            {t("documentsUI.attachmentDrop")}
          </button>
        ) : (
          <ul className="divide-y divide-border">
            {attachments.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-muted-foreground" aria-hidden="true">
                    insert_drive_file
                  </span>
                  <div className="min-w-0">
                    <a
                      href={attachmentUrl(item.storageKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-medium hover:underline"
                    >
                      {item.originalName}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(item.size)} •{" "}
                      {formatDate(item.createdAt, dateLocale)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                    title={t("documentsUI.downloadFile")}
                  >
                    <a
                      href={attachmentUrl(item.storageKey)}
                      download={item.originalName}
                      aria-label={t("documentsUI.downloadFile")}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        download
                      </span>
                    </a>
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => void handleRemove(item.id)}
                      disabled={uploading}
                      title={t("documentsUI.removeFile")}
                      aria-label={t("documentsUI.removeFile")}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        delete
                      </span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
