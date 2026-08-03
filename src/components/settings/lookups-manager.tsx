"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LookupKind, LookupRow } from "@/features/lookups/config";

type WilayaRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
};

type CommuneRow = {
  id: string;
  code: string;
  wilayaCode: string;
  wilayaName: string;
  wilayaNameAr: string | null;
  name: string;
  nameAr: string | null;
  isActive: boolean;
};

type LookupForm = {
  code: string;
  name: string;
  nameAr: string;
  days: string;
  swift: string;
  isDefault: boolean;
};

const EMPTY_FORM: LookupForm = {
  code: "",
  name: "",
  nameAr: "",
  days: "",
  swift: "",
  isDefault: false,
};

const KIND_TABS: { value: LookupKind; labelKey: string }[] = [
  { value: "countries", labelKey: "lookups.countries" },
  { value: "legalForms", labelKey: "lookups.legalForms" },
  { value: "businessSectors", labelKey: "lookups.businessSectors" },
  { value: "paymentMethods", labelKey: "lookups.paymentMethods" },
  { value: "banks", labelKey: "lookups.banks" },
];

export function LookupsManager({
  lookups,
  wilayas,
  communes,
  description,
}: {
  lookups: Record<LookupKind, LookupRow[]>;
  wilayas: WilayaRow[];
  communes: CommuneRow[];
  description: string;
}) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = React.useState<
    LookupKind | "wilayas" | "communes"
  >("countries");
  const [rows, setRows] = React.useState<Record<LookupKind, LookupRow[]>>(
    lookups,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<LookupRow | null>(null);
  const [form, setForm] = React.useState<LookupForm>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [wilayaFilter, setWilayaFilter] = React.useState("");

  const isLookupTab =
    activeTab === "countries" ||
    activeTab === "legalForms" ||
    activeTab === "businessSectors" ||
    activeTab === "paymentMethods" ||
    activeTab === "banks";
  const activeKind = isLookupTab ? (activeTab as LookupKind) : null;

  const openCreate = () => {
    setEditingRow(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: LookupRow) => {
    setEditingRow(row);
    setForm({
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? "",
      days: row.days != null ? String(row.days) : "",
      swift: row.swift ?? "",
      isDefault: row.isDefault,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!activeKind) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        nameAr: form.nameAr || null,
      };
      if (!editingRow) {
        payload.code = form.code;
      }
      if (activeKind === "paymentMethods") {
        payload.days = form.days ? Number(form.days) : null;
      }
      if (activeKind === "banks") {
        payload.swift = form.swift || null;
      }
      if (activeKind === "countries") {
        payload.isDefault = form.isDefault;
      }

      const res = await fetch(
        editingRow
          ? `/api/lookups?type=${activeKind}&id=${editingRow.id}`
          : `/api/lookups?type=${activeKind}`,
        {
          method: editingRow ? "PATCH" : "POST",
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

  const toggleActive = async (row: LookupRow) => {
    if (!activeKind) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/lookups?type=${activeKind}&id=${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !row.isActive }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      toast.success(t("parametres.saveSuccess"));
      setRows((prev) => ({
        ...prev,
        [activeKind]: prev[activeKind].map((r) =>
          r.id === row.id ? { ...r, isActive: !r.isActive } : r,
        ),
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const setField = (field: keyof LookupForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const showArabic = locale === "ar";
  const displayName = (r: { name: string; nameAr: string | null }) =>
    showArabic && r.nameAr ? r.nameAr : r.name;

  const filteredCommunes =
    activeTab === "communes" && wilayaFilter
      ? communes.filter((c) => c.wilayaCode === wilayaFilter)
      : communes;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("lookups.title")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="flex-wrap h-auto">
            {KIND_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
            <TabsTrigger value="wilayas">{t("lookups.wilayas")}</TabsTrigger>
            <TabsTrigger value="communes">{t("lookups.communes")}</TabsTrigger>
          </TabsList>

          {KIND_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <div className="flex justify-end">
                <Button onClick={openCreate} disabled={busy}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    add
                  </span>
                  {t("lookups.add")}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("lookups.code")}</TableHead>
                    <TableHead>{t("lookups.name")}</TableHead>
                    {tab.value === "paymentMethods" ? (
                      <TableHead>{t("lookups.days")}</TableHead>
                    ) : null}
                    {tab.value === "banks" ? (
                      <TableHead>{t("lookups.swift")}</TableHead>
                    ) : null}
                    {tab.value === "countries" ? (
                      <TableHead>{t("lookups.default")}</TableHead>
                    ) : null}
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-end">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows[tab.value].length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        {t("lookups.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows[tab.value].map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.code}</TableCell>
                        <TableCell>
                          <p>{displayName(row)}</p>
                          {!showArabic && row.nameAr ? (
                            <p className="text-xs text-muted-foreground" dir="rtl">
                              {row.nameAr}
                            </p>
                          ) : null}
                        </TableCell>
                        {tab.value === "paymentMethods" ? (
                          <TableCell className="text-muted-foreground">
                            {row.days != null ? `${row.days} ${t("lookups.daysUnit")}` : "—"}
                          </TableCell>
                        ) : null}
                        {tab.value === "banks" ? (
                          <TableCell className="text-muted-foreground">
                            {row.swift ?? "—"}
                          </TableCell>
                        ) : null}
                        {tab.value === "countries" ? (
                          <TableCell>
                            {row.isDefault ? (
                              <Badge variant="success">{t("lookups.default")}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ) : null}
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
                              onClick={() => toggleActive(row)}
                              disabled={busy}
                            >
                              {row.isActive
                                ? t("lookups.deactivate")
                                : t("lookups.reactivate")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          ))}

          <TabsContent value="wilayas">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("lookups.code")}</TableHead>
                  <TableHead>{t("lookups.name")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wilayas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                      {t("lookups.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  wilayas.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.code}</TableCell>
                      <TableCell>
                        <p>{displayName(w)}</p>
                        {!showArabic ? (
                          <p className="text-xs text-muted-foreground" dir="rtl">
                            {w.nameAr}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.isActive ? "success" : "secondary"}>
                          {w.isActive ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="communes">
            <div className="mb-4 max-w-xs">
              <Label htmlFor="commune-wilaya-filter">{t("lookups.wilayaFilter")}</Label>
              <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
                <SelectTrigger id="commune-wilaya-filter">
                  <SelectValue placeholder={t("lookups.allWilayas")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("lookups.allWilayas")}</SelectItem>
                  {wilayas.map((w) => (
                    <SelectItem key={w.id} value={w.code}>
                      {w.code} · {displayName(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("lookups.code")}</TableHead>
                  <TableHead>{t("lookups.wilayaCol")}</TableHead>
                  <TableHead>{t("lookups.name")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommunes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {t("lookups.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCommunes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {displayName({ name: c.wilayaName, nameAr: c.wilayaNameAr })}
                      </TableCell>
                      <TableCell>
                        <p>{displayName(c)}</p>
                        {!showArabic && c.nameAr ? (
                          <p className="text-xs text-muted-foreground" dir="rtl">
                            {c.nameAr}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? "success" : "secondary"}>
                          {c.isActive ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? t("lookups.edit") : t("lookups.add")}
            </DialogTitle>
            <DialogDescription>{t("lookups.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {!editingRow ? (
              <div className="space-y-2">
                <Label htmlFor="lookup-code">{t("lookups.code")}</Label>
                <Input
                  id="lookup-code"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="lookup-name">{t("lookups.name")}</Label>
              <Input
                id="lookup-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookup-name-ar">{t("lookups.nameAr")}</Label>
              <Input
                id="lookup-name-ar"
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => setField("nameAr", e.target.value)}
              />
            </div>
            {activeKind === "paymentMethods" ? (
              <div className="space-y-2">
                <Label htmlFor="lookup-days">{t("lookups.days")}</Label>
                <Input
                  id="lookup-days"
                  type="number"
                  min={0}
                  value={form.days}
                  onChange={(e) => setField("days", e.target.value)}
                />
              </div>
            ) : null}
            {activeKind === "banks" ? (
              <div className="space-y-2">
                <Label htmlFor="lookup-swift">{t("lookups.swift")}</Label>
                <Input
                  id="lookup-swift"
                  value={form.swift}
                  onChange={(e) => setField("swift", e.target.value)}
                />
              </div>
            ) : null}
            {activeKind === "countries" ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lookup-default"
                  checked={form.isDefault}
                  onCheckedChange={(checked) =>
                    setField("isDefault", checked === true)
                  }
                />
                <Label htmlFor="lookup-default">{t("lookups.default")}</Label>
              </div>
            ) : null}
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
