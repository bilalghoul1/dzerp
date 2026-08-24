"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  formatCurrency,
  formatNumber,
} from "@/lib/utils";
import type {
  ProductCatalogOptions,
  ProductRow,
} from "@/features/products/config";
import { EmptyState } from "@/components/feedback/empty-state";
import { ProductsIllustration } from "@/components/illustrations";

type ProductType = "PRODUCT" | "SERVICE" | "RAW_MATERIAL" | "SEMI_FINISHED" | "FINISHED_PRODUCT";
type CostingMethod = "AVERAGE" | "FIFO" | "LIFO" | "STANDARD" | "MANUFACTURING";

type AttributeFormRow = {
  attributeId: string;
  value: string;
};

type FormState = {
  name: string;
  nameAr: string;
  description: string;
  sku: string;
  barcode: string;
  internalReference: string;
  type: ProductType;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  manufacturerId: string;
  unitId: string;
  vatCategoryId: string;
  costPrice: string;
  purchasePrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  retailPrice: string;
  minimumSellingPrice: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  minimumQuantity: string;
  maximumQuantity: string;
  reorderPoint: string;
  costingMethod: CostingMethod;
  weight: string;
  length: string;
  width: string;
  height: string;
  volume: string;
  preferredSupplierId: string;
  notes: string;
  attributes: AttributeFormRow[];
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    name: "",
    nameAr: "",
    description: "",
    sku: "",
    barcode: "",
    internalReference: "",
    type: "PRODUCT",
    categoryId: "",
    subcategoryId: "",
    brandId: "",
    manufacturerId: "",
    unitId: "",
    vatCategoryId: "",
    costPrice: "",
    purchasePrice: "",
    sellingPrice: "",
    wholesalePrice: "",
    retailPrice: "",
    minimumSellingPrice: "",
    trackInventory: true,
    allowNegativeStock: false,
    minimumQuantity: "",
    maximumQuantity: "",
    reorderPoint: "",
    costingMethod: "AVERAGE",
    weight: "",
    length: "",
    width: "",
    height: "",
    volume: "",
    preferredSupplierId: "",
    notes: "",
    attributes: [],
    isActive: true,
  };
}

const PRODUCT_TYPES: ProductType[] = [
  "PRODUCT",
  "SERVICE",
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_PRODUCT",
];

const COSTING_METHODS: CostingMethod[] = ["AVERAGE", "FIFO", "LIFO", "STANDARD", "MANUFACTURING"];

