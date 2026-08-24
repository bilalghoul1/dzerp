"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { ContractRow } from "@/features/rh/contracts";
import type { RhOrgOptions } from "@/features/rh/config";

type Option = { id: string; code: string; name: string };
type EmpOption = { id: string; code: string; name: string };
type Options = RhOrgOptions;

type FormState = {
  employeeId: string;
  contractType: string;
  startDate: string;
  endDate: string;
  positionId: string;
  departmentId: string;
  branchId: string;
  baseSalary: string;
  currency: string;
  workingHours: string;
  trialEndDate: string;
  documentRef: string;
  status: string;
  signedAt: string;
};

const EMPTY: FormState = {
  employeeId: "",
  contractType: "CDI",
  startDate: "",
  endDate: "",
  positionId: "",
  departmentId: "",
  branchId: "",
  baseSalary: "",
  currency: "DZD",
  workingHours: "40",
  trialEndDate: "",
  documentRef: "",
  status: "DRAFT",
  signedAt: "",
};

const STATUS_KEYS: Record<string, string> = {
  DRAFT: "statusDraft",
  ACTIVE: "statusActive",
  EXPIRED: "statusExpired",
  TERMINATED: "statusTerminated",
  ARCHIVED: "statusArchived",
};

export function ContractsManager({
  title,
  description,
  rows,
  options,
  employeeId,
}: {
  title: string;
  description: string;
  rows: ContractRow[];
  options: Options;
  employeeId?: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<ContractRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [empFilter, setEmpFilter] = React.useState(employeeId ?? "ALL");

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY, employeeId: employeeId ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (row: ContractRow) => {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      contractType: row.contractType,
      startDate: new Date(row.startDate).toISOString().slice(0, 10),
      endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : "",
      positionId: row.positionId ?? "",
      departmentId: row.departmentId ?? "",
      branchId: row.branchId ?? "",
      baseSalary: row.baseSalary,
      currency: row.currency,
      workingHours: row.workingHours != null ? String(row.workingHours) : "40",
      trialEndDate: row.trialEndDate ? new Date(row.trialEndDate).toISOString().slice(0, 10) : "",
      documentRef: row.documentRef ?? "",
      status: row.status,
      signedAt: row.signedAt ? new Date(row.signedAt).toISOString().slice(0, 10) : "",
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
        employeeId: form.employeeId,
        contractType: form.contractType,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        positionId: form.positionId,
        departmentId: form.departmentId,
        branchId: form.branchId,
        baseSalary: Number(form.baseSalary),
        currency: form.currency,
        workingHours: form.workingHours ? Number(form.workingHours) : 40,
        trialEndDate: form.trialEndDate ? new Date(form.trialEndDate).toISOString() : null,
        documentRef: form.documentRef,
        status: form.status,
        signedAt: form.signedAt ? new Date(form.signedAt).toISOString() : null,
      };
      const res = await fetch(`/api/rh/contracts`, {
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

  const archive = async (row: ContractRow) => {
    if (!window.confirm(t("rh.archiveContractConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rh/contracts/${row.id}/archive`, { method: "POST" });
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

  const filtered = items.filter((r) => {
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchEmp = empFilter === "ALL" || r.employeeId === empFilter;
    return matchStatus && matchEmp;
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          {t("rh.addContract")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select value={empFilter} onValueChange={setEmpFilter}>
            <SelectTrigger><SelectValue placeholder={t("rh.employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
              {options.employees.map((e: EmpOption) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder={t("rh.contractStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
              <SelectItem value="DRAFT">{t("rh.statusDraft")}</SelectItem>
              <SelectItem value="ACTIVE">{t("rh.statusActive")}</SelectItem>
              <SelectItem value="EXPIRED">{t("rh.statusExpired")}</SelectItem>
              <SelectItem value="TERMINATED">{t("rh.statusTerminated")}</SelectItem>
              <SelectItem value="ARCHIVED">{t("rh.statusArchived")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rh.employees")}</TableHead>
              <TableHead>{t("rh.contractType")}</TableHead>
              <TableHead>{t("rh.startDate")}</TableHead>
              <TableHead>{t("rh.endDate")}</TableHead>
              <TableHead>{t("rh.baseSalary")}</TableHead>
              <TableHead>{t("rh.contractStatus")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {t("rh.emptyContract")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.employeeName} <span className="text-muted-foreground">({row.employeeCode})</span></TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.contractType === "CDI" ? t("rh.cdi") : t("rh.cdd")}</Badge>
                  </TableCell>
                  <TableCell>{new Date(row.startDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">{row.endDate ? new Date(row.endDate).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{row.baseSalary} {row.currency}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "success" : "secondary"}>
                      {t(STATUS_KEYS[row.status] ?? "common.status")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)} disabled={busy}>
                        {t("common.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => archive(row)} disabled={busy}>
                        {t("rh.archiveContract")}
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
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("rh.editContract") : t("rh.addContract")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("rh.employees")} *</Label>
                <Select value={form.employeeId} onValueChange={(v) => setField("employeeId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.employees.map((e: EmpOption) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("rh.contractType")} *</Label>
                <Select value={form.contractType} onValueChange={(v) => setField("contractType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDI">{t("rh.cdi")}</SelectItem>
                    <SelectItem value="CDD">{t("rh.cdd")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-start">{t("rh.startDate")} *</Label>
                <Input id="c-start" type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-end">{t("rh.endDate")}</Label>
                <Input id="c-end" type="date" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rh.department")}</Label>
                <Select value={form.departmentId} onValueChange={(v) => setField("departmentId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.departments.map((d: Option) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("rh.position")}</Label>
                <Select value={form.positionId} onValueChange={(v) => setField("positionId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.positions.map((p: Option) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("rh.branch")}</Label>
                <Select value={form.branchId} onValueChange={(v) => setField("branchId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.branches.map((b: Option) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("rh.contractStatus")}</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">{t("rh.statusDraft")}</SelectItem>
                    <SelectItem value="ACTIVE">{t("rh.statusActive")}</SelectItem>
                    <SelectItem value="EXPIRED">{t("rh.statusExpired")}</SelectItem>
                    <SelectItem value="TERMINATED">{t("rh.statusTerminated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-salary">{t("rh.baseSalary")} *</Label>
                <Input id="c-salary" type="number" step="0.01" value={form.baseSalary} onChange={(e) => setField("baseSalary", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-currency">{t("rh.currency")}</Label>
                <Input id="c-currency" value={form.currency} onChange={(e) => setField("currency", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-hours">{t("rh.workingHours")}</Label>
                <Input id="c-hours" type="number" value={form.workingHours} onChange={(e) => setField("workingHours", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-trial">{t("rh.trialEndDate")}</Label>
                <Input id="c-trial" type="date" value={form.trialEndDate} onChange={(e) => setField("trialEndDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-signed">{t("rh.signedAt")}</Label>
                <Input id="c-signed" type="date" value={form.signedAt} onChange={(e) => setField("signedAt", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-doc">{t("rh.documentRef")}</Label>
                <Input id="c-doc" value={form.documentRef} onChange={(e) => setField("documentRef", e.target.value)} />
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
