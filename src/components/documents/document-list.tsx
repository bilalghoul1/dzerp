"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useCompany } from "@/features/company/company-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/feedback/empty-state";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentConvertDialog } from "@/components/documents/document-convert-dialog";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import { STATUS_ORDER } from "@/features/documents/framework/status-meta";
import {
  listDocuments,
  getDocument,
  createDocument,
  deleteDocument,
  approveDocument,
  changeStatus,
  DocumentApiError,
} from "@/features/documents/framework/api";
import type {
  DocumentListColumnId,
  DocumentRow,
} from "@/features/documents/framework/ui-types";
import { getDocConfig } from "@/features/documents/engine/config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

const ALL_COLUMNS: DocumentListColumnId[] = [
  "number",
  "date",
  "party",
  "branch",
  "status",
  "total",
  "actions",
];

const PAGE_SIZES = [10, 20, 50];

const NEW_DOC_LABEL_KEY: Record<CommercialDocType, string> = {
  QUOTATION: "documentsUI.newQuotation",
  SALES_ORDER: "documentsUI.newSalesOrder",
  DELIVERY_NOTE: "documentsUI.newDeliveryNote",
  INVOICE: "documentsUI.newInvoice",
  CREDIT_NOTE: "documentsUI.newCreditNote",
  PURCHASE_REQUEST: "documentsUI.newPurchaseRequest",
  PURCHASE_ORDER: "documentsUI.newPurchaseOrder",
  GOODS_RECEIPT: "documentsUI.newGoodsReceipt",
  SUPPLIER_INVOICE: "documentsUI.newSupplierInvoice",
  CUSTOMER_ORDER: "documentsUI.newCustomerOrder",
  PROFORMA: "documentsUI.newProforma",
};

type SortKey = "date" | "number" | "party" | "status" | "total";

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: "date", labelKey: "documentsUI.colDate" },
  { key: "number", labelKey: "documentsUI.colNumber" },
  { key: "party", labelKey: "documentsUI.colParty" },
  { key: "status", labelKey: "documentsUI.colStatus" },
  { key: "total", labelKey: "documentsUI.colTotal" },
];

