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
import type { MachineRow } from "@/features/production/config";

type Option = { id: string; code: string; name: string };
type Options = { products: Option[]; warehouses: Option[]; boms: Option[]; workCenters: Option[]; branches: Option[] };

type FormState = {
  code: string;
  name: string;
  nameAr: string;
  workCenterId: string;
  capacity: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  nameAr: "",
  workCenterId: "",
  capacity: "",
  isActive: true,
};

export function MachinesManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: MachineRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<MachineRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: MachineRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? "",
      workCenterId: row.workCenterId,
      capacity: row.capacity != null ? String(row.capacity) : "",
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
    return t("production.saveError");
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        nameAr: form.nameAr,
        workCenterId: form.workCenterId,
        capacity: form.capacity ? Number(form.capacity) : null,
        isActive: form.isActive,
      };
      const res = await fetch(
        editingId ? `/api/production/machines` : `/api/production/machines`,
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

  const remove = async (row: MachineRow) => {
    if (!window.confirm(t("production.deleteMachineConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/production/machines?id=${row.id}`, { method: "DELETE" });
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

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          {t("production.addMachine")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("production.mCode")}</TableHead>
              <TableHead>{t("production.mName")}</TableHead>
              <TableHead>{t("production.mWorkCenter")}</TableHead>
              <TableHead>{t("production.mCapacity")}</TableHead>
              <TableHead>{t("production.bomStatus")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("production.emptyMachine")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.workCenterName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.capacity ?? "—"}</TableCell>
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
                        {t("production.deleteMachine")}
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
            <DialogTitle>{editingId ? t("production.editMachine") : t("production.addMachine")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="m-code">{t("production.mCode")} *</Label>
                <Input id="m-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-name">{t("production.mName")} *</Label>
                <Input id="m-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-name-ar">{t("production.mName")} (ar)</Label>
                <Input id="m-name-ar" dir="rtl" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-wc">{t("production.mWorkCenter")} *</Label>
                <Select value={form.workCenterId} onValueChange={(v) => setField("workCenterId", v)}>
                  <SelectTrigger id="m-wc"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.workCenters.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-cap">{t("production.mCapacity")}</Label>
                <Input id="m-cap" type="number" value={form.capacity} onChange={(e) => setField("capacity", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("production.bomStatus")}</Label>
                <div className="flex h-9 items-center gap-2">
                  <Checkbox checked={form.isActive} onCheckedChange={(v) => setField("isActive", Boolean(v))} />
                  <span className="text-sm">{t("common.active")}</span>
                </div>
              </div>
            </div>
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
