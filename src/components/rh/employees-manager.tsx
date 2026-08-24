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
import type { EmployeeRow } from "@/features/rh/employees";
import type { RhOrgOptions } from "@/features/rh/config";

type Option = { id: string; code: string; name: string };
type UserOption = { id: string; username: string; fullName: string | null };
type Options = RhOrgOptions;

type FormState = {
  code: string;
  firstName: string;
  lastName: string;
  nameAr: string;
  email: string;
  phone: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  startDate: string;
  status: string;
  departmentId: string;
  positionId: string;
  jobTitleId: string;
  branchId: string;
  userId: string;
  address: string;
  cin: string;
  nss: string;
  bankAccount: string;
  iban: string;
  baseSalary: string;
  currency: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  firstName: "",
  lastName: "",
  nameAr: "",
  email: "",
  phone: "",
  gender: "",
  birthDate: "",
  hireDate: "",
  startDate: "",
  status: "ACTIVE",
  departmentId: "",
  positionId: "",
  jobTitleId: "",
  branchId: "",
  userId: "",
  address: "",
  cin: "",
  nss: "",
  bankAccount: "",
  iban: "",
  baseSalary: "",
  currency: "DZD",
  isActive: true,
};

const STATUS_KEYS: Record<string, string> = {
  ACTIVE: "statusActive",
  INACTIVE: "statusInactive",
  ON_LEAVE: "statusOnLeave",
  TERMINATED: "statusTerminated",
};

