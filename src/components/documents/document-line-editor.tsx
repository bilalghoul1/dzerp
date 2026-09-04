"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { useDocumentEditor } from "@/components/documents/document-editor-context";
import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { ProductRow } from "@/features/products/config";

function ProductPicker({
  products,
  onSelect,
}: {
  products: ProductRow[];
  onSelect: (product: ProductRow) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start overflow-hidden text-xs font-normal"
          title={t("documentsUI.pickProduct")}
        >
          <span className="material-symbols-outlined me-1 text-[16px] text-muted-foreground" aria-hidden="true">
            search
          </span>
          <span className="truncate">{t("documentsUI.pickProduct")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("documentsUI.searchProducts")}
          className="mb-2 h-8"
        />
        <ScrollArea className="max-h-64">
          <div className="space-y-0.5">
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t("documentsUI.noProducts")}
              </p>
            )}
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-muted"
                onClick={() => {
                  onSelect(product);
                  setOpen(false);
                }}
              >
                <span className="truncate font-medium">{product.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {product.code}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function DocumentLineEditor() {
  const { t, locale } = useI18n();
  const editor = useDocumentEditor();
  const ui = getUiConfig(editor.type);
  const isEditable = !editor.detail || editor.detail.status === "DRAFT";
  const [products, setProducts] = React.useState<ProductRow[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((payload) => {
        if (!cancelled) {
          const rows = Array.isArray(payload)
            ? payload
            : (payload as { data?: ProductRow[] })?.data ?? [];
          setProducts(rows.filter((p) => p.isActive));
        }
      })
      .catch(() => {
        setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultTax =
    editor.lookups.taxRates.find((rate) => rate.isDefault) ??
    editor.lookups.taxRates[0];

  const handleSelectProduct = (product: ProductRow, index: number) => {
    const price =
      ui.category === "purchasing"
        ? Number(product.purchasePrice) || 0
        : Number(product.sellingPrice) || 0;
    const unit =
      product.unitName && editor.lookups.units.some((u) => u.key === product.unitName)
        ? product.unitName
        : editor.lines[index]?.unit ?? null;
    editor.updateLine(index, {
      productId: product.id,
      label: product.name,
      unit,
      unitPrice: price,
      taxPct: editor.lines[index]?.taxPct ?? defaultTax?.rate ?? 0,
    });
  };

  const onCellKeyDown = (e: React.KeyboardEvent, lastCell: boolean) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        void editor.save();
      } else {
        editor.addLine();
      }
    }
    void lastCell;
  };

  const fmt = (value: number) =>
    formatNumber(value, locale === "ar" ? "ar-DZ" : locale);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">
          <span className="material-symbols-outlined me-1.5 align-middle text-[18px] text-muted-foreground" aria-hidden="true">
            edit_note
          </span>
          {t("documentsUI.linesSection")}
        </CardTitle>
        {isEditable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={editor.addLine}
            disabled={editor.busy}
          >
            <span className="material-symbols-outlined me-1 text-[16px]" aria-hidden="true">
              add
            </span>
            {t("documentsUI.addLine")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9 whitespace-nowrap">#</TableHead>
                <TableHead className="min-w-[200px]">
                  {t("documentsUI.lineDescription")}
                </TableHead>
                <TableHead className="w-[88px] whitespace-nowrap">{t("documentsUI.lineQty")}</TableHead>
                {editor.type === "SALES_ORDER" && (
                  <>
                    <TableHead className="w-[88px] whitespace-nowrap text-end">
                      {t("documentsUI.qtyDelivered")}
                    </TableHead>
                    <TableHead className="w-[88px] whitespace-nowrap text-end">
                      {t("documentsUI.qtyRemaining")}
                    </TableHead>
                    <TableHead className="w-[88px] whitespace-nowrap text-end">
                      {t("documentsUI.qtyToDeliver")}
                    </TableHead>
                  </>
                )}
                <TableHead className="w-[120px] whitespace-nowrap">{t("documentsUI.linePrice")}</TableHead>
                <TableHead className="w-[108px] whitespace-nowrap">{t("documentsUI.lineVat")}</TableHead>
                <TableHead className="w-[132px] whitespace-nowrap text-end">
                  {t("documentsUI.lineAmount")}
                </TableHead>
                {isEditable && (
                  <TableHead className="w-[84px] whitespace-nowrap">{t("documentsUI.lineActions")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {editor.lines.map((line, index) => {
                const computed = editor.totals.lines[index];
                const isComment = line.kind === "COMMENT";
                const isSection = line.kind === "SECTION";
                return (
                  <TableRow key={line.id ?? index}>
                    <TableCell className="py-1 align-top">
                      <span className="inline-block pt-2 text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 align-top">
                      <div className="flex flex-col gap-1">
                        {isEditable && line.kind === "PRODUCT" && (
                          <ProductPicker
                            products={products}
                            onSelect={(product) => handleSelectProduct(product, index)}
                          />
                        )}
                        <Input
                          value={line.label}
                          onChange={(e) =>
                            editor.updateLine(index, { label: e.target.value })
                          }
                          placeholder={
                            isComment
                              ? t("documentsUI.lineCommentPlaceholder")
                              : isSection
                                ? t("documentsUI.lineSectionPlaceholder")
                                : t("documentsUI.lineDescriptionPlaceholder")
                          }
                          className="h-9 w-full px-3"
                          disabled={!isEditable || editor.busy}
                          aria-label={t("documentsUI.lineDescription")}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-1 align-top">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          editor.updateLine(index, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                        onKeyDown={(e) => onCellKeyDown(e, false)}
                        className="h-9 w-full text-end px-3 min-w-[5.5rem]"
                        disabled={!isEditable || editor.busy}
                        inputMode="decimal"
                        aria-label={t("documentsUI.lineQty")}
                      />
                    </TableCell>
                    {editor.type === "SALES_ORDER" && (
                      <>
                        <TableCell className="py-1 align-top text-end">
                          <span className="inline-block pt-2 text-xs tabular-nums">
                            {line.remainingQty == null
                              ? "—"
                              : fmt(line.quantity - line.remainingQty)}
                          </span>
                        </TableCell>
                        <TableCell className="py-1 align-top text-end">
                          <span className="inline-block pt-2 text-xs tabular-nums">
                            {line.remainingQty == null ? "—" : fmt(line.remainingQty)}
                          </span>
                        </TableCell>
                        <TableCell className="py-1 align-top text-end">
                          <span className="inline-block pt-2 text-xs tabular-nums">
                            {line.remainingQty == null ? "—" : fmt(line.remainingQty)}
                          </span>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-1 align-top">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) =>
                          editor.updateLine(index, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                        onKeyDown={(e) => onCellKeyDown(e, false)}
                        className="h-9 w-full text-end px-3 min-w-[5.5rem]"
                        disabled={!isEditable || editor.busy}
                        inputMode="decimal"
                        aria-label={t("documentsUI.linePrice")}
                      />
                    </TableCell>
                    <TableCell className="py-1 align-top">
                      {isEditable ? (
                        <Select
                          value={String(line.taxPct)}
                          onValueChange={(value) =>
                            editor.updateLine(index, {
                              taxPct: Number(value),
                            })
                          }
                          disabled={editor.busy}
                        >
                          <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {editor.lookups.taxRates.map((rate) => (
                              <SelectItem key={rate.key} value={String(rate.rate)}>
                                {rate.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs">{line.taxPct}%</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 text-end align-top">
                      <span className="inline-block pt-2 text-sm font-medium tabular-nums">
                        {fmt(computed?.amountTtc ?? 0)}
                      </span>
                    </TableCell>
                    {isEditable && (
                      <TableCell className="py-1 align-top">
                        <div className="flex items-center gap-0.5 pt-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => editor.duplicateLine(index)}
                            disabled={editor.busy}
                            title={t("documentsUI.duplicateLine")}
                            aria-label={t("documentsUI.duplicateLine")}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              copy
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => editor.moveLine(index, "up")}
                            disabled={index === 0 || editor.busy}
                            title={t("documentsUI.moveUp")}
                            aria-label={t("documentsUI.moveUp")}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              arrow_upward
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => editor.moveLine(index, "down")}
                            disabled={index === editor.lines.length - 1 || editor.busy}
                            title={t("documentsUI.moveDown")}
                            aria-label={t("documentsUI.moveDown")}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              arrow_downward
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => editor.removeLine(index)}
                            disabled={editor.busy}
                            title={t("documentsUI.removeLine")}
                            aria-label={t("documentsUI.removeLine")}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                              delete
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {editor.lines.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      (isEditable ? 10 : 9) + (editor.type === "SALES_ORDER" ? 3 : 0)
                    }
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    {t("documentsUI.noLines")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            keyboard
          </span>
          {t("documentsUI.keyboardHint")}
        </p>
      </CardContent>
    </Card>
  );
}
