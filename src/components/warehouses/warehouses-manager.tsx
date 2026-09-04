"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
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
import type {
  WarehouseManagerOptions,
  WarehouseRow,
} from "@/features/warehouses/config";

type FormState = {
  name: string;
  nameAr: string;
  description: string;
  branchId: string;
  address: string;
  managerId: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  nameAr: "",
  description: "",
  branchId: "",
  address: "",
  managerId: "",
  isActive: true,
};

export function WarehousesManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: WarehouseRow[];
  options: WarehouseManagerOptions;
}) {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [items, setItems] = React.useState<WarehouseRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(
    // « Nouvel entrepôt » depuis la barre globale (+ Nouveau) : le lien arrive
    // avec ?create=1 et ouvre directement le formulaire.
    () => searchParams.get("create") === "1",
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);

  const showArabic = locale === "ar";

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: WarehouseRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      nameAr: row.nameAr ?? "",
      description: row.description ?? "",
      branchId: row.branchId ?? "",
      address: row.address ?? "",
      managerId: row.managerId ?? "",
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
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        nameAr: form.nameAr,
        description: form.description,
        branchId: form.branchId,
        address: form.address,
        managerId: form.managerId,
        isActive: form.isActive,
      };

      const res = await fetch(
        editingId ? `/api/warehouses?id=${editingId}` : "/api/warehouses",
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

  const remove = async (row: WarehouseRow) => {
    if (!window.confirm(t("warehouses.deleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/warehouses?id=${row.id}`, {
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

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-start">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("warehouses.add")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("warehouses.code")}</TableHead>
              <TableHead>{t("warehouses.name")}</TableHead>
              <TableHead>{t("warehouses.branch")}</TableHead>
              <TableHead>{t("warehouses.manager")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("warehouses.empty")}
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
                  <TableCell className="text-muted-foreground">
                    {row.branchName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.managerName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "success" : "secondary"}>
                      {row.isActive ? t("common.active") : t("common.inactive")}
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
                        {t("warehouses.delete")}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("warehouses.edit") : t("warehouses.add")}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("warehouses.sectionGeneral")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="warehouse-name">{t("warehouses.name")} *</Label>
                  <Input
                    id="warehouse-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-name-ar">{t("warehouses.nameAr")}</Label>
                  <Input
                    id="warehouse-name-ar"
                    dir="rtl"
                    value={form.nameAr}
                    onChange={(e) => setField("nameAr", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-branch">{t("warehouses.branch")}</Label>
                  <Select
                    value={form.branchId}
                    onValueChange={(v) => setField("branchId", v)}
                  >
                    <SelectTrigger id="warehouse-branch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse-manager">{t("warehouses.manager")}</Label>
                  <Select
                    value={form.managerId}
                    onValueChange={(v) => setField("managerId", v)}
                  >
                    <SelectTrigger id="warehouse-manager">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {options.users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName ?? u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="warehouse-address">{t("warehouses.address")}</Label>
                  <Input
                    id="warehouse-address"
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="warehouse-description">{t("warehouses.description")}</Label>
                  <Textarea
                    id="warehouse-description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.status")}</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Checkbox
                      checked={form.isActive}
                      onCheckedChange={(v) => setField("isActive", Boolean(v))}
                    />
                    <span className="text-sm">{t("common.active")}</span>
                  </div>
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
