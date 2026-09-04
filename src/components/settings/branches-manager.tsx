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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type BranchRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  type: "HEADQUARTER" | "DIRECTION" | "AGENCY";
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  country: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  ai: string | null;
  isActive: boolean;
  createdAt: string;
};

type BranchInput = {
  code: string;
  name: string;
  nameAr: string;
  type: "HEADQUARTER" | "DIRECTION" | "AGENCY";
  city: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  country: string;
  wilaya: string;
  commune: string;
  postalCode: string;
  rc: string;
  nif: string;
  nis: string;
  ai: string;
};

type LookupOption = {
  code: string;
  name: string;
  nameAr: string | null;
  wilayaCode?: string;
};

const EMPTY_FORM: BranchInput = {
  code: "",
  name: "",
  nameAr: "",
  type: "DIRECTION",
  city: "",
  address: "",
  phone: "",
  email: "",
  manager: "",
  country: "",
  wilaya: "",
  commune: "",
  postalCode: "",
  rc: "",
  nif: "",
  nis: "",
  ai: "",
};

type FormErrors = Partial<Record<keyof BranchInput, string>>;

function validate(form: BranchInput, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!isEdit && !form.code.trim()) errors.code = "required";
  if (!form.name.trim()) errors.name = "required";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "invalid";
  }
  return errors;
}

