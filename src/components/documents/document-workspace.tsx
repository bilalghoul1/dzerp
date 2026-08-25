"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentTotalsPanel } from "@/components/documents/document-totals-panel";
import { DocumentSidebar } from "@/components/documents/document-sidebar";
import { DocumentCreatedBanner } from "@/components/documents/document-created-banner";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { formatCurrency } from "@/lib/utils";

const STORAGE_KEY = "dzerp.docEditor.summaryCollapsed";

export function DocumentWorkspace({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();

  const [collapsed, setCollapsed] = React.useState<boolean>(true);

  // Read the persisted preference only on the client, after mount, so the
  // server-rendered markup matches the first client render (no hydration
  // mismatch). The value is applied asynchronously to avoid cascading renders.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (stored !== null) {
      queueMicrotask(() => setCollapsed(stored !== "false"));
    }
  }, []);

  // Persist preference whenever it changes.
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const currency = editor.header.currency || "DZD";
  const localeFmt = locale === "ar" ? "ar-DZ" : locale;
  const fmt = (value: number) => formatCurrency(value, localeFmt, currency);

  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "1";

  return (
    <div className="space-y-4">
      {justCreated ? <DocumentCreatedBanner type={editor.type} /> : null}

      <div
        className={
          collapsed
            ? "grid items-start gap-4 grid-cols-1"
            : "grid items-start gap-4 grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px]"
        }
      >
        {/* Primary editing column — always full width when summary is collapsed. */}
        <div className="min-w-0 space-y-4">{children}</div>

      {/* Right column: collapsible summary. */}
      <aside className="min-w-0 space-y-3" aria-label={t("documentsUI.summaryTitle")}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("documentsUI.summaryTitle")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setCollapsed((c) => !c)}
            aria-pressed={!collapsed}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {collapsed ? "chevron_left" : "chevron_right"}
            </span>
            {collapsed ? t("documentsUI.summaryShow") : t("documentsUI.summaryHide")}
          </Button>
        </div>

        {/* Expanded full panel (animated). */}
        <div
          className={
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out " +
            (collapsed ? "max-h-0 opacity-0" : "max-h-[2400px] opacity-100")
          }
        >
          <div className="space-y-4 pb-1">
            <DocumentTotalsPanel />
            <DocumentSidebar />
          </div>
        </div>

        {/* Collapsed compact sticky footer — full info one click away. */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title={t("documentsUI.summaryCollapsedHint")}
            aria-label={t("documentsUI.summaryCollapsedHint")}
            className="sticky bottom-4 flex w-full items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 text-sm shadow-lg backdrop-blur transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-4 tabular-nums">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">HT</span>
                <span className="font-medium">{fmt(editor.totals.totalHt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">TVA</span>
                <span className="font-medium">{fmt(editor.totals.totalTva)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground">TTC</span>
                <span className="font-semibold">{fmt(editor.totals.totalTtc)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DocumentStatusBadge status={editor.detail?.status ?? "DRAFT"} showDot />
              <span className="text-xs text-muted-foreground">
                {editor.lines.length} {t("documentsUI.lineCount")}
              </span>
              <span className="material-symbols-outlined text-[18px] text-muted-foreground" aria-hidden="true">
                unfold_more
              </span>
            </div>
          </button>
        )}
      </aside>
      </div>
    </div>
  );
}
