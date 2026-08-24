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
import type { PositionRow } from "@/features/rh/config";

type Option = { id: string; code: string; name: string };
type Options = { branches: Option[]; departments: Option[]; jobTitles: Option[] };

type FormState = {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  departmentId: string;
  jobTitleId: string;
  branchId: string;
  headcount: string;
  managerEmployeeId: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  nameAr: "",
  description: "",
  departmentId: "",
  jobTitleId: "",
  branchId: "",
  headcount: "1",
  managerEmployeeId: "",
  isActive: true,
};

export function PositionsManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: PositionRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<PositionRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: PositionRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? "",
      description: row.description ?? "",
      departmentId: row.departmentId,
      jobTitleId: row.jobTitleId,
      branchId: row.branchId ?? "",
      headcount: String(row.headcount ?? 1),
      managerEmployeeId: row.managerEmployeeId ?? "",
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
    return t("rh.saveError");
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        nameAr: form.nameAr,
        description: form.description,
        departmentId: form.departmentId,
        jobTitleId: form.jobTitleId,
        branchId: form.branchId,
        headcount: form.headcount ? Number(form.headcount) : 1,
        managerEmployeeId: form.managerEmployeeId,
        isActive: form.isActive,
      };
      const res = await fetch(`/api/rh/positions`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("rh.saveSuccess"));
      setDialogOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("rh.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (row: PositionRow) => {
    if (!window.confirm(t("rh.archivePosConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rh/positions/${row.id}/archive`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json));
      toast.success(t("rh.saveSuccess"));
      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("rh.saveError"));
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
          {t("rh.addPos")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rh.posCode")}</TableHead>
              <TableHead>{t("rh.posName")}</TableHead>
              <TableHead>{t("rh.posDepartment")}</TableHead>
              <TableHead>{t("rh.posJobTitle")}</TableHead>
              <TableHead>{t("rh.posBranch")}</TableHead>
              <TableHead>{t("rh.posHeadcount")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t("rh.emptyPos")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.departmentName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.jobTitleName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.branchName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.headcount ?? "—"}</TableCell>
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
                      <Button variant="ghost" size="sm" onClick={() => archive(row)} disabled={busy}>
                        {t("rh.deletePos")}
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
            <DialogTitle>{editingId ? t("rh.editPos") : t("rh.addPos")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pos-code">{t("rh.posCode")} *</Label>
                <Input id="pos-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-name">{t("rh.posName")} *</Label>
                <Input id="pos-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-name-ar">{t("rh.posNameAr")}</Label>
                <Input id="pos-name-ar" dir="rtl" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-dept">{t("rh.posDepartment")} *</Label>
                <Select value={form.departmentId} onValueChange={(v) => setField("departmentId", v)}>
                  <SelectTrigger id="pos-dept"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-jt">{t("rh.posJobTitle")} *</Label>
                <Select value={form.jobTitleId} onValueChange={(v) => setField("jobTitleId", v)}>
                  <SelectTrigger id="pos-jt"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.jobTitles.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-branch">{t("rh.posBranch")}</Label>
                <Select value={form.branchId} onValueChange={(v) => setField("branchId", v)}>
                  <SelectTrigger id="pos-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-headcount">{t("rh.posHeadcount")}</Label>
                <Input id="pos-headcount" type="number" min={0} value={form.headcount} onChange={(e) => setField("headcount", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pos-desc">{t("rh.posDescription")}</Label>
                <Textarea id="pos-desc" rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
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