export function BranchesManager({
  branches,
  description,
  wilayas,
  communes,
}: {
  branches: BranchRow[];
  description: string;
  wilayas: LookupOption[];
  communes: LookupOption[];
}) {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<BranchRow[]>(branches);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<BranchRow | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BranchInput>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [showLegal, setShowLegal] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.nameAr && b.nameAr.includes(search)),
      );
    }
    if (filterType !== "all") {
      list = list.filter((b) => b.type === filterType);
    }
    if (filterStatus === "active") list = list.filter((b) => b.isActive);
    if (filterStatus === "inactive") list = list.filter((b) => !b.isActive);
    return list;
  }, [rows, search, filterType, filterStatus]);

  const filteredCommunes = React.useMemo(() => {
    if (!form.wilaya) return communes;
    return communes.filter((c) => c.wilayaCode === form.wilaya);
  }, [communes, form.wilaya]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowLegal(false);
    setDialogOpen(true);
  };

  const openEdit = (branch: BranchRow) => {
    setEditingId(branch.id);
    setForm({
      code: branch.code,
      name: branch.name,
      nameAr: branch.nameAr ?? "",
      type: branch.type,
      city: branch.city ?? "",
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      manager: branch.manager ?? "",
      country: branch.country ?? "",
      wilaya: branch.wilaya ?? "",
      commune: branch.commune ?? "",
      postalCode: branch.postalCode ?? "",
      rc: branch.rc ?? "",
      nif: branch.nif ?? "",
      nis: branch.nis ?? "",
      ai: branch.ai ?? "",
    });
    setErrors({});
    setShowLegal(false);
    setDialogOpen(true);
  };

  const save = async () => {
    const validationErrors = validate(form, !editingId);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const payload = editingId
        ? (() => {
            const { code: _code, ...rest } = form;
            void _code;
            return rest;
          })()
        : form;
      const res = await fetch(
        editingId ? `/api/branches?id=${editingId}` : "/api/branches",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      const saved = json?.data ?? json;

      if (editingId) {
        setRows((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? { ...b, ...saved, createdAt: b.createdAt }
              : b,
          ),
        );
      } else {
        setRows((prev) => [
          {
            ...saved,
            isActive: saved.isActive ?? true,
            createdAt: saved.createdAt ?? new Date().toISOString(),
          } as BranchRow,
          ...prev,
        ]);
      }

      toast.success(t("parametres.saveSuccess"));
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (branch: BranchRow) => {
    if (branch.isActive) {
      setConfirmTarget(branch);
      setConfirmOpen(true);
      return;
    }
    await doToggleActive(branch);
  };

  const doToggleActive = async (branch: BranchRow) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/branches?id=${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !branch.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      toast.success(t("parametres.saveSuccess"));
      setRows((prev) =>
        prev.map((b) =>
          b.id === branch.id ? { ...b, isActive: !b.isActive } : b,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const setField = (field: keyof BranchInput, value: string) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "wilaya") {
        next.commune = "";
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const formatType = (type: string) => {
    if (type === "HEADQUARTER") return t("parametres.type_HEADQUARTER");
    if (type === "DIRECTION") return t("parametres.type_DIRECTION");
    if (type === "AGENCY") return t("parametres.type_AGENCY");
    return type;
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{t("parametres.branches")}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button onClick={openCreate} disabled={busy}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            {t("parametres.addBranch")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute start-2.5 top-1/2 -translate-y-1/2 text-[18px] text-muted-foreground" aria-hidden="true">
                search
              </span>
              <Input
                placeholder={t("common.search") + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t("common.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="HEADQUARTER">{t("parametres.type_HEADQUARTER")}</SelectItem>
                <SelectItem value="DIRECTION">{t("parametres.type_DIRECTION")}</SelectItem>
                <SelectItem value="AGENCY">{t("parametres.type_AGENCY")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="active">{t("common.active")}</SelectItem>
                <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("parametres.branchCode")}</TableHead>
                  <TableHead>{t("parametres.branchName")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("parametres.branchCity")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.code}</TableCell>
                      <TableCell>
                        <p>{branch.name}</p>
                        {branch.nameAr ? (
                          <p className="text-xs text-muted-foreground" dir="rtl">
                            {branch.nameAr}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatType(branch.type)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {branch.city ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.isActive ? "success" : "secondary"}>
                          {branch.isActive ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(branch)}
                            disabled={busy}
                          >
                            {t("common.edit")}
                          </Button>
                          {branch.type === "HEADQUARTER" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    {t("parametres.deactivateBranch")}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("parametres.headquarterProtected")}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(branch)}
                              disabled={busy}
                            >
                              {branch.isActive
                                ? t("parametres.deactivateBranch")
                                : t("parametres.reactivateBranch")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("common.noResults")}
              </p>
            ) : (
              filtered.map((branch) => (
                <Card key={branch.id} className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      {branch.nameAr ? (
                        <p className="text-xs text-muted-foreground" dir="rtl">
                          {branch.nameAr}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {branch.code} · {formatType(branch.type)}
                      </p>
                    </div>
                    <Badge variant={branch.isActive ? "success" : "secondary"}>
                      {branch.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </div>
                  {branch.city ? (
                    <p className="mb-2 text-xs text-muted-foreground">{branch.city}</p>
                  ) : null}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(branch)}
                      disabled={busy}
                    >
                      {t("common.edit")}
                    </Button>
                    {branch.type !== "HEADQUARTER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(branch)}
                        disabled={busy}
                      >
                        {branch.isActive
                          ? t("parametres.deactivateBranch")
                          : t("parametres.reactivateBranch")}
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId
                  ? t("parametres.editBranch")
                  : t("parametres.addBranch")}
              </DialogTitle>
              <DialogDescription>
                {t("parametres.branchesDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch-code">
                  {t("parametres.branchCode")} {!editingId && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="branch-code"
                  value={form.code}
                  disabled={!!editingId}
                  onChange={(e) => setField("code", e.target.value)}
                  aria-invalid={!!errors.code}
                />
                {errors.code && (
                  <p className="text-xs text-destructive">{t("common.required")}</p>
                )}
                {!editingId && (
                  <p className="text-xs text-muted-foreground">
                    {t("parametres.codeHint")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-type">{t("common.type")}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setField(
                      "type",
                      v as "HEADQUARTER" | "DIRECTION" | "AGENCY",
                    )
                  }
                >
                  <SelectTrigger id="branch-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEADQUARTER">
                      {t("parametres.type_HEADQUARTER")}
                    </SelectItem>
                    <SelectItem value="DIRECTION">
                      {t("parametres.type_DIRECTION")}
                    </SelectItem>
                    <SelectItem value="AGENCY">
                      {t("parametres.type_AGENCY")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-name">
                  {t("parametres.branchName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="branch-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{t("common.required")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-name-ar">{t("parametres.branchNameAr")}</Label>
                <Input
                  id="branch-name-ar"
                  dir="rtl"
                  value={form.nameAr}
                  onChange={(e) => setField("nameAr", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-city">{t("parametres.branchCity")}</Label>
                <Input
                  id="branch-city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-phone">{t("parametres.phone")}</Label>
                <Input
                  id="branch-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="branch-address">{t("parametres.address")}</Label>
                <Input
                  id="branch-address"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="branch-email">{t("parametres.email")}</Label>
                <Input
                  id="branch-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{t("parametres.invalidEmail")}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowLegal((v) => !v)}
                  className="flex w-full items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    className="material-symbols-outlined text-[16px] transition-transform"
                    style={{ transform: showLegal ? "rotate(90deg)" : undefined }}
                    aria-hidden="true"
                  >
                    chevron_right
                  </span>
                  {t("parametres.legalAndTax")}
                </button>
                {showLegal ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="branch-manager">{t("parametres.manager")}</Label>
                      <Input
                        id="branch-manager"
                        value={form.manager}
                        onChange={(e) => setField("manager", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-country">{t("parametres.country")}</Label>
                      <Input
                        id="branch-country"
                        value={form.country}
                        onChange={(e) => setField("country", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-wilaya">{t("parametres.wilaya")}</Label>
                      <Select
                        value={form.wilaya}
                        onValueChange={(v) => setField("wilaya", v)}
                      >
                        <SelectTrigger id="branch-wilaya">
                          <SelectValue placeholder={t("parametres.wilaya")} />
                        </SelectTrigger>
                        <SelectContent>
                          {wilayas.map((w) => (
                            <SelectItem key={w.code} value={w.code}>
                              {w.code} — {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-commune">{t("parametres.commune")}</Label>
                      <Select
                        value={form.commune}
                        onValueChange={(v) => setField("commune", v)}
                        disabled={!form.wilaya}
                      >
                        <SelectTrigger id="branch-commune">
                          <SelectValue placeholder={form.wilaya ? t("parametres.commune") : t("parametres.selectWilayaFirst")} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCommunes.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-postal">{t("parametres.postalCode")}</Label>
                      <Input
                        id="branch-postal"
                        value={form.postalCode}
                        onChange={(e) => setField("postalCode", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-rc">{t("parametres.rc")}</Label>
                      <Input
                        id="branch-rc"
                        value={form.rc}
                        onChange={(e) => setField("rc", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-nif">{t("parametres.nif")}</Label>
                      <Input
                        id="branch-nif"
                        value={form.nif}
                        onChange={(e) => setField("nif", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-nis">{t("parametres.nis")}</Label>
                      <Input
                        id="branch-nis"
                        value={form.nis}
                        onChange={(e) => setField("nis", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-ai">{t("parametres.ai")}</Label>
                      <Input
                        id="branch-ai"
                        value={form.ai}
                        onChange={(e) => setField("ai", e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
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

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("parametres.deactivateBranch")}</DialogTitle>
              <DialogDescription>
                {t("parametres.deactivateBranchConfirm", { name: confirmTarget?.name ?? "" })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setConfirmOpen(false); setConfirmTarget(null); }}
                disabled={busy}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => confirmTarget && doToggleActive(confirmTarget)}
                disabled={busy}
              >
                {t("parametres.deactivateBranch")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </TooltipProvider>
  );
}