function compareRows(a: DocumentRow, b: DocumentRow, key: SortKey): number {
  switch (key) {
    case "date":
      return a.issuedAt.localeCompare(b.issuedAt);
    case "number":
      return a.number.localeCompare(b.number, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    case "party":
      return (a.partyName ?? "").localeCompare(b.partyName ?? "");
    case "status":
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    case "total":
      return a.totalTtc - b.totalTtc;
  }
}

type SavedFilter = { name: string; status: string; search: string };

function savedFilterKey(type: CommercialDocType): string {
  return `dzerp.documents.filters.${type}`;
}

export function DocumentList({
  type,
  initialItems,
  initialTotal,
  initialPageSize = 20,
  basePath,
}: {
  type: CommercialDocType;
  initialItems: DocumentRow[];
  initialTotal: number;
  initialPageSize?: number;
  basePath?: string;
}) {
  const { t, locale } = useI18n();
  const company = useCompany();
  const router = useRouter();
  const ui = getUiConfig(type);
  const config = getDocConfig(type);
  const newDocumentLabel = t(NEW_DOC_LABEL_KEY[type]);

  const canCreate = company.permissions.includes("documents.create");
  const canDelete = company.permissions.includes("documents.delete");
  const canApprove = company.permissions.includes("documents.approve");
  const canConvert = company.permissions.includes("documents.convert");
  const canPrint = company.permissions.includes("documents.print");

  const [items, setItems] = React.useState<DocumentRow[]>(initialItems);
  const [total, setTotal] = React.useState(initialTotal);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [status, setStatus] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [appliedSearch, setAppliedSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [columns, setColumns] = React.useState<DocumentListColumnId[]>(
    ui.listColumns,
  );
  const [presets, setPresets] = React.useState<SavedFilter[]>([]);
  const [convertFor, setConvertFor] = React.useState<DocumentRow | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(savedFilterKey(type));
        if (raw) setPresets(JSON.parse(raw) as SavedFilter[]);
      } catch {
        setPresets([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [type]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDocuments(type, {
        page,
        pageSize,
        status: status || undefined,
        search: appliedSearch || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
      setSelected(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.error"),
      );
    } finally {
      setLoading(false);
    }
  }, [type, page, pageSize, status, appliedSearch, t]);

  const initialHydrated = React.useRef(false);

  React.useEffect(() => {
    if (!initialHydrated.current) {
      // Les données initiales sont rendues par le serveur (page 1, sans filtre) :
      // ne pas re-fetch la même page au montage.
      initialHydrated.current = true;
      return;
    }
    // Rechargement après changement de page/filtre (le montage garde les données serveur).
    void load();
  }, [load]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePageSelection = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const toggleColumn = (column: DocumentListColumnId, checked: boolean) => {
    setColumns((prev) =>
      checked ? [...prev, column] : prev.filter((c) => c !== column),
    );
  };

  const refresh = async () => {
    await load();
  };

  const runBulk = async (
    action: "approve" | "reject" | "cancel" | "delete",
  ) => {
    if (selected.size === 0) {
      toast.error(t("documentsUI.noSelection"));
      return;
    }
    const confirmKey = {
      approve: "documentsUI.confirmBulkApprove",
      reject: "documentsUI.confirmBulkReject",
      cancel: "documentsUI.confirmBulkCancel",
      delete: "documentsUI.confirmBulkDelete",
    }[action];
    if (!window.confirm(t(confirmKey))) return;

    setBusy(true);
    let failed = 0;
    try {
      for (const id of Array.from(selected)) {
        try {
          if (action === "approve") await approveDocument(type, id);
          else if (action === "reject")
            await changeStatus(type, id, "REJECTED");
          else if (action === "cancel")
            await changeStatus(type, id, "CANCELLED");
          else await deleteDocument(type, id);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        toast.warning(
          t("documentsUI.bulkDone", { count: selected.size - failed }) +
            ` — ${failed} ${t("common.error")}`,
        );
      } else {
        toast.success(
          t("documentsUI.bulkDone", { count: selected.size }),
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (row: DocumentRow) => {
    setBusy(true);
    try {
      const detail = await getDocument(type, row.id);
      const partyField = config.partyField;
      await createDocument(type, {
        branchId: detail.branchId,
        ...(partyField === "customerId"
          ? { customerId: detail.partyId ?? undefined }
          : { supplierId: detail.partyId ?? undefined }),
        currency: detail.currency,
        exchangeRate: detail.exchangeRate,
        notes: detail.notes ?? undefined,
        lines: detail.lines.map((line) => ({
          kind: line.kind,
          productId: line.productId ?? undefined,
          label: line.label,
          unit: line.unit ?? undefined,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPct: line.discountPct,
          taxPct: line.taxPct,
        })),
      });
      toast.success(t("documentsUI.saved"));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("documentsUI.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: DocumentRow) => {
    if (!window.confirm(t("documentsUI.confirmDelete"))) return;
    setBusy(true);
    try {
      await deleteDocument(type, row.id);
      toast.success(t("documentsUI.saved"));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof DocumentApiError && error.code === "NOT_DRAFT"
          ? t("documentsUI.onlyDraftEditable")
          : error instanceof Error
            ? error.message
            : t("common.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const escape = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const header = [
      t("documentsUI.colNumber"),
      t("documentsUI.colDate"),
      t("documentsUI.colParty"),
      t("documentsUI.colBranch"),
      t("documentsUI.colStatus"),
      t("documentsUI.colTotal"),
    ];
    const rows = items.map((row) => [
      escape(row.number),
      escape(row.issuedAt.slice(0, 10)),
      escape(row.partyName ?? ""),
      escape(row.branchName ?? ""),
      escape(t(`status.${row.status}`)),
      escape(row.totalTtc.toFixed(2)),
    ]);
    const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join(
      "\r\n",
    );
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type.toLowerCase()}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const savePreset = (name: string) => {
    const next: SavedFilter[] = [
      ...presets.filter((p) => p.name !== name),
      { name, status, search },
    ];
    setPresets(next);
    window.localStorage.setItem(savedFilterKey(type), JSON.stringify(next));
  };

  const applyPreset = (preset: SavedFilter) => {
    setStatus(preset.status);
    setSearch(preset.search);
    setAppliedSearch(preset.search);
    setPage(1);
  };

  const removePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    window.localStorage.setItem(savedFilterKey(type), JSON.stringify(next));
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageCount = totalPages;

  const sortedItems = React.useMemo(() => {
    const next = [...items];
    next.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [items, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
            >
              search
            </span>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("documentsUI.searchPlaceholder")}
              className="ps-9"
              aria-label={t("common.search")}
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48" aria-label={t("documentsUI.statusFilter")}>
              <SelectValue placeholder={t("documentsUI.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("documentsUI.allStatuses")}</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="w-40" aria-label={t("documentsUI.sortBy")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={t("documentsUI.sortDirection")}
            title={t("documentsUI.sortDirection")}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {canCreate ? (
            <Button
              onClick={() => {
                if (basePath) window.location.href = `${basePath}/nouveau`;
              }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add
              </span>
              {newDocumentLabel}
            </Button>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={t("documentsUI.columns")}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  view_column
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <p className="mb-2 text-sm font-medium">{t("documentsUI.toggleColumns")}</p>
              <div className="space-y-2">
                {ALL_COLUMNS.filter((c) => c !== "actions").map((column) => (
                  <label
                    key={column}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={columns.includes(column)}
                      onCheckedChange={(checked) =>
                        toggleColumn(column, checked === true)
                      }
                    />
                    {t(`documentsUI.col${column.charAt(0).toUpperCase()}${column.slice(1)}`)}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={exportCsv}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              download
            </span>
            {t("documentsUI.exportCsv")}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  bookmark
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium">
                    {t("documentsUI.statusFilter")}
                  </p>
                  {presets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("documentsUI.noHistory")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {presets.map((preset) => (
                        <div
                          key={preset.name}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <button
                            type="button"
                            className="truncate text-start hover:underline"
                            onClick={() => applyPreset(preset)}
                          >
                            {preset.name}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1 text-muted-foreground"
                            onClick={() => removePreset(preset.name)}
                            aria-label={t("common.delete")}
                          >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                              close
                            </span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                <SaveFilterForm onSave={savePreset} />
              </div>
            </PopoverContent>
          </Popover>

          {canPrint ? (
            <Button variant="outline">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                print
              </span>
            </Button>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {t("documentsUI.selected", { count: selected.size })}
          </span>
          <div className="flex items-center gap-1.5">
            {canApprove ? (
              <Button size="sm" variant="outline" onClick={() => runBulk("approve")} disabled={busy}>
                {t("documentsUI.bulkApprove")}
              </Button>
            ) : null}
            {canApprove ? (
              <Button size="sm" variant="outline" onClick={() => runBulk("reject")} disabled={busy}>
                {t("documentsUI.bulkReject")}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => runBulk("cancel")} disabled={busy}>
              {t("documentsUI.bulkCancel")}
            </Button>
            {canDelete ? (
              <Button size="sm" variant="destructive" onClick={() => runBulk("delete")} disabled={busy}>
                {t("documentsUI.bulkDelete")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-md border">
        {loading ? (
          <Spinner className="py-16" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={t("common.selectPlaceholder")}
                    checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                    onCheckedChange={(checked) =>
                      togglePageSelection(checked === true)
                    }
                  />
                </TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className={cn(column === "total" || column === "actions" ? "text-end" : undefined)}
                  >
                    {t(
                      `documentsUI.col${column.charAt(0).toUpperCase()}${column.slice(1)}`,
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="py-6"
                  >
                    <EmptyState
                      icon="description"
                      title={t("documentsUI.emptyList")}
                      description={t("documentsUI.emptyListDescription")}
                      action={
                        canCreate ? (
                          <Button
                            onClick={() => {
                              if (basePath) window.location.href = `${basePath}/nouveau`;
                            }}
                            className="mt-2"
                          >
                            <span className="material-symbols-outlined me-1 text-[18px]" aria-hidden="true">
                              add
                            </span>
                            {newDocumentLabel}
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((row) => (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(checked) =>
                          toggleSelected(row.id, checked === true)
                        }
                        aria-label={t("common.selectPlaceholder")}
                      />
                    </TableCell>
                    {columns.includes("number") ? (
                      <TableCell className="font-medium">
                        {basePath ? (
                          <a href={`${basePath}/${row.id}`} className="hover:underline">
                            {row.number}
                          </a>
                        ) : (
                          row.number
                        )}
                      </TableCell>
                    ) : null}
                    {columns.includes("date") ? (
                      <TableCell className="text-muted-foreground">
                        {row.issuedAt ? formatDate(row.issuedAt, locale === "ar" ? "ar-DZ" : locale) : "—"}
                      </TableCell>
                    ) : null}
                    {columns.includes("party") ? (
                      <TableCell>{row.partyName ?? "—"}</TableCell>
                    ) : null}
                    {columns.includes("branch") ? (
                      <TableCell className="text-muted-foreground">
                        {row.branchName ?? "—"}
                      </TableCell>
                    ) : null}
                    {columns.includes("status") ? (
                      <TableCell>
                        <DocumentStatusBadge
                          status={row.status}
                          showDot={false}
                          withHint
                        />
                      </TableCell>
                    ) : null}
                    {columns.includes("total") ? (
                      <TableCell className="text-end tabular-nums">
                        {formatCurrency(row.totalTtc, locale === "ar" ? "ar-DZ" : locale, row.currency)}
                      </TableCell>
                    ) : null}
                    {columns.includes("actions") ? (
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          {basePath ? (
                            <Button asChild variant="ghost" size="sm">
                              <a href={`${basePath}/${row.id}`} aria-label={t("documentsUI.viewDocument")}>
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  visibility
                                </span>
                              </a>
                            </Button>
                          ) : null}
                          {canCreate ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicate(row)}
                              disabled={busy}
                              aria-label={t("documentsUI.duplicateDocument")}
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                content_copy
                              </span>
                            </Button>
                          ) : null}
                          {canConvert && ui.allowedConversions.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConvertFor(row)}
                              disabled={busy}
                              aria-label={t("documentsUI.convertDocument")}
                            >
                              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                swap_horiz
                              </span>
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(row)}
                              disabled={busy}
                              aria-label={t("documentsUI.deleteDocument")}
                            >
                              <span className="material-symbols-outlined text-[18px] text-destructive" aria-hidden="true">
                                delete
                              </span>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {total} {t("documentsUI.results")}
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
          <Badge variant="secondary">
            {page} {t("documentsUI.of")} {pageCount}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount || loading}
          >
            <span className="material-symbols-outlined text-[16px] rtl:-scale-x-100" aria-hidden="true">
              chevron_right
            </span>
            <span className="sr-only">{t("documentsUI.next")}</span>
          </Button>
        </div>
      </div>

      {convertFor ? (
        <DocumentConvertDialog
          open={!!convertFor}
          onOpenChange={(open) => {
            if (!open) setConvertFor(null);
          }}
          sourceType={type}
          sourceId={convertFor.id}
          onConverted={(target) => {
            setConvertFor(null);
            if (target) {
              // The resulting document lives in its own list — take the user there
              // so the converted document never "disappears".
              router.push(`/documents/${target.toLowerCase()}`);
            } else {
              void refresh();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function SaveFilterForm({ onSave }: { onSave: (name: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = React.useState("");

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("documentsUI.filterName")}
        className="h-8"
        aria-label={t("documentsUI.filterName")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onSave(name.trim());
            setName("");
          }
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        className="h-8"
        onClick={() => {
          if (name.trim()) {
            onSave(name.trim());
            setName("");
          }
        }}
        disabled={!name.trim()}
      >
        {t("documentsUI.save")}
      </Button>
    </div>
  );
}