export function ProductsManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: ProductRow[];
  options: ProductCatalogOptions;
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = React.useState<ProductRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [busy, setBusy] = React.useState(false);

  const showArabic = locale === "ar";
  const topCategories = options.categories.filter((c) => !c.parentId);
  const subcategories = form.categoryId
    ? options.categories.filter((c) => c.parentId === form.categoryId)
    : [];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setEditingId(row.id);
    const attributes = row.attributes.map((a) => ({
      attributeId: a.attributeId,
      value: a.value,
    }));
    setForm({
      name: row.name,
      nameAr: row.nameAr ?? "",
      description: row.description ?? "",
      sku: row.sku === row.code ? "" : row.sku,
      barcode: row.barcode ?? "",
      internalReference: row.internalReference ?? "",
      type: row.type,
      categoryId: row.categoryId ?? "",
      subcategoryId: row.subcategoryId ?? "",
      brandId: row.brandId ?? "",
      manufacturerId: row.manufacturerId ?? "",
      unitId: row.unitId ?? "",
      vatCategoryId: row.vatCategoryId ?? "",
      costPrice: row.costPrice,
      purchasePrice: row.purchasePrice,
      sellingPrice: row.sellingPrice,
      wholesalePrice: row.wholesalePrice,
      retailPrice: row.retailPrice,
      minimumSellingPrice: row.minimumSellingPrice,
      trackInventory: row.trackInventory,
      allowNegativeStock: row.allowNegativeStock,
      minimumQuantity: row.minimumQuantity,
      maximumQuantity: row.maximumQuantity,
      reorderPoint: row.reorderPoint,
      costingMethod: row.costingMethod,
      weight: row.weight ?? "",
      length: row.length ?? "",
      width: row.width ?? "",
      height: row.height ?? "",
      volume: row.volume ?? "",
      preferredSupplierId: row.preferredSupplierId ?? "",
      notes: row.notes ?? "",
      attributes,
      isActive: row.isActive,
    });
    setDialogOpen(true);
  };

  const errorMessage = (json: unknown): string => {
    const code =
      json && typeof json === "object" && "error" in json
        ? (json as { error?: { code?: string } }).error?.code
        : undefined;
    if (code) {
      const translated = t(`errors.${code}`);
      if (!translated.startsWith("errors.")) return translated;
    }
    return t("common.error");
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("errors.INVALID_BODY"));
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        nameAr: form.nameAr,
        description: form.description,
        sku: form.sku,
        barcode: form.barcode,
        internalReference: form.internalReference,
        type: form.type,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        brandId: form.brandId,
        manufacturerId: form.manufacturerId,
        unitId: form.unitId,
        vatCategoryId: form.vatCategoryId,
        costPrice: form.costPrice,
        purchasePrice: form.purchasePrice,
        sellingPrice: form.sellingPrice,
        wholesalePrice: form.wholesalePrice,
        retailPrice: form.retailPrice,
        minimumSellingPrice: form.minimumSellingPrice,
        trackInventory: form.trackInventory,
        allowNegativeStock: form.allowNegativeStock,
        minimumQuantity: form.minimumQuantity,
        maximumQuantity: form.maximumQuantity,
        reorderPoint: form.reorderPoint,
        costingMethod: form.costingMethod,
        weight: form.weight,
        length: form.length,
        width: form.width,
        height: form.height,
        volume: form.volume,
        preferredSupplierId: form.preferredSupplierId,
        notes: form.notes,
        isActive: form.isActive,
        attributes: form.attributes.filter((a) => a.attributeId && a.value.trim()),
      };

      const res = await fetch(
        editingId ? `/api/products?id=${editingId}` : "/api/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorMessage(json));
      }
      toast.success(t("parametres.saveSuccess"));
      setDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: ProductRow) => {
    if (!window.confirm(t("products.deleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products?id=${row.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorMessage(json));
      }
      toast.success(t("parametres.saveSuccess"));
      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const setAttribute = (index: number, patch: Partial<AttributeFormRow>) => {
    setForm((f) => ({
      ...f,
      attributes: f.attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  };

  const addAttribute = () => {
    const available = options.attributes.find(
      (a) => !form.attributes.some((row) => row.attributeId === a.id),
    );
    setForm((f) => ({
      ...f,
      attributes: [...f.attributes, { attributeId: available?.id ?? "", value: "" }],
    }));
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("products.add")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.code")}</TableHead>
              <TableHead>{t("products.name")}</TableHead>
              <TableHead>{t("products.type")}</TableHead>
              <TableHead>{t("products.category")}</TableHead>
              <TableHead className="text-end">{t("products.sellingPrice")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <EmptyState
                    illustration={<ProductsIllustration className="size-24" />}
                    title={t("products.empty")}
                    description={t("products.emptyHint")}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>
                    <p>{row.name}</p>
                    {row.nameAr && !showArabic ? (
                      <p className="text-xs text-muted-foreground" dir="rtl">
                        {row.nameAr}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {t(`productTypes.${row.type}`)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.categoryName ?? "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(Number(row.sellingPrice))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive && !row.isArchived ? "success" : "secondary"}>
                      {row.isArchived
                        ? t("products.archived")
                        : row.isActive
                          ? t("common.active")
                          : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                        disabled={busy}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(row)}
                        disabled={busy}
                      >
                        {t("products.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("products.edit") : t("products.add")}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionGeneral")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name">{t("products.name")} *</Label>
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-name-ar">{t("products.nameAr")}</Label>
                  <Input
                    id="product-name-ar"
                    dir="rtl"
                    value={form.nameAr}
                    onChange={(e) => setField("nameAr", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-type">{t("products.type")}</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setField("type", v as ProductType)}
                  >
                    <SelectTrigger id="product-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`productTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-sku">{t("products.sku")}</Label>
                  <Input
                    id="product-sku"
                    value={form.sku}
                    onChange={(e) => setField("sku", e.target.value)}
                    placeholder={t("products.code")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-barcode">{t("products.barcode")}</Label>
                  <Input
                    id="product-barcode"
                    value={form.barcode}
                    onChange={(e) => setField("barcode", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-internal-ref">{t("products.internalReference")}</Label>
                  <Input
                    id="product-internal-ref"
                    value={form.internalReference}
                    onChange={(e) => setField("internalReference", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionCategorization")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-category">{t("products.category")}</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, categoryId: v, subcategoryId: "" }))
                    }
                  >
                    <SelectTrigger id="product-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {topCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-subcategory">{t("products.subcategory")}</Label>
                  <Select
                    value={form.subcategoryId}
                    onValueChange={(v) => setField("subcategoryId", v)}
                  >
                    <SelectTrigger id="product-subcategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {subcategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">{t("products.brand")}</Label>
                  <Select
                    value={form.brandId}
                    onValueChange={(v) => setField("brandId", v)}
                  >
                    <SelectTrigger id="product-brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-manufacturer">{t("products.manufacturer")}</Label>
                  <Select
                    value={form.manufacturerId}
                    onValueChange={(v) => setField("manufacturerId", v)}
                  >
                    <SelectTrigger id="product-manufacturer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.manufacturers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-unit">{t("products.unit")}</Label>
                  <Select
                    value={form.unitId}
                    onValueChange={(v) => setField("unitId", v)}
                  >
                    <SelectTrigger id="product-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                          {u.symbol ? ` (${u.symbol})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionPricing")}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="product-cost-price">{t("products.costPrice")}</Label>
                  <Input
                    id="product-cost-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.costPrice}
                    onChange={(e) => setField("costPrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-purchase-price">{t("products.purchasePrice")}</Label>
                  <Input
                    id="product-purchase-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.purchasePrice}
                    onChange={(e) => setField("purchasePrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-selling-price">{t("products.sellingPrice")}</Label>
                  <Input
                    id="product-selling-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.sellingPrice}
                    onChange={(e) => setField("sellingPrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-wholesale-price">{t("products.wholesalePrice")}</Label>
                  <Input
                    id="product-wholesale-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.wholesalePrice}
                    onChange={(e) => setField("wholesalePrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-retail-price">{t("products.retailPrice")}</Label>
                  <Input
                    id="product-retail-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.retailPrice}
                    onChange={(e) => setField("retailPrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-min-selling-price">{t("products.minimumSellingPrice")}</Label>
                  <Input
                    id="product-min-selling-price"
                    type="number"
                    min={0}
                    step="any"
                    value={form.minimumSellingPrice}
                    onChange={(e) => setField("minimumSellingPrice", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="product-vat">{t("products.vatCategory")}</Label>
                  <Select
                    value={form.vatCategoryId}
                    onValueChange={(v) => setField("vatCategoryId", v)}
                  >
                    <SelectTrigger id="product-vat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.vatCategories.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} ({formatNumber(Number(v.rate))}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-costing">{t("products.costingMethod")}</Label>
                  <Select
                    value={form.costingMethod}
                    onValueChange={(v) => setField("costingMethod", v as CostingMethod)}
                  >
                    <SelectTrigger id="product-costing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COSTING_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {t(`costingMethods.${method}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionStock")}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="product-min-qty">{t("products.minimumQuantity")}</Label>
                  <Input
                    id="product-min-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={form.minimumQuantity}
                    onChange={(e) => setField("minimumQuantity", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-max-qty">{t("products.maximumQuantity")}</Label>
                  <Input
                    id="product-max-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={form.maximumQuantity}
                    onChange={(e) => setField("maximumQuantity", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-reorder">{t("products.reorderPoint")}</Label>
                  <Input
                    id="product-reorder"
                    type="number"
                    min={0}
                    step="any"
                    value={form.reorderPoint}
                    onChange={(e) => setField("reorderPoint", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.trackInventory}
                        onCheckedChange={(v) => setField("trackInventory", Boolean(v))}
                      />
                      {t("products.trackInventory")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.allowNegativeStock}
                        onCheckedChange={(v) => setField("allowNegativeStock", Boolean(v))}
                      />
                      {t("products.allowNegativeStock")}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionPhysical")}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="product-weight">{t("products.weight")}</Label>
                  <Input
                    id="product-weight"
                    type="number"
                    min={0}
                    step="any"
                    value={form.weight}
                    onChange={(e) => setField("weight", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-length">{t("products.length")}</Label>
                  <Input
                    id="product-length"
                    type="number"
                    min={0}
                    step="any"
                    value={form.length}
                    onChange={(e) => setField("length", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-width">{t("products.width")}</Label>
                  <Input
                    id="product-width"
                    type="number"
                    min={0}
                    step="any"
                    value={form.width}
                    onChange={(e) => setField("width", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-height">{t("products.height")}</Label>
                  <Input
                    id="product-height"
                    type="number"
                    min={0}
                    step="any"
                    value={form.height}
                    onChange={(e) => setField("height", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-volume">{t("products.volume")}</Label>
                  <Input
                    id="product-volume"
                    type="number"
                    min={0}
                    step="any"
                    value={form.volume}
                    onChange={(e) => setField("volume", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.sectionSuppliers")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-preferred-supplier">{t("products.preferredSupplier")}</Label>
                  <Select
                    value={form.preferredSupplierId}
                    onValueChange={(v) => setField("preferredSupplierId", v)}
                  >
                    <SelectTrigger id="product-preferred-supplier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-active">{t("common.status")}</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Checkbox
                      id="product-active"
                      checked={form.isActive}
                      onCheckedChange={(v) => setField("isActive", Boolean(v))}
                    />
                    <span className="text-sm">{t("common.active")}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("products.attributes")}</h3>
              {form.attributes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dataTable.noData")}</p>
              ) : (
                <div className="space-y-2">
                  {form.attributes.map((attr, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={attr.attributeId}
                        onValueChange={(v) => setAttribute(index, { attributeId: v })}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          {options.attributes.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="flex-1"
                        value={attr.value}
                        onChange={(e) => setAttribute(index, { value: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            attributes: f.attributes.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          close
                        </span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  add
                </span>
                {t("products.addAttribute")}
              </Button>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("parties.sectionTerms")}</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-description">{t("products.description")}</Label>
                  <Textarea
                    id="product-description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-notes">{t("inventory.notes")}</Label>
                  <Textarea
                    id="product-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
