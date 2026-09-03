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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyAdminRow } from "@/features/company-admin/types";

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

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

const STATUS_FILTERS: StatusFilter[] = ["ALL", "ACTIVE", "SUSPENDED", "ARCHIVED"];

export function CompaniesTable({
  companies,
  canManage,
  canUpdate,
  canDelete,
}: {
  companies: CompanyAdminRow[];
  canManage: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = companies;
    if (statusFilter !== "ALL") {
      rows = rows.filter((c) => c.status === statusFilter);
    }
    if (!q) return rows;
    return rows.filter((c) =>
      [c.code, c.name, c.nameAr, c.commercialName, c.legalName, c.type, c.taxId, c.rc, c.nis, c.ai]
        .some((value) => value?.toLowerCase().includes(q)),
    );
  }, [companies, query, statusFilter]);

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
        accessorKey: "expiryDate",
        header: t("admin.colExpiry"),
        cell: ({ row }) => {
          const c = row.original;
          if (!c.expiryDate) return "—";
          const expired = c.trialExpired;
          return (
            <div className="flex flex-col gap-1">
              <Badge variant={expired ? "destructive" : "secondary"}>
                {expired ? t("admin.trialExpired") : t("admin.trial")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {c.expiryDate.slice(0, 10)}
              </span>
            </div>
          );
        },
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
        accessorKey: "ownerName",
        header: t("admin.ownerColumn"),
        cell: ({ row }) =>
          row.original.ownerName || row.original.ownerUsername ? (
            <span>
              {row.original.ownerName || "—"}
              {row.original.ownerUsername ? (
                <span className="block text-xs text-muted-foreground">
                  @{row.original.ownerUsername}
                </span>
              ) : null}
            </span>
          ) : (
            "—"
          ),
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
              {canUpdate && company.status !== "ARCHIVED" ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/admin/companies/${company.id}/modifier`}>
                    {t("admin.edit")}
                  </Link>
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void setStatus(company, company.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED");
                  }}
                >
                  {company.status === "ARCHIVED"
                    ? t("admin.restore")
                    : t("admin.archive")}
                </Button>
              ) : null}
              {canManage && company.status !== "ARCHIVED" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void setStatus(
                      company,
                      company.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                    );
                  }}
                >
                  {company.status === "SUSPENDED"
                    ? t("admin.reactivate")
                    : t("admin.suspend")}
                </Button>
              ) : null}
              {canDelete && !company.isActive ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/admin/companies/${company.id}`}>
                    {t("admin.delete")}
                  </Link>
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canManage, canUpdate, canDelete],
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

  const setStatus = async (
    company: CompanyAdminRow,
    target: "ACTIVE" | "SUSPENDED" | "ARCHIVED",
  ) => {
    const config =
      target === "SUSPENDED"
        ? {
            confirm: t("admin.confirmSuspend"),
            success: t("admin.suspendedSuccess"),
          }
        : company.status === "ARCHIVED"
          ? {
              confirm: t("admin.confirmRestore"),
              success: t("admin.restoredSuccess"),
            }
          : {
              confirm: t("admin.confirmActivate"),
              success: t("admin.activatedSuccess"),
            };
    if (!window.confirm(config.confirm)) return;
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(config.success);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

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
      t("admin.ownerColumn"),
      t("admin.colCreated"),
      t("admin.colExpiry"),
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
        c.ownerName || c.ownerUsername || "",
        c.createdAt.slice(0, 10),
        c.expiryDate ? `${c.expiryDate.slice(0, 10)}${c.trialExpired ? " (expiré)" : ""}` : "",
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [headers.join(","), ...lines].join("\n")], {
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

      <div className="mb-4 flex w-fit items-center gap-1 rounded-md border p-1">
        {STATUS_FILTERS.map((filter) => {
          const label =
            filter === "ALL"
              ? t("admin.filterAll")
              : filter === "ACTIVE"
                ? t("admin.filterActive")
                : filter === "SUSPENDED"
                  ? t("admin.filterSuspended")
                  : t("admin.filterArchived");
          return (
            <Button
              key={filter}
              size="sm"
              variant={statusFilter === filter ? "default" : "ghost"}
              onClick={() => setStatusFilter(filter)}
            >
              {label}
            </Button>
          );
        })}
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
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/admin/companies/${row.original.id}`)
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
                    title={t("admin.noCompanies")}
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
            {t("common.resultsCount", { n: table.getFilteredRowModel().rows.length })}
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
    </div>
  );
}
