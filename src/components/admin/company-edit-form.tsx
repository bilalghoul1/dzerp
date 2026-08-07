"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyAdminDetail } from "@/features/company-admin/types";

type FormState = Record<string, string | boolean>;

function field(company: CompanyAdminDetail) {
  return (key: string): string =>
    (company as unknown as Record<string, string | null>)[key] ?? "";
}

export function CompanyEditForm({
  company,
  companyId,
}: {
  company: CompanyAdminDetail;
  companyId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const get = field(company);
  const [form, setForm] = React.useState<FormState>({
    name: get("name"),
    nameAr: get("nameAr"),
    commercialName: get("commercialName"),
    legalName: get("legalName"),
    legalForm: get("legalForm"),
    activity: get("activity"),
    secondaryActivity: get("secondaryActivity"),
    type: get("type"),
    capital: get("capital"),
    establishedAt: get("establishedAt")?.slice(0, 10) ?? "",
    expiryDate: get("expiryDate")?.slice(0, 10) ?? "",
    taxId: get("taxId"),
    rc: get("rc"),
    nis: get("nis"),
    ai: get("ai"),
    vatNumber: get("vatNumber"),
    address: get("address"),
    country: get("country"),
    wilaya: get("wilaya"),
    commune: get("commune"),
    postalCode: get("postalCode"),
    phone: get("phone"),
    mobile: get("mobile"),
    email: get("email"),
    website: get("website"),
    currency: get("currency") || "DZD",
    fiscalYear: company.fiscalYear?.toString() ?? "",
    language: get("language") || "fr",
    bank: get("bank"),
    bankAgency: get("bankAgency"),
    bankAccount: get("bankAccount"),
    rib: get("rib"),
    iban: get("iban"),
    swift: get("swift"),
    paymentTerms: get("paymentTerms"),
    notes: get("notes"),
    primaryColor: get("primaryColor"),
    secondaryColor: get("secondaryColor"),
    printFormat: get("printFormat") || "A4",
    qrEnabled: company.qrEnabled,
    printHeader: get("printHeader"),
    invoiceFooter: get("invoiceFooter"),
    emailFooter: get("emailFooter"),
  });
  const [busy, setBusy] = React.useState(false);

  const setField = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        nameAr: form.nameAr || null,
        commercialName: form.commercialName || null,
        legalName: form.legalName || null,
        legalForm: form.legalForm || null,
        activity: form.activity || null,
        secondaryActivity: form.secondaryActivity || null,
        type: form.type || null,
        capital: form.capital || null,
        establishedAt: form.establishedAt || null,
        expiryDate: form.expiryDate || null,
        taxId: form.taxId || null,
        rc: form.rc || null,
        nis: form.nis || null,
        ai: form.ai || null,
        vatNumber: form.vatNumber || null,
        address: form.address || null,
        country: form.country || null,
        wilaya: form.wilaya || null,
        commune: form.commune || null,
        postalCode: form.postalCode || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        email: form.email || null,
        website: form.website || null,
        currency: form.currency || "DZD",
        fiscalYear: form.fiscalYear ? Number(form.fiscalYear) : null,
        language: form.language || "fr",
        bank: form.bank || null,
        bankAgency: form.bankAgency || null,
        bankAccount: form.bankAccount || null,
        rib: form.rib || null,
        iban: form.iban || null,
        swift: form.swift || null,
        paymentTerms: form.paymentTerms || null,
        notes: form.notes || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
        printFormat: form.printFormat || "A4",
        qrEnabled: !!form.qrEnabled,
        printHeader: form.printHeader || null,
        invoiceFooter: form.invoiceFooter || null,
        emailFooter: form.emailFooter || null,
      };

      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.companyUpdated"));
      router.push(`/admin/companies/${companyId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tabGeneral")}</CardTitle>
          <CardDescription>{t("admin.generalDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t("parametres.companyName")} *`} htmlFor="edit-name">
              <Input
                id="edit-name"
                value={String(form.name)}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </Field>
            <Field label={t("parties.nameAr")} htmlFor="edit-name-ar">
              <Input
                id="edit-name-ar"
                dir="rtl"
                value={String(form.nameAr)}
                onChange={(e) => setField("nameAr", e.target.value)}
              />
            </Field>
            <Field label={t("admin.colLegalName")} htmlFor="edit-legal-name">
              <Input
                id="edit-legal-name"
                value={String(form.legalName)}
                onChange={(e) => setField("legalName", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.commercialName")} htmlFor="edit-commercial">
              <Input
                id="edit-commercial"
                value={String(form.commercialName)}
                onChange={(e) => setField("commercialName", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.legalForm")} htmlFor="edit-legal-form">
              <Input
                id="edit-legal-form"
                value={String(form.legalForm)}
                onChange={(e) => setField("legalForm", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.activity")} htmlFor="edit-activity">
              <Input
                id="edit-activity"
                value={String(form.activity)}
                onChange={(e) => setField("activity", e.target.value)}
              />
            </Field>
            <Field label={t("admin.secondaryActivity")} htmlFor="edit-secondary">
              <Input
                id="edit-secondary"
                value={String(form.secondaryActivity)}
                onChange={(e) => setField("secondaryActivity", e.target.value)}
              />
            </Field>
            <Field label={t("common.type")} htmlFor="edit-type">
              <Input
                id="edit-type"
                value={String(form.type)}
                onChange={(e) => setField("type", e.target.value)}
              />
            </Field>
            <Field label={t("admin.capital")} htmlFor="edit-capital">
              <Input
                id="edit-capital"
                value={String(form.capital)}
                onChange={(e) => setField("capital", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.defaultCurrency")} htmlFor="edit-currency">
              <Select
                value={String(form.currency)}
                onValueChange={(v) => setField("currency", v)}
              >
                <SelectTrigger id="edit-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DZD">DZD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("parametres.fiscalYear")} htmlFor="edit-fiscal-year">
              <Input
                id="edit-fiscal-year"
                type="number"
                value={String(form.fiscalYear)}
                onChange={(e) => setField("fiscalYear", e.target.value)}
              />
            </Field>
            <Field label={t("admin.language")} htmlFor="edit-language">
              <Select
                value={String(form.language)}
                onValueChange={(v) => setField("language", v)}
              >
                <SelectTrigger id="edit-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="edit-notes">{t("parties.notes")}</Label>
              <Textarea
                id="edit-notes"
                value={String(form.notes)}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tabLegal")}</CardTitle>
          <CardDescription>{t("admin.legalDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("parties.taxId")} htmlFor="edit-tax-id">
              <Input
                id="edit-tax-id"
                value={String(form.taxId)}
                onChange={(e) => setField("taxId", e.target.value)}
              />
            </Field>
            <Field label={t("parties.rc")} htmlFor="edit-rc">
              <Input
                id="edit-rc"
                value={String(form.rc)}
                onChange={(e) => setField("rc", e.target.value)}
              />
            </Field>
            <Field label={t("parties.nis")} htmlFor="edit-nis">
              <Input
                id="edit-nis"
                value={String(form.nis)}
                onChange={(e) => setField("nis", e.target.value)}
              />
            </Field>
            <Field label={t("parties.ai")} htmlFor="edit-ai">
              <Input
                id="edit-ai"
                value={String(form.ai)}
                onChange={(e) => setField("ai", e.target.value)}
              />
            </Field>
            <Field label={t("parties.vatNumber")} htmlFor="edit-vat">
              <Input
                id="edit-vat"
                value={String(form.vatNumber)}
                onChange={(e) => setField("vatNumber", e.target.value)}
              />
            </Field>
            <Field label={t("admin.establishedAt")} htmlFor="edit-established">
              <Input
                id="edit-established"
                type="date"
                value={String(form.establishedAt)}
                onChange={(e) => setField("establishedAt", e.target.value)}
              />
            </Field>
            <Field label={t("admin.expiryDate")} htmlFor="edit-expiry">
              <Input
                id="edit-expiry"
                type="date"
                value={String(form.expiryDate)}
                onChange={(e) => setField("expiryDate", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tabAddress")}</CardTitle>
          <CardDescription>{t("admin.addressDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("parties.address")} htmlFor="edit-address">
              <Input
                id="edit-address"
                value={String(form.address)}
                onChange={(e) => setField("address", e.target.value)}
              />
            </Field>
            <Field label={t("parties.country")} htmlFor="edit-country">
              <Input
                id="edit-country"
                value={String(form.country)}
                onChange={(e) => setField("country", e.target.value)}
              />
            </Field>
            <Field label={t("parties.wilaya")} htmlFor="edit-wilaya">
              <Input
                id="edit-wilaya"
                value={String(form.wilaya)}
                onChange={(e) => setField("wilaya", e.target.value)}
              />
            </Field>
            <Field label={t("parties.commune")} htmlFor="edit-commune">
              <Input
                id="edit-commune"
                value={String(form.commune)}
                onChange={(e) => setField("commune", e.target.value)}
              />
            </Field>
            <Field label={t("parties.postalCode")} htmlFor="edit-postal">
              <Input
                id="edit-postal"
                value={String(form.postalCode)}
                onChange={(e) => setField("postalCode", e.target.value)}
              />
            </Field>
            <Field label={t("parties.phone")} htmlFor="edit-phone">
              <Input
                id="edit-phone"
                value={String(form.phone)}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.mobile")} htmlFor="edit-mobile">
              <Input
                id="edit-mobile"
                value={String(form.mobile)}
                onChange={(e) => setField("mobile", e.target.value)}
              />
            </Field>
            <Field label={t("parties.email")} htmlFor="edit-email">
              <Input
                id="edit-email"
                type="email"
                value={String(form.email)}
                onChange={(e) => setField("email", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.website")} htmlFor="edit-website">
              <Input
                id="edit-website"
                value={String(form.website)}
                onChange={(e) => setField("website", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tabBanking")}</CardTitle>
          <CardDescription>{t("admin.bankingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("parametres.bank")} htmlFor="edit-bank">
              <Input
                id="edit-bank"
                value={String(form.bank)}
                onChange={(e) => setField("bank", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.bankAgency")} htmlFor="edit-bank-agency">
              <Input
                id="edit-bank-agency"
                value={String(form.bankAgency)}
                onChange={(e) => setField("bankAgency", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.bankAccount")} htmlFor="edit-bank-account">
              <Input
                id="edit-bank-account"
                value={String(form.bankAccount)}
                onChange={(e) => setField("bankAccount", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.rib")} htmlFor="edit-rib">
              <Input
                id="edit-rib"
                value={String(form.rib)}
                onChange={(e) => setField("rib", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.iban")} htmlFor="edit-iban">
              <Input
                id="edit-iban"
                value={String(form.iban)}
                onChange={(e) => setField("iban", e.target.value)}
              />
            </Field>
            <Field label={t("parametres.swift")} htmlFor="edit-swift">
              <Input
                id="edit-swift"
                value={String(form.swift)}
                onChange={(e) => setField("swift", e.target.value)}
              />
            </Field>
            <Field label={t("parties.paymentTerms")} htmlFor="edit-payment-terms">
              <Input
                id="edit-payment-terms"
                value={String(form.paymentTerms)}
                onChange={(e) => setField("paymentTerms", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tabPrinting")}</CardTitle>
          <CardDescription>{t("admin.printingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.printFormat")} htmlFor="edit-print-format">
              <Select
                value={String(form.printFormat)}
                onValueChange={(v) => setField("printFormat", v)}
              >
                <SelectTrigger id="edit-print-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="A5">A5</SelectItem>
                  <SelectItem value="THERMAL">THERMAL</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("admin.colorPrimary")} htmlFor="edit-primary-color">
              <Input
                id="edit-primary-color"
                value={String(form.primaryColor)}
                onChange={(e) => setField("primaryColor", e.target.value)}
              />
            </Field>
            <Field label={t("admin.colorSecondary")} htmlFor="edit-secondary-color">
              <Input
                id="edit-secondary-color"
                value={String(form.secondaryColor)}
                onChange={(e) => setField("secondaryColor", e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="edit-qr"
                checked={!!form.qrEnabled}
                onCheckedChange={(value) => setField("qrEnabled", value === true)}
              />
              <Label htmlFor="edit-qr">{t("admin.qrEnabled")}</Label>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="edit-print-header">{t("admin.printHeader")}</Label>
              <Textarea
                id="edit-print-header"
                value={String(form.printHeader)}
                onChange={(e) => setField("printHeader", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="edit-invoice-footer">{t("admin.invoiceFooter")}</Label>
              <Textarea
                id="edit-invoice-footer"
                value={String(form.invoiceFooter)}
                onChange={(e) => setField("invoiceFooter", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="edit-email-footer">{t("admin.emailFooter")}</Label>
              <Textarea
                id="edit-email-footer"
                value={String(form.emailFooter)}
                onChange={(e) => setField("emailFooter", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/admin/companies/${companyId}`)}
          disabled={busy}
        >
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
