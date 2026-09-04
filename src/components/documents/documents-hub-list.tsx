"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/feedback/spinner";
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
import { listDocumentsHub } from "@/features/documents/framework/api";
import type {
  HubParams,
  HubResult,
} from "@/features/documents/framework/ui-types";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

export type HubDocType = {
  type: CommercialDocType;
  slug: string;
  label: string;
  icon: string;
};

const PAGE_SIZES = [10, 20, 50];

export function DocumentsHubList({
  types,
  initial,
  initialParams = {},
}: {
  types: HubDocType[];
  initial: HubResult;
  initialParams?: HubParams;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState(initialParams.search ?? "");
  const [appliedSearch, setAppliedSearch] = React.useState(
    initialParams.search ?? "",
  );
  const [statusFilter, setStatusFilter] = React.useState(
    initialParams.status ?? "all",
  );
  const [typeFilter, setTypeFilter] = React.useState<CommercialDocType | "all">(
    initialParams.type ?? "all",
  );
  const [pageSize, setPageSize] = React.useState(20);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<HubResult>(initial);
  const [loading, setLoading] = React.useState(false);

  const typeByKey = React.useMemo(() => {
    const map = new Map<CommercialDocType, HubDocType>();
    types.forEach((ty) => map.set(ty.type, ty));
    return map;
  }, [types]);

  const isFiltered =
    appliedSearch !== "" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    page > 1;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDocumentsHub({
        page,
        pageSize,
        search: appliedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setData(result);
    } catch {
      // Keep the last good data on failure; no crash.
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, statusFilter, typeFilter]);

  const initialHydrated = React.useRef(false);

  React.useEffect(() => {
    if (!initialHydrated.current) {
      initialHydrated.current = true;
      return;
    }
    void load();
  }, [load]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(query);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const reset = () => {
    setQuery("");
    setAppliedSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  };

  const localeFmt = locale === "ar" ? "ar-DZ" : locale;

  const summary = data.summary;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const statusCounts = STATUS_ORDER.filter((s) => (summary.byStatus[s] ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t("documentsUI.hubTotalDocs")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t("documentsUI.hubTotalTtc")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(summary.totalTtc, localeFmt)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:col-span-2">
          <p className="text-xs text-muted-foreground">{t("documentsUI.hubByStatus")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statusCounts.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              statusCounts.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  <span className="text-xs">{t(`documentStatus.${s}`)}</span>
                  <span className="tabular-nums">{summary.byStatus[s]}</span>
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("documentsUI.searchPlaceholder")}
          className="h-9 w-full sm:w-72"
        />
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as CommercialDocType | "all"); setPage(1); }}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
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
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-full sm:w-[160px]">
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
        {isFiltered && (
          <Button variant="ghost" className="h-9" onClick={reset}>
            {t("common.reset")}
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        {loading && data.items.length === 0 ? (
          <Spinner className="py-16" />
        ) : data.items.length === 0 ? (
          <EmptyState
            illustration={<DocumentsIllustration className="size-24" />}
            icon="folder_open"
            title={t("documentsUI.crmNoDocuments")}
            description={t("documentsUI.crmSearchDocs")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("documentsUI.colType")}</TableHead>
                <TableHead>{t("documentsUI.colNumber")}</TableHead>
                <TableHead>{t("documentsUI.colParty")}</TableHead>
                <TableHead>{t("documentsUI.colDate")}</TableHead>
                <TableHead className="text-end">{t("documentsUI.colTotal")}</TableHead>
                <TableHead>{t("documentsUI.colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => {
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
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {data.total} {t("documentsUI.results")}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20" aria-label={t("documentsUI.rowCount")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            <span className="material-symbols-outlined text-[16px] rtl:-scale-x-100" aria-hidden="true">
              chevron_left
            </span>
            <span className="sr-only">{t("documentsUI.prev")}</span>
          </Button>
          <Badge variant="secondary" className={cn(loading && "opacity-60")}>
            {page} {t("documentsUI.of")} {totalPages}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            <span className="material-symbols-outlined text-[16px] rtl:-scale-x-100" aria-hidden="true">
              chevron_right
            </span>
            <span className="sr-only">{t("documentsUI.next")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
