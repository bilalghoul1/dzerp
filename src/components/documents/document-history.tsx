"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { getConversionHistory, getRelations } from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { RelationItem } from "@/features/documents/framework/ui-types";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { formatDateTime } from "@/lib/utils";

interface HistoryEvent {
  id: string;
  kind: "created" | "converted";
  docTypeKey?: string;
  at: string;
}

export function DocumentHistory() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const dateLocale = locale === "ar" ? "ar-DZ" : locale;
  const [items, setItems] = React.useState<RelationItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!editor.docId) return;
    Promise.all([
      getConversionHistory(editor.type, editor.docId),
      getRelations(editor.type, editor.docId),
    ])
      .then(([historyItems, relationItems]) => {
        if (cancelled) return;
        const merged = new Map<string, RelationItem>();
        for (const item of historyItems) {
          merged.set(item.id, item);
        }
        for (const item of relationItems) {
          if (!merged.has(item.id)) merged.set(item.id, item);
        }
        setItems([...merged.values()]);
      })
      .catch(() => setItems([]));
    return () => {
      cancelled = true;
    };
  }, [editor.docId, editor.type, editor.detail?.status]);

  const events: HistoryEvent[] = React.useMemo(() => {
    const list: HistoryEvent[] = [];
    if (editor.detail?.issuedAt) {
      list.push({
        id: "created",
        kind: "created",
        at: editor.detail.issuedAt,
      });
    }
    for (const item of items) {
      if (item.relationType === "CONVERSION") {
        list.push({
          id: item.id,
          kind: "converted",
          docTypeKey: item.targetDocType,
          at: item.createdAt,
        });
      }
    }
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [items, editor.detail]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            timeline
          </span>
          {t("documentsUI.historySection")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("documentsUI.noHistory")}</p>
        ) : (
          <ol className="relative ms-3 space-y-4 border-s border-border ps-4">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span
                  className="material-symbols-outlined absolute -start-[28px] top-0 bg-background text-[18px] text-muted-foreground"
                  aria-hidden="true"
                >
                  {event.kind === "created" ? "add_circle" : "swap_horiz"}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    {event.kind === "created" ? (
                      t("documentsUI.createdBy")
                    ) : event.docTypeKey ? (
                      <>
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ color: getUiConfig(event.docTypeKey as CommercialDocType).accent }}
                          aria-hidden="true"
                        >
                          {getUiConfig(event.docTypeKey as CommercialDocType).icon}
                        </span>
                        {t(`docTypes.${event.docTypeKey}`)}
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(event.at, dateLocale)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