function toDateInput(d: string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function EmployeesManager({
  title,
  description,
  rows,
  options,
}: {
  title: string;
  description: string;
  rows: EmployeeRow[];
  options: Options;
}) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<EmployeeRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [branchFilter, setBranchFilter] = React.useState("ALL");
  const [deptFilter, setDeptFilter] = React.useState("ALL");

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: EmployeeRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      firstName: row.firstName,
      lastName: row.lastName,
      nameAr: row.nameAr ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      gender: row.gender ?? "",
      birthDate: toDateInput(row.birthDate),
      hireDate: toDateInput(row.hireDate),
      startDate: toDateInput(row.startDate),
      status: row.status,
      departmentId: row.departmentId ?? "",
      positionId: row.positionId ?? "",
      jobTitleId: row.jobTitleId ?? "",
      branchId: row.branchId ?? "",
      userId: row.userId ?? "",
      address: row.address ?? "",
      cin: row.cin ?? "",
      nss: row.nss ?? "",
      bankAccount: row.bankAccount ?? "",
      iban: row.iban ?? "",
      baseSalary: row.baseSalary ?? "",
      currency: row.currency,
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
        firstName: form.firstName,
        lastName: form.lastName,
        nameAr: form.nameAr,
        email: form.email,
        phone: form.phone,
        gender: form.gender,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
        hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        status: form.status,
        departmentId: form.departmentId,
        positionId: form.positionId,
        jobTitleId: form.jobTitleId,
        branchId: form.branchId,
        userId: form.userId,
        address: form.address,
        cin: form.cin,
        nss: form.nss,
        bankAccount: form.bankAccount,
        iban: form.iban,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : null,
        currency: form.currency,
        isActive: form.isActive,
      };
      const res = await fetch(`/api/rh/employees`, {
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

  const archive = async (row: EmployeeRow) => {
    if (!window.confirm(t("rh.archiveEmpConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rh/employees/${row.id}/archive`, { method: "POST" });
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
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchBranch = branchFilter === "ALL" || (r.branchId ?? "") === branchFilter;
    const matchDept = deptFilter === "ALL" || (r.departmentId ?? "") === deptFilter;
    return matchSearch && matchStatus && matchBranch && matchDept;
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
          {t("rh.addEmp")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Input
            placeholder={t("rh.firstName") + " / " + t("rh.empCode")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder={t("rh.empStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
              <SelectItem value="ACTIVE">{t("rh.statusActive")}</SelectItem>
              <SelectItem value="INACTIVE">{t("rh.statusInactive")}</SelectItem>
              <SelectItem value="ON_LEAVE">{t("rh.statusOnLeave")}</SelectItem>
              <SelectItem value="TERMINATED">{t("rh.statusTerminated")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger><SelectValue placeholder={t("rh.branch")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
              {options.branches.map((b: Option) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger><SelectValue placeholder={t("rh.department")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("common.all")}</SelectItem>
              {options.departments.map((d: Option) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rh.empCode")}</TableHead>
              <TableHead>{t("rh.firstName")}</TableHead>
              <TableHead>{t("rh.lastName")}</TableHead>
              <TableHead>{t("rh.department")}</TableHead>
              <TableHead>{t("rh.position")}</TableHead>
              <TableHead>{t("rh.empContracts")}</TableHead>
              <TableHead>{t("rh.empStatus")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t("rh.emptyEmp")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.firstName}</TableCell>
                  <TableCell>{row.lastName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.departmentName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.positionName ?? "—"}</TableCell>
                  <TableCell>
                    <a className="text-blue-600 hover:underline" href={`/rh/contracts?employeeId=${row.id}`}>
                      {row.contractCount}
                    </a>
                  </TableCell>
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
                        {t("rh.archiveEmp")}
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
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("rh.editEmp") : t("rh.addEmp")}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm font-medium text-muted-foreground">
              {t("rh.firstName")} · {t("rh.lastName")} · {t("rh.nameAr")}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="emp-code">{t("rh.empCode")} *</Label>
                <Input id="emp-code" value={form.code} onChange={(e) => setField("code", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-first">{t("rh.firstName")} *</Label>
                <Input id="emp-first" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-last">{t("rh.lastName")} *</Label>
                <Input id="emp-last" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-name-ar">{t("rh.nameAr")}</Label>
                <Input id="emp-name-ar" dir="rtl" value={form.nameAr} onChange={(e) => setField("nameAr", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-cin">{t("rh.cin")}</Label>
                <Input id="emp-cin" value={form.cin} onChange={(e) => setField("cin", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-nss">{t("rh.nss")}</Label>
                <Input id="emp-nss" value={form.nss} onChange={(e) => setField("nss", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-gender">{t("rh.gender")}</Label>
                <Select value={form.gender} onValueChange={(v) => setField("gender", v)}>
                  <SelectTrigger id="emp-gender"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-birth">{t("rh.birthDate")}</Label>
                <Input id="emp-birth" type="date" value={form.birthDate} onChange={(e) => setField("birthDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-phone">{t("rh.phone")}</Label>
                <Input id="emp-phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm font-medium text-muted-foreground">
              {t("rh.department")} · {t("rh.position")} · {t("rh.jobTitle")} · {t("rh.branch")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label>{t("rh.jobTitle")}</Label>
                <Select value={form.jobTitleId} onValueChange={(v) => setField("jobTitleId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.jobTitles.map((j: Option) => (
                      <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm font-medium text-muted-foreground">
              {t("rh.hireDate")} · {t("rh.startDate")} · {t("rh.empStatus")} · {t("rh.linkedUser")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emp-hire">{t("rh.hireDate")}</Label>
                <Input id="emp-hire" type="date" value={form.hireDate} onChange={(e) => setField("hireDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-start">{t("rh.startDate")}</Label>
                <Input id="emp-start" type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("rh.empStatus")}</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t("rh.statusActive")}</SelectItem>
                    <SelectItem value="INACTIVE">{t("rh.statusInactive")}</SelectItem>
                    <SelectItem value="ON_LEAVE">{t("rh.statusOnLeave")}</SelectItem>
                    <SelectItem value="TERMINATED">{t("rh.statusTerminated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("rh.linkedUser")}</Label>
                <Select value={form.userId} onValueChange={(v) => setField("userId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {options.users.map((u: UserOption) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName ?? u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm font-medium text-muted-foreground">
              {t("rh.baseSalary")} · {t("rh.currency")} · {t("rh.bankAccount")} · {t("rh.iban")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emp-salary">{t("rh.baseSalary")}</Label>
                <Input id="emp-salary" type="number" step="0.01" value={form.baseSalary} onChange={(e) => setField("baseSalary", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-currency">{t("rh.currency")}</Label>
                <Input id="emp-currency" value={form.currency} onChange={(e) => setField("currency", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-bank">{t("rh.bankAccount")}</Label>
                <Input id="emp-bank" value={form.bankAccount} onChange={(e) => setField("bankAccount", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-iban">{t("rh.iban")}</Label>
                <Input id="emp-iban" value={form.iban} onChange={(e) => setField("iban", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-address">{t("rh.address")}</Label>
              <Textarea id="emp-address" rows={2} value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={form.isActive} onCheckedChange={(v) => setField("isActive", Boolean(v))} />
              <span className="text-sm">{t("common.active")}</span>
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
