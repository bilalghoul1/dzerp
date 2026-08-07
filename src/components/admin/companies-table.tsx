"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmModal } from "@/components/feedback/modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { CompanyAdminRow } from "@/features/company-admin/types";

type View = "active" | "archived";

type ConfirmAction =
  | { kind: "archive" | "delete" | "restore"; company: CompanyAdminRow }
  | null;

function statusBadgeVariant(status: CompanyAdminRow["status"]):
  | "success"
  | "secondary"
  | "warning"
  | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "ARCHIVED":
      return "destructive";
    default:
      return "secondary";
  }
}

export function CompaniesTable({
  companies,
  view = "active",
  canManage,
  canDelete,
  canUpdate,
  canRestore,
}: {
  companies: CompanyAdminRow[];
  view?: View;
  canManage: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  canRestore: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [confirm, setConfirm] = React.useState<ConfirmAction>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.code, c.name, c.nameAr, c.commercialName, c.legalName, c.type, c.taxId, c.rc, c.nis, c.ai]
        .some((value) => value?.toLowerCase().includes(q)),
    );
  }, [companies, query]);

  const columns = React.useMemo<ColumnDef<CompanyAdminRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("admin.colCode"),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: t("admin.colName"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            {row.original.commercialName &&
            row.original.commercialName !== row.original.name ? (
              <p className="text-xs text-muted-foreground">
                {row.original.commercialName}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "legalName",
        header: t("admin.colLegalName"),
        cell: ({ row }) => row.original.legalName ?? "—",
      },
      {
        accessorKey: "type",
        header: t("admin.colType"),
        cell: ({ row }) => row.original.type ?? "—",
      },
      {
        accessorKey: "status",
        header: t("admin.colStatus"),
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {t(`admin.status_${row.original.status}` as "admin.status_ACTIVE")}
          </Badge>
        ),
      },
      {
        accessorKey: "taxId",
        header: t("admin.colNif"),
        cell: ({ row }) => row.original.taxId ?? "—",
      },
      {
        accessorKey: "rc",
        header: t("admin.colRc"),
        cell: ({ row }) => row.original.rc ?? "—",
      },
      {
        accessorKey: "nis",
        header: t("admin.colNis"),
        cell: ({ row }) => row.original.nis ?? "—",
      },
      {
        accessorKey: "ai",
        header: t("admin.colAi"),
        cell: ({ row }) => row.original.ai ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: t("admin.colCreated"),
        cell: ({ row }) => row.original.createdAt.slice(0, 10),
      },
      {
        id: "actions",
        header: t("admin.colActions"),
        cell: ({ row }) => {
          const company = row.original;
          if (view === "archived") {
            return (
              <div className="flex items-center justify-end gap-1">
                {canRestore ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirm({ kind: "restore", company });
                    }}
                  >
                    {t("admin.restoreCompany")}
                  </Button>
                ) : null}
              </div>
            );
          }
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                asChild
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/admin/companies/${company.id}`}>
                  {t("admin.open")}
                </Link>
              </Button>
              {canUpdate || canManage || (canDelete && !company.isActive) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t("admin.colActions")}
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        aria-hidden="true"
                      >
                        more_vert
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {canUpdate ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/companies/${company.id}/edit`}>
                            {t("admin.edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/companies/${company.id}/branches`}>
                            {t("admin.tabBranches")}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {canManage ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          setConfirm({ kind: "archive", company })
                        }
                      >
                        {company.status === "ARCHIVED"
                          ? t("admin.restore")
                          : t("admin.archive")}
                      </DropdownMenuItem>
                    ) : null}
                    {canDelete && !company.isActive ? (
                      <DropdownMenuItem
                        onSelect={() => setConfirm({ kind: "delete", company })}
                      >
                        <span className="text-destructive">{t("admin.delete")}</span>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, view, canManage, canDelete, canUpdate, canRestore],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10, pageIndex: 0 } },
  });

  const refresh = () => {
    setQuery("");
    router.refresh();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, company } = confirm;
    setConfirm(null);
    try {
      if (kind === "restore") {
        const res = await fetch(`/api/admin/companies/${company.id}/restore`, {
          method: "POST",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error?.message ?? "Error");
        toast.success(t("admin.restoredCompanySuccess"));
        refresh();
        return;
      }
      if (kind === "archive") {
        const archived = company.status === "ARCHIVED";
        const res = await fetch(`/api/admin/companies/${company.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: archived ? "ACTIVE" : "ARCHIVED" }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error?.message ?? "Error");
        toast.success(
          archived ? t("admin.restoredSuccess") : t("admin.archivedSuccess"),
        );
        refresh();
        return;
      }
      if (kind === "delete") {
        const res = await fetch(`/api/admin/companies/${company.id}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const message = json?.error?.message ?? "Error";
          throw new Error(
            json?.error?.code === "COMPANY_HAS_DATA"
              ? t("admin.deleteBlocked")
              : message,
          );
        }
        toast.success(t("admin.deletedSuccess"));
        refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const confirmProps = confirm
    ? (() => {
        const { kind, company } = confirm;
        if (kind === "restore") {
          return {
            title: t("admin.restoreCompany"),
            description: t("admin.confirmRestoreCompany"),
            confirmLabel: t("admin.restoreCompany"),
          };
        }
        if (kind === "archive") {
          const archived = company.status === "ARCHIVED";
          return {
            title: archived ? t("admin.restore") : t("admin.archive"),
            description: archived
              ? t("admin.confirmRestore")
              : t("admin.confirmArchive"),
            confirmLabel: archived ? t("admin.restore") : t("admin.archive"),
          };
        }
        return {
          title: t("admin.delete"),
          description: t("admin.confirmDelete"),
          confirmLabel: t("admin.delete"),
          destructive: true,
        };
      })()
    : null;

  const exportCsv = () => {
    const headers = [
      t("admin.colCode"),
      t("admin.colName"),
      t("admin.colLegalName"),
      t("admin.colType"),
      t("admin.colStatus"),
      t("admin.colNif"),
      t("admin.colRc"),
      t("admin.colNis"),
      t("admin.colAi"),
      t("admin.colCreated"),
    ];
    const esc = (value: string | null | undefined) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((c) =>
      [
        c.code,
        c.name,
        c.legalName,
        c.type,
        t(`admin.status_${c.status}` as "admin.status_ACTIVE"),
        c.taxId,
        c.rc,
        c.nis,
        c.ai,
        c.createdAt.slice(0, 10),
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob(["﻿" + [headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `societes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center rounded-md border p-0.5 text-sm">
            <Link
              href="/admin/companies"
              className={cn(
                "rounded px-3 py-1 transition-colors",
                view === "active"
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("admin.viewActive")}
            </Link>
            <Link
              href="/admin/companies?view=archived"
              className={cn(
                "rounded px-3 py-1 transition-colors",
                view === "archived"
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("admin.viewDeleted")}
            </Link>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <span
              className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground"
              aria-hidden="true"
            >
              search
            </span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.searchPlaceholder")}
              className="ps-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              download
            </span>
            {t("admin.exportCsv")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t("admin.toggleColumns")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="sm">
            <Link href="/admin/companies/nouveau">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add
              </span>
              {t("admin.addCompany")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={view === "active" ? "cursor-pointer" : undefined}
                  onClick={
                    view === "active"
                      ? () => router.push(`/admin/companies/${row.original.id}`)
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24">
                  <EmptyState
                    title={
                      view === "archived"
                        ? t("admin.noDeletedCompanies")
                        : t("admin.noCompanies")
                    }
                    description={t("admin.companiesDescription")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getFilteredRowModel().rows.length > 0 ? (
        <div className="flex items-center justify-between gap-2 py-4">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} résultat(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {t("admin.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} /{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t("admin.next")}
            </Button>
          </div>
        </div>
      ) : null}

      {confirm && confirmProps ? (
        <ConfirmModal
          open
          onOpenChange={() => setConfirm(null)}
          title={confirmProps.title}
          description={confirmProps.description}
          confirmLabel={confirmProps.confirmLabel}
          destructive={confirmProps.destructive}
          onConfirm={() => void runConfirm()}
        />
      ) : null}
    </div>
  );
}
