"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import {
  getConversionHistory,
  getRelations,
  getDocumentActivity,
} from "@/features/documents/framework/api";
import type { DocumentActivityEvent } from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { RelationItem } from "@/features/documents/framework/ui-types";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { formatDateTime } from "@/lib/utils";

interface HistoryEvent {
  id: string;
  kind: "created" | "converted" | "status";
  docTypeKey?: string;
  from?: string;
  to?: string;
  actorName?: string | null;
  at: string;
}

export function DocumentHistory() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const dateLocale = locale === "ar" ? "ar-DZ" : locale;
  const [items, setItems] = React.useState<RelationItem[]>([]);
  const [activity, setActivity] = React.useState<DocumentActivityEvent[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!editor.docId) return;
    Promise.all([
      getConversionHistory(editor.type, editor.docId),
      getRelations(editor.type, editor.docId),
      getDocumentActivity(editor.type, editor.docId),
    ])
      .then(([historyItems, relationItems, activityItems]) => {
        if (cancelled) return;
        const merged = new Map<string, RelationItem>();
        for (const item of historyItems) {
          merged.set(item.id, item);
        }
        for (const item of relationItems) {
          if (!merged.has(item.id)) merged.set(item.id, item);
        }
        setItems([...merged.values()]);
        setActivity(activityItems);
      })
      .catch(() => {
        setItems([]);
        setActivity([]);
      });
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
    for (const event of activity) {
      if (event.type !== "STATUS_CHANGE") continue;
      const from =
        typeof event.meta?.from === "string" ? event.meta.from : undefined;
      const to = typeof event.meta?.to === "string" ? event.meta.to : undefined;
      if (!from || !to) continue;
      list.push({
        id: event.id,
        kind: "status",
        from,
        to,
        actorName: event.actorName,
        at: event.createdAt,
      });
    }
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [items, activity, editor.detail]);

  const arrow = locale === "ar" ? "←" : "→";

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
            {events.map((event) => {
              const approved = event.kind === "status" && event.to === "APPROVED";
              const rejected = event.kind === "status" && event.to === "REJECTED";
              const icon = event.kind === "created" ? "add_circle" : event.kind === "status" ? (approved ? "check_circle" : rejected ? "cancel" : "flag") : "swap_horiz";
              const iconClass = approved
                ? "text-emerald-600"
                : rejected
                  ? "text-destructive"
                  : "text-muted-foreground";
              return (
                <li key={event.id} className="relative">
                  <span
                    className={`material-symbols-outlined absolute -start-[28px] top-0 bg-background text-[18px] ${iconClass}`}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      {event.kind === "created" ? (
                        t("documentsUI.createdBy")
                      ) : event.kind === "status" && event.from && event.to ? (
                        <>
                          <span className="text-muted-foreground">
                            {t(`status.${event.from}`)}
                          </span>
                          <span aria-hidden="true">{arrow}</span>
                          <span
                            className={
                              approved
                                ? "text-emerald-600"
                                : rejected
                                  ? "text-destructive"
                                  : undefined
                            }
                          >
                            {t(`status.${event.to}`)}
                          </span>
                        </>
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
                  {event.kind === "status" && event.actorName && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("documentsUI.by", { name: event.actorName })}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
