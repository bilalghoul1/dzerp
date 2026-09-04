"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useCompany } from "@/features/company/company-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/feedback/spinner";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getUiConfig, docTypeSlug } from "@/features/documents/framework/ui-config";
import { STATUS_ORDER } from "@/features/documents/framework/status-meta";
import { getAllDocTypes } from "@/features/documents/engine/config";
import {
  listDocumentsOverview,
  bulkDeleteDocuments,
  bulkDuplicateDocuments,
  type OverviewSelectionItem,
} from "@/features/documents/framework/api";
import type { DocumentOverviewRow } from "@/features/documents/framework/ui-types";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

const ORPHAN_KEY = "__without_party__";

type Group = {
  key: string;
  name: string;
  partyStatus: "active" | "deleted" | "missing";
  rows: DocumentOverviewRow[];
};

function toSelection(row: DocumentOverviewRow): OverviewSelectionItem {
  return { docType: row.docType, id: row.id };
}

export function DocumentGroups({
  initialRows,
}: {
  initialRows: DocumentOverviewRow[];
}) {
  const { t, locale } = useI18n();
  const company = useCompany();

  const canCreate = company.permissions.includes("documents.create");
  const canDelete = company.permissions.includes("documents.delete");

  const [rows, setRows] = React.useState<DocumentOverviewRow[]>(initialRows);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [docType, setDocType] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<{
    rows: OverviewSelectionItem[];
    count: number;
  } | null>(null);

  const applySearch = (value: string) => {
    setSelected(new Set());
    setSearch(value);
  };
  const applyStatus = (value: string) => {
    setSelected(new Set());
    setStatus(value);
  };
  const applyDocType = (value: string) => {
    setSelected(new Set());
    setDocType(value);
  };
  const applyFrom = (value: string) => {
    setSelected(new Set());
    setFrom(value);
  };
  const applyTo = (value: string) => {
    setSelected(new Set());
    setTo(value);
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (docType && row.docType !== docType) return false;
      if (status && row.status !== status) return false;
      if (from && row.issuedAt.slice(0, 10) < from) return false;
      if (to && row.issuedAt.slice(0, 10) > to) return false;
      if (!q) return true;
      return (
        row.number.toLowerCase().includes(q) ||
        (row.partyName ?? "").toLowerCase().includes(q) ||
        (row.branchName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status, docType, from, to]);

  const groups = React.useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    const put = (key: string, row: DocumentOverviewRow) => {
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, {
          key,
          name: row.partyName ?? "",
          partyStatus: row.partyStatus,
          rows: [row],
        });
      }
    };
    for (const row of filtered) {
      const orphan = row.partyStatus !== "active";
      const key = orphan ? ORPHAN_KEY : (row.partyId ?? ORPHAN_KEY);
      put(key, row);
    }
    const groups = Array.from(map.values());
    groups.forEach((group) => group.rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
    const orphan = groups.filter((g) => g.key === ORPHAN_KEY);
    const regular = groups
      .filter((g) => g.key !== ORPHAN_KEY)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", locale === "ar" ? "ar" : "fr"));
    return [...regular, ...orphan];
  }, [filtered, locale]);

  const totalFiltered = filtered.length;
  const allSelected = totalFiltered > 0 && filtered.every((row) => selected.has(row.id));

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((row) => row.id)) : new Set());
  };

  const toggleGroup = (group: Group, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of group.rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await listDocumentsOverview();
      setRows(next);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const runDuplicate = async () => {
    if (selected.size === 0) {
      toast.error(t("documentsUI.noSelection"));
      return;
    }
    const docs = rows
      .filter((row) => selected.has(row.id) && row.partyStatus === "active")
      .map(toSelection);
    const skippedOrphan = selected.size - docs.length;
    if (docs.length === 0) {
      toast.error(t("documentsUI.noDuplicateNoParty", { count: skippedOrphan }));
      return;
    }
    if (!window.confirm(t("documentsUI.confirmBulkDuplicate", { count: docs.length }))) return;
    setBusy(true);
    try {
      const result = await bulkDuplicateDocuments(docs);
      toast[
        result.failed.length > 0 ? "warning" : "success"
      ](
        t("documentsUI.bulkDuplicateResult", {
          created: result.duplicated.length,
          failed: result.failed.length,
        }),
      );
      if (skippedOrphan > 0) {
        toast.warning(t("documentsUI.noDuplicateNoParty", { count: skippedOrphan }));
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    const docs = deleteTarget.rows;
    setBusy(true);
    try {
      const result = await bulkDeleteDocuments(docs);
      const reason = result.failed.length > 0 ? ` — ${result.failed[0]?.reason ?? ""}` : "";
      toast[
        result.failed.length > 0 ? "warning" : "success"
      ](
        t("documentsUI.bulkDeleteResult", {
          deleted: result.deleted.length,
          failed: result.failed.length,
          reason,
        }),
      );
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = () => {
    if (selected.size === 0) {
      toast.error(t("documentsUI.noSelection"));
      return;
    }
    const docs = rows.filter((row) => selected.has(row.id)).map(toSelection);
    setDeleteTarget({ rows: docs, count: docs.length });
  };

  const deleteSingle = (row: DocumentOverviewRow) => {
    setDeleteTarget({ rows: [toSelection(row)], count: 1 });
  };

  const duplicateSingle = async (row: DocumentOverviewRow) => {
    if (!window.confirm(t("documentsUI.confirmBulkDuplicate", { count: 1 }))) return;
    setBusy(true);
    try {
      const result = await bulkDuplicateDocuments([toSelection(row)]);
      toast.success(
        t("documentsUI.bulkDuplicateResult", {
          created: result.duplicated.length,
          failed: result.failed.length,
        }),
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const localeTag = locale === "ar" ? "ar-DZ" : locale === "en" ? "en" : locale;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <span
                aria-hidden="true"
                className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
              >
                search
              </span>
              <Input
                type="search"
                value={search}
                onChange={(e) => applySearch(e.target.value)}
                placeholder={t("documentsUI.searchPlaceholder")}
                className="ps-9"
                aria-label={t("common.search")}
              />
            </div>
            <Select value={docType} onValueChange={applyDocType}>
              <SelectTrigger className="w-full lg:w-52" aria-label={t("documentsUI.docTypeFilter")}>
                <SelectValue placeholder={t("documentsUI.allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("documentsUI.allTypes")}</SelectItem>
                {getAllDocTypes().map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`docTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={applyStatus}>
              <SelectTrigger className="w-full lg:w-48" aria-label={t("documentsUI.statusFilter")}>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="date"
                value={from}
                onChange={(e) => applyFrom(e.target.value)}
                aria-label={t("documentsUI.dateFrom")}
                className="w-full lg:w-40"
              />
              <span className="text-sm text-muted-foreground">—</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => applyTo(e.target.value)}
                aria-label={t("documentsUI.dateTo")}
                className="w-full lg:w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {t("documentsUI.selected", { count: selected.size })}
          </span>
          <div className="flex items-center gap-1.5">
            {canCreate ? (
              <Button size="sm" variant="outline" onClick={runDuplicate} disabled={busy}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  content_copy
                </span>
                {t("documentsUI.bulkDuplicate")}
              </Button>
            ) : null}
            {canDelete ? (
              <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={busy}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  delete
                </span>
                {t("documentsUI.bulkDelete")}
              </Button>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={busy}
          >
            {t("documentsUI.clearSelection")}
          </Button>
        </div>
      ) : null}

      {canDelete ? (
        <p className="text-xs text-muted-foreground">{t("documentsUI.onlyDraftDeletableHint")}</p>
      ) : null}

      {loading ? (
        <Spinner className="py-16" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon="description"
              title={t("documentsUI.emptyList")}
              description={t("documentsUI.emptyListDescription")}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalFiltered} {t("documentsUI.results")}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} />
              {t("documentsUI.selectAllVisible")}
            </label>
          </div>

          {groups.map((group) => {
            const isOrphan = group.key === ORPHAN_KEY;
            const isCollapsed = collapsed.has(group.key);
            const selectedInGroup = group.rows.every((row) => selected.has(row.id));
            return (
              <Card key={group.key} className={cn(isOrphan && "border-amber-500/40 bg-amber-500/[0.03]")}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={selectedInGroup}
                    onCheckedChange={(v) => toggleGroup(group, v === true)}
                    aria-label={t("documentsUI.selectAllGroup")}
                    disabled={group.rows.length === 0}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                    className="flex flex-1 items-center gap-2 text-start"
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "material-symbols-outlined text-[20px] text-muted-foreground transition-transform rtl:-scale-x-100",
                        isCollapsed && "rotate-[-90deg]",
                      )}
                    >
                      expand_more
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-muted-foreground" aria-hidden="true">
                      {isOrphan ? "person_off" : "group"}
                    </span>
                    <span className="font-medium">{isOrphan ? t("documentsUI.groupWithoutParty") : (group.name || "—")}</span>
                    {isOrphan ? (
                      <Badge variant="warning">{t("documentsUI.groupWithoutPartyHint")}</Badge>
                    ) : group.partyStatus === "deleted" ? (
                      <Badge variant="warning">{t("documentsUI.partyDeleted")}</Badge>
                    ) : null}
                  </button>
                  <Badge variant="secondary">
                    {group.rows.length} {t("documentsUI.results")}
                  </Badge>
                </div>
                {!isCollapsed ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("documentsUI.colNumber")}</TableHead>
                        <TableHead>{t("documentsUI.colType")}</TableHead>
                        <TableHead>{t("documentsUI.colDate")}</TableHead>
                        <TableHead>{t("documentsUI.colStatus")}</TableHead>
                        <TableHead className="text-end">{t("documentsUI.colTotal")}</TableHead>
                        <TableHead className="text-end">{t("documentsUI.colActions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => {
                        const ui = getUiConfig(row.docType);
                        const href = `/documents/${docTypeSlug(row.docType)}/${row.id}`;
                        return (
                          <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                            <TableCell className="font-medium">
                              <a href={href} className="hover:underline">
                                {row.number}
                              </a>
                              {isOrphan && row.partyName ? (
                                <p className="text-xs text-muted-foreground">{row.partyName}</p>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                                  {ui.icon}
                                </span>
                                {t(`docTypes.${row.docType}`)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.issuedAt ? formatDate(row.issuedAt, localeTag) : "—"}
                            </TableCell>
                            <TableCell>
                              <DocumentStatusBadge status={row.status} showDot={false} />
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatCurrency(row.totalTtc, localeTag, row.currency)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button asChild variant="ghost" size="sm">
                                  <a href={href} aria-label={t("documentsUI.viewDocument")}>
                                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                      visibility
                                    </span>
                                  </a>
                                </Button>
                                {canCreate ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => duplicateSingle(row)}
                                    disabled={busy || row.partyStatus !== "active"}
                                    title={row.partyStatus !== "active" ? t("documentsUI.noDuplicateNoParty", { count: 1 }) : undefined}
                                    aria-label={t("documentsUI.duplicateDocument")}
                                  >
                                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                      content_copy
                                    </span>
                                  </Button>
                                ) : null}
                                {canDelete ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteSingle(row)}
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("documentsUI.confirmBulkDeleteTitle", { count: deleteTarget?.count ?? 0 })}
            </DialogTitle>
            <DialogDescription>
              {t("documentsUI.confirmBulkDeleteGroups", { count: deleteTarget?.count ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {t("documentsUI.onlyDraftDeletableHint")}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={runDelete}
              disabled={busy}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                delete
              </span>
              {t("documentsUI.confirmBulkDeleteAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}