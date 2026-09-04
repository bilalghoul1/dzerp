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
import { EmptyState } from "@/components/feedback/empty-state";
import {
  CustomersIllustration,
  SuppliersIllustration,
} from "@/components/illustrations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BusinessPartnerRow } from "@/features/business-partners/types";

export type BusinessPartnerModuleKind = "customer" | "supplier";

type PartyType = "COMPANY" | "INDIVIDUAL";

type FormState = {
  name: string;
  nameAr: string;
  type: PartyType;
  firstName: string;
  lastName: string;
  legalName: string;
  commercialName: string;
  legalForm: string;
  activity: string;
  sector: string;
  email: string;
  phone: string;
  taxId: string;
  rc: string;
  nis: string;
  ai: string;
  vatNumber: string;
  address: string;
  wilaya: string;
  commune: string;
  postalCode: string;
  paymentTerms: string;
  creditLimit: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  nameAr: "",
  type: "COMPANY",
  firstName: "",
  lastName: "",
  legalName: "",
  commercialName: "",
  legalForm: "",
  activity: "",
  sector: "",
  email: "",
  phone: "",
  taxId: "",
  rc: "",
  nis: "",
  ai: "",
  vatNumber: "",
  address: "",
  wilaya: "",
  commune: "",
  postalCode: "",
  paymentTerms: "",
  creditLimit: "",
  notes: "",
};

const API_BY_KIND: Record<BusinessPartnerModuleKind, string> = {
  customer: "/api/customers",
  supplier: "/api/suppliers",
};

