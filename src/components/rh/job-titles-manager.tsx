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
import type { JobTitleRow } from "@/features/rh/config";

type FormState = {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  nameAr: "",
  description: "",
  isActive: true,
};

export function JobTitlesManager({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: JobTitleRow[];
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<JobTitleRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: JobTitleRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? "",
      description: row.description ?? "",
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
        isActive: form.isActive,
      };
      const res = await fetch(`/api/rh/job-titles`, {
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

  const archive = async (row: JobTitleRow) => {
    if (!window.confirm(t("rh.archiveJtConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rh/job-titles/${row.id}/archive`, { method: "POST" });
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
          {t("rh.addJt")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rh.jtCode")}</TableHead>
              <TableHead>{t("rh.jtName")}</TableHead>
              <TableHead>{t("rh.jtDescription")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("rh.emptyJt")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.description ?? "—"}</TableCell>
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
                        {t("rh.deleteJt")}
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
            <DialogTitle>{editingId ? t("rh.editJt") : t("rh.addJt")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jt-code">{t("rh.jtCode")} *</Label>
                <Input id="jt-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jt-name">{t("rh.jtName")} *</Label>
                <Input id="jt-name" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jt-name-ar">{t("rh.jtNameAr")}</Label>
                <Input id="jt-name-ar" dir="rtl" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="jt-desc">{t("rh.jtDescription")}</Label>
                <Textarea id="jt-desc" rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
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
