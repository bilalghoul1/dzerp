"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
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
import { EmptyState } from "@/components/feedback/empty-state";
import { Spinner } from "@/components/feedback/spinner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: boolean;
  pageSize?: number;
  rowClassName?: (row: TData) => string | undefined;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  pagination = true,
  pageSize = 10,
  rowClassName,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const { t } = useI18n();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable retourne des fonctions non mémoïsables
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize, pageIndex: 0 },
    },
  });

  if (loading) {
    return <Spinner className="py-16" />;
  }

  return (
    <div>
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
                  className={cn(
                    rowClassName?.(row.original),
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  data-state={row.getIsSelected() && "selected"}
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
                    title={emptyTitle ?? "Aucune donnée"}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && table.getRowModel().rows.length > 0 ? (
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
              Précédent
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
              Suivant
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