export function BusinessPartnersManager({
  kind,
  title,
  description,
  rows,
}: {
  kind: BusinessPartnerModuleKind;
  title?: string;
  description?: string;
  rows: BusinessPartnerRow[];
}) {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [items, setItems] = React.useState<BusinessPartnerRow[]>(rows);
  const [dialogOpen, setDialogOpen] = React.useState(
    // « Nouveau client/fournisseur » depuis la barre globale (+ Nouveau) :
    // le lien arrive avec ?create=1 et ouvre directement le formulaire.
    () => searchParams.get("create") === "1",
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const apiBase = API_BY_KIND[kind];

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: BusinessPartnerRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      nameAr: row.nameAr ?? "",
      type: row.type,
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      legalName: row.legalName ?? "",
      commercialName: row.commercialName ?? "",
      legalForm: row.legalForm ?? "",
      activity: row.activity ?? "",
      sector: row.sector ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      taxId: row.taxId ?? "",
      rc: row.rc ?? "",
      nis: row.nis ?? "",
      ai: row.ai ?? "",
      vatNumber: row.vatNumber ?? "",
      address: row.address ?? "",
      wilaya: row.wilaya ?? "",
      commune: row.commune ?? "",
      postalCode: row.postalCode ?? "",
      paymentTerms: row.paymentTerms ?? "",
      creditLimit: row.creditLimit === "0" ? "" : row.creditLimit,
      notes: row.notes ?? "",
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
    if (!form.name.trim()) {
      toast.error(t("parties.name") + " " + t("common.required"));
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        nameAr: form.nameAr,
        type: form.type,
        firstName: form.firstName,
        lastName: form.lastName,
        legalName: form.legalName,
        commercialName: form.commercialName,
        legalForm: form.legalForm,
        activity: form.activity,
        sector: form.sector,
        email: form.email,
        phone: form.phone,
        taxId: form.taxId,
        rc: form.rc,
        nis: form.nis,
        ai: form.ai,
        vatNumber: form.vatNumber,
        address: form.address,
        wilaya: form.wilaya,
        commune: form.commune,
        postalCode: form.postalCode,
        paymentTerms: form.paymentTerms,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : "",
        notes: form.notes,
      };

      const res = await fetch(
        editingId ? `${apiBase}?id=${editingId}` : apiBase,
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

  const remove = async (row: BusinessPartnerRow) => {
    if (!window.confirm(t("parties.deleteConfirm"))) return;
    setBusy(true);
    try {
      // Clients : suppression définitive qui cascade automatiquement tous les
      // documents et dépendances. Fournisseurs : suppression logique directe.
      const url = `${apiBase}?id=${row.id}${kind === "customer" ? "&permanent=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorMessage(json));
      }
      toast.success(
        t(kind === "customer" ? "parties.permanentDeleteSuccess" : "parties.deletedSoft"),
      );
      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const setField = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const showArabic = locale === "ar";

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-start">
        <div>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("parties.add")}
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("parties.code")}</TableHead>
              <TableHead>{t("parties.name")}</TableHead>
              <TableHead>{t("parties.type")}</TableHead>
              <TableHead>{t("parties.sector")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    illustration={
                      kind === "customer" ? (
                        <CustomersIllustration className="size-24" />
                      ) : (
                        <SuppliersIllustration className="size-24" />
                      )
                    }
                    icon={kind === "customer" ? "group" : "handshake"}
                    title={t("parties.empty")}
                    description={t(
                      kind === "customer"
                        ? "parties.emptyCustomerHint"
                        : "parties.emptySupplierHint",
                    )}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>
                    {kind === "customer" ? (
                      <a
                        href={`/crm/customers/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </a>
                    ) : (
                      <p className="font-medium">{row.name}</p>
                    )}
                    {row.nameAr && !showArabic ? (
                      <p className="text-xs text-muted-foreground" dir="rtl">
                        {row.nameAr}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {t(`parties.type_${row.type}`)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.sector ?? "—"}
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
                        {t("parties.delete")}
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
              {editingId ? t("parties.edit") : t("parties.add")}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("parties.sectionGeneral")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="party-name">{t("parties.name")} *</Label>
                  <Input
                    id="party-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-name-ar">{t("parties.nameAr")}</Label>
                  <Input
                    id="party-name-ar"
                    dir="rtl"
                    value={form.nameAr}
                    onChange={(e) => setField("nameAr", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-type">{t("parties.type")} *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setField("type", v as PartyType)}
                  >
                    <SelectTrigger id="party-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY">
                        {t("parties.type_COMPANY")}
                      </SelectItem>
                      <SelectItem value="INDIVIDUAL">
                        {t("parties.type_INDIVIDUAL")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="rounded-xl border">
              <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
                aria-controls="party-additional-details"
              >
                <span>{t("parties.sectionMore")}</span>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {showDetails ? "expand_less" : "expand_more"}
                </span>
              </Button>

              <div
                id="party-additional-details"
                className={
                  "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out " +
                  (showDetails ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0")
                }
              >
                <div className="space-y-6 px-4 pb-4">
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("parties.sectionGeneral")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="party-sector">{t("parties.sector")}</Label>
                        <Input
                          id="party-sector"
                          value={form.sector}
                          onChange={(e) => setField("sector", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-first-name">{t("parties.firstName")}</Label>
                        <Input
                          id="party-first-name"
                          value={form.firstName}
                          onChange={(e) => setField("firstName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-last-name">{t("parties.lastName")}</Label>
                        <Input
                          id="party-last-name"
                          value={form.lastName}
                          onChange={(e) => setField("lastName", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("parties.sectionLegal")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="party-legal-name">{t("parties.legalName")}</Label>
                        <Input
                          id="party-legal-name"
                          value={form.legalName}
                          onChange={(e) => setField("legalName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-commercial-name">{t("parties.commercialName")}</Label>
                        <Input
                          id="party-commercial-name"
                          value={form.commercialName}
                          onChange={(e) => setField("commercialName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-legal-form">{t("parties.legalForm")}</Label>
                        <Input
                          id="party-legal-form"
                          value={form.legalForm}
                          onChange={(e) => setField("legalForm", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-activity">{t("parties.activity")}</Label>
                        <Input
                          id="party-activity"
                          value={form.activity}
                          onChange={(e) => setField("activity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-taxid">{t("parties.taxId")}</Label>
                        <Input
                          id="party-taxid"
                          value={form.taxId}
                          onChange={(e) => setField("taxId", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-rc">{t("parties.rc")}</Label>
                        <Input
                          id="party-rc"
                          value={form.rc}
                          onChange={(e) => setField("rc", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-nis">{t("parties.nis")}</Label>
                        <Input
                          id="party-nis"
                          value={form.nis}
                          onChange={(e) => setField("nis", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-ai">{t("parties.ai")}</Label>
                        <Input
                          id="party-ai"
                          value={form.ai}
                          onChange={(e) => setField("ai", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-vat">{t("parties.vatNumber")}</Label>
                        <Input
                          id="party-vat"
                          value={form.vatNumber}
                          onChange={(e) => setField("vatNumber", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("parties.sectionAddress")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="party-address">{t("parties.address")}</Label>
                        <Input
                          id="party-address"
                          value={form.address}
                          onChange={(e) => setField("address", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-wilaya">{t("parties.wilaya")}</Label>
                        <Input
                          id="party-wilaya"
                          value={form.wilaya}
                          onChange={(e) => setField("wilaya", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-commune">{t("parties.commune")}</Label>
                        <Input
                          id="party-commune"
                          value={form.commune}
                          onChange={(e) => setField("commune", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-postal">{t("parties.postalCode")}</Label>
                        <Input
                          id="party-postal"
                          value={form.postalCode}
                          onChange={(e) => setField("postalCode", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("parties.sectionContacts")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="party-email">{t("parties.email")}</Label>
                        <Input
                          id="party-email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setField("email", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-phone">{t("parties.phone")}</Label>
                        <Input
                          id="party-phone"
                          value={form.phone}
                          onChange={(e) => setField("phone", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("parties.sectionTerms")}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="party-payment-terms">{t("parties.paymentTerms")}</Label>
                        <Input
                          id="party-payment-terms"
                          value={form.paymentTerms}
                          onChange={(e) => setField("paymentTerms", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="party-credit-limit">{t("parties.creditLimit")}</Label>
                        <Input
                          id="party-credit-limit"
                          type="number"
                          min={0}
                          value={form.creditLimit}
                          onChange={(e) => setField("creditLimit", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="party-notes">{t("parties.notes")}</Label>
                        <Textarea
                          id="party-notes"
                          rows={3}
                          value={form.notes}
                          onChange={(e) => setField("notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>
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
