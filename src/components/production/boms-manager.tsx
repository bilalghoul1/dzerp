"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { BomRow, BomItemRow } from "@/features/production/config";

type Option = { id: string; code: string; name: string };
type Options = { products: Option[]; warehouses: Option[]; boms: Option[]; workCenters: Option[] };

type ItemDraft = { productId: string; quantity: string; unitId: string; notes: string };

type FormState = {
  code: string;
  name: string;
  productId: string;
  version: string;
  isActive: boolean;
  notes: string;
  items: ItemDraft[];
};

const EMPTY: FormState = {
  code: "",
  name: "",
  productId: "",
  version: "1",
  isActive: true,
  notes: "",
  items: [{ productId: "", quantity: "", unitId: "", notes: "" }],
};

export function BomsManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: BomRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<BomRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: BomRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      productId: row.productId,
      version: String(row.version),
      isActive: row.isActive,
      notes: row.notes ?? "",
      items:
        row.items.length > 0
          ? row.items.map((it: BomItemRow) => ({
              productId: it.productId,
              quantity: String(it.quantity),
              unitId: it.unitId ?? "",
              notes: it.notes ?? "",
            }))
          : [{ productId: "", quantity: "", unitId: "", notes: "" }],
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
    return t("production.saveError");
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        productId: form.productId,
        version: Number(form.version) || 1,
        isActive: form.isActive,
        notes: form.notes,
        items: form.items
          .filter((it) => it.productId && Number(it.quantity) > 0)
          .map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitId: it.unitId || null,
            notes: it.notes || null,
          })),
      };
      if (!payload.items.length) throw new Error(t("production.emptyBom"));

      const res = await fetch(
        editingId ? `/api/production/boms` : `/api/production/boms`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("production.saveSuccess"));
      setDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: BomRow) => {
    if (!window.confirm(t("production.deleteBomConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/production/boms?id=${row.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("production.saveSuccess"));
      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const setItem = (idx: number, field: keyof ItemDraft, value: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, { productId: "", quantity: "", unitId: "", notes: "" }],
    }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

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
          {t("production.addBom")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("production.bomCode")}</TableHead>
              <TableHead>{t("production.bomName")}</TableHead>
              <TableHead>{t("production.bomProduct")}</TableHead>
              <TableHead>{t("production.bomVersion")}</TableHead>
              <TableHead>{t("production.bomItems")}</TableHead>
              <TableHead>{t("production.bomStatus")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {t("production.emptyBom")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.productCode} — {row.productName}
                  </TableCell>
                  <TableCell>{row.version}</TableCell>
                  <TableCell className="text-muted-foreground">{row.items.length}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "success" : "secondary"}>
                      {row.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)} disabled={busy}>
                        {t("common.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(row)} disabled={busy}>
                        {t("production.deleteBom")}
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
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("production.editBom") : t("production.addBom")}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bom-code">{t("production.bomCode")} *</Label>
                  <Input id="bom-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bom-name">{t("production.bomName")} *</Label>
                  <Input id="bom-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bom-product">{t("production.bomProduct")} *</Label>
                  <Select value={form.productId} onValueChange={(v) => setField("productId", v)}>
                    <SelectTrigger id="bom-product"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bom-version">{t("production.bomVersion")}</Label>
                  <Input id="bom-version" type="number" value={form.version} onChange={(e) => setField("version", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bom-notes">{t("production.bomStatus")}</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Checkbox checked={form.isActive} onCheckedChange={(v) => setField("isActive", Boolean(v))} />
                    <span className="text-sm">{t("common.active")}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("production.bomItems")}</h3>
                <Button variant="outline" size="sm" onClick={addItem} disabled={busy}>
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                  {t("common.add")}
                </Button>
              </div>
              {form.items.map((it, idx) => (
                <div key={idx} className="grid gap-3 rounded-md border p-3 sm:grid-cols-12">
                  <div className="space-y-2 sm:col-span-5">
                    <Label>{t("production.bomProduct")}</Label>
                    <Select value={it.productId} onValueChange={(v) => setItem(idx, "productId", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {options.products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <Label>{t("production.bomQuantity")}</Label>
                    <Input type="number" value={it.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <Label>{t("production.bomUnit")}</Label>
                    <Input value={it.notes} onChange={(e) => setItem(idx, "notes", e.target.value)} placeholder="—" />
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={busy || form.items.length === 1}>
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
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
