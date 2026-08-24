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
import type { WorkCenterRow } from "@/features/production/config";

type Option = { id: string; code: string; name: string };
type Options = { products: Option[]; warehouses: Option[]; boms: Option[]; workCenters: Option[]; branches: Option[] };

type FormState = {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  branchId: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  nameAr: "",
  description: "",
  branchId: "",
  isActive: true,
};

export function WorkCentersManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: WorkCenterRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<WorkCenterRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: WorkCenterRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? "",
      description: row.description ?? "",
      branchId: row.branchId ?? "",
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
        description: form.description,
        branchId: form.branchId,
        isActive: form.isActive,
      };
      const res = await fetch(
        editingId ? `/api/production/work-centers` : `/api/production/work-centers`,
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

  const remove = async (row: WorkCenterRow) => {
    if (!window.confirm(t("production.deleteWcConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/production/work-centers?id=${row.id}`, { method: "DELETE" });
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
          {t("production.addWc")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("production.wcCode")}</TableHead>
              <TableHead>{t("production.wcName")}</TableHead>
              <TableHead>{t("production.wcDescription")}</TableHead>
              <TableHead>{t("production.wcBranch")}</TableHead>
              <TableHead>{t("production.bomStatus")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("production.emptyWc")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.description ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.branchName ?? "—"}</TableCell>
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
                        {t("production.deleteWc")}
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
            <DialogTitle>{editingId ? t("production.editWc") : t("production.addWc")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wc-code">{t("production.wcCode")} *</Label>
                <Input id="wc-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wc-name">{t("production.wcName")} *</Label>
                <Input id="wc-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wc-name-ar">{t("production.bomName")} (ar)</Label>
                <Input id="wc-name-ar" dir="rtl" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wc-branch">{t("production.wcBranch")}</Label>
                <Select value={form.branchId} onValueChange={(v) => setField("branchId", v)}>
                  <SelectTrigger id="wc-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wc-desc">{t("production.wcDescription")}</Label>
                <Textarea id="wc-desc" rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
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
