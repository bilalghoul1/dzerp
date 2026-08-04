"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { getRelations, getConversionHistory } from "@/features/documents/framework/api";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { RelationItem } from "@/features/documents/framework/ui-types";
import { formatDate } from "@/lib/utils";

function SideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px] text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export function DocumentSidebar() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const ui = getUiConfig(editor.type);
  const dateLocale = locale === "ar" ? "ar-DZ" : locale;

  const [relations, setRelations] = React.useState<RelationItem[]>([]);
  const [history, setHistory] = React.useState<RelationItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!editor.docId) return;
    Promise.all([
      getRelations(editor.type, editor.docId),
      getConversionHistory(editor.type, editor.docId),
    ])
      .then(([relationItems, historyItems]) => {
        if (cancelled) return;
        setRelations(relationItems);
        setHistory(historyItems);
      })
      .catch(() => {
        setRelations([]);
        setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editor.docId, editor.type, editor.detail?.status]);

  const linkedTargets = relations.filter(
    (relation) =>
      relation.targetDocId !== editor.docId && relation.relationType === "CONVERSION",
  );

  return (
    <div className="space-y-4">
      <SideCard title={t("documentsUI.sidebarTitle")} icon="info">
        <dl className="space-y-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("documentsUI.createdBy")}</dt>
            <dd className="truncate font-medium">
              {editor.detail?.createdByName || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t("documentsUI.updatedBy")}</dt>
            <dd className="truncate font-medium">
              {editor.detail?.updatedByName || "—"}
            </dd>
          </div>
          {editor.detail?.issuedAt && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t("documentsUI.fieldIssuedAt")}</dt>
              <dd className="tabular-nums">
                {formatDate(editor.detail.issuedAt, dateLocale)}
              </dd>
            </div>
          )}
        </dl>
      </SideCard>

      <SideCard title={t("documentsUI.statistics")} icon="monitoring">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("documentsUI.totalLines")}</span>
          <span className="font-semibold tabular-nums">{editor.lines.length}</span>
        </div>
      </SideCard>

      <SideCard title={t("documentsUI.linkedDocuments")} icon="link">
        {linkedTargets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("documentsUI.noLinkedDocuments")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {linkedTargets.map((relation) => (
              <li key={relation.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ color: getUiConfig(relation.targetDocType).accent }}
                      aria-hidden="true"
                    >
                      {getUiConfig(relation.targetDocType).icon}
                    </span>
                    {t(`docTypes.${relation.targetDocType}`)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(relation.createdAt, dateLocale)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("documentsUI.fieldNumber")}</span>
          <span className="text-xs font-medium">{editor.detail?.number || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t(`documentsUI.${ui.partyLabelKey}`)}
          </span>
          <span className="truncate text-xs font-medium">
            {editor.detail?.partyName || "—"}
          </span>
        </div>
      </SideCard>

      <SideCard title={t("documentsUI.conversionHistory")} icon="history">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("documentsUI.noHistory")}</p>
        ) : (
          <ol className="space-y-1.5">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    {getUiConfig(item.targetDocType).icon}
                  </span>
                  {t(`docTypes.${item.targetDocType}`)}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(item.createdAt, dateLocale)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SideCard>
    </div>
  );
}
