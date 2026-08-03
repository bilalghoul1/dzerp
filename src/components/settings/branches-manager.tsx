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

export function BranchesManager({
  branches,
  description,
}: {
  branches: BranchRow[];
  description: string;
}) {
  const { t } = useI18n();
  const [rows, setRows] = React.useState<BranchRow[]>(branches);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BranchInput>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
    setDialogOpen(true);
  };

  const save = async () => {
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

  const toggleActive = async (branch: BranchRow) => {
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
    }
  };

  const setField = (field: keyof BranchInput, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
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
      <CardContent>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((branch) => (
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
                  <TableCell>{t(`parametres.type_${branch.type}`)}</TableCell>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branch-code">{t("parametres.branchCode")}</Label>
              <Input
                id="branch-code"
                value={form.code}
                disabled={!!editingId}
                onChange={(e) => setField("code", e.target.value)}
                required
              />
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
              <Label htmlFor="branch-name">{t("parametres.branchName")}</Label>
              <Input
                id="branch-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
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
              />
            </div>
            <div className="sm:col-span-2">
              <h4 className="mb-2 text-sm font-medium">
                {t("parametres.branchLegal")}
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Input
                    id="branch-wilaya"
                    value={form.wilaya}
                    onChange={(e) => setField("wilaya", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch-commune">{t("parametres.commune")}</Label>
                  <Input
                    id="branch-commune"
                    value={form.commune}
                    onChange={(e) => setField("commune", e.target.value)}
                  />
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
    </Card>
  );
}
