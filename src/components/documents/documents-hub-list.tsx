"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { DocumentsIllustration } from "@/components/illustrations";
import { getUiConfig, docTypeSlug } from "@/features/documents/framework/ui-config";
import { STATUS_ORDER } from "@/features/documents/framework/status-meta";
import type { DocumentRow } from "@/features/documents/framework/ui-types";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { formatDate, formatCurrency } from "@/lib/utils";

export type HubDocType = {
  type: CommercialDocType;
  slug: string;
  label: string;
  icon: string;
};

export function DocumentsHubList({
  rows,
  types,
}: {
  rows: DocumentRow[];
  types: HubDocType[];
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const typeByKey = React.useMemo(() => {
    const map = new Map<CommercialDocType, HubDocType>();
    types.forEach((ty) => map.set(ty.type, ty));
    return map;
  }, [types]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.docType !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.number} ${r.partyName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, typeFilter, statusFilter]);

  const localeFmt = locale === "ar" ? "ar-DZ" : locale;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("documentsUI.searchPlaceholder")}
          className="h-9 w-full sm:w-64"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("documentsUI.allTypes")}</SelectItem>
            {types.map((ty) => (
              <SelectItem key={ty.type} value={ty.type}>
                {ty.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("documentsUI.allStatuses")}</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`documentStatus.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(query || typeFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
              setStatusFilter("all");
            }}
          >
            {t("common.reset")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<DocumentsIllustration className="size-24" />}
          icon="folder_open"
          title={t("documentsUI.crmNoDocuments")}
          description={t("documentsUI.crmSearchDocs")}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("documentsUI.colType")}</TableHead>
                <TableHead>{t("documentsUI.colNumber")}</TableHead>
                <TableHead>{t("documentsUI.colParty")}</TableHead>
                <TableHead>{t("documentsUI.colDate")}</TableHead>
                <TableHead className="text-end">
                  {t("documentsUI.colTotal")}
                </TableHead>
                <TableHead>{t("documentsUI.colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const ty = typeByKey.get(r.docType);
                const slug = ty?.slug ?? docTypeSlug(r.docType);
                const label = ty?.label ?? t(`docTypes.${r.docType}`);
                return (
                  <TableRow key={`${r.docType}-${r.id}`} className="hover:bg-accent/40">
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                            {ty?.icon ?? getUiConfig(r.docType).icon}
                          </span>
                        </span>
                        <span className="text-sm">{label}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/documents/${slug}/${r.id}`}
                        className="font-medium tabular-nums text-primary hover:underline"
                      >
                        {r.number}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.partyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.issuedAt, localeFmt)}
                    </TableCell>
                    <TableCell className="text-end text-sm tabular-nums">
                      {formatCurrency(r.totalTtc, localeFmt, r.currency)}
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={r.status as never} showDot={false} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("documentsUI.results")} : {filtered.length}
        {filtered.length !== rows.length ? ` / ${rows.length}` : ""}
      </p>
    </div>
  );
}
