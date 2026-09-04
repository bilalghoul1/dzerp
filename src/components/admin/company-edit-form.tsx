"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CompanyAdminDetail } from "@/features/company-admin/types";

type Option = { value: string; label: string; labelAr?: string | null };
type WilayaOption = { value: string; label: string; labelAr?: string | null };
type CommuneOption = {
  wilayaCode: string;
  value: string;
  label: string;
  labelAr?: string | null;
};

type EditFormState = {
  name: string;
  nameAr: string;
  commercialName: string;
  legalName: string;
  legalForm: string;
  activity: string;
  secondaryActivity: string;
  type: string;
  capital: string;
  establishedAt: string;
  expiryDate: string;
  taxId: string;
  rc: string;
  nis: string;
  ai: string;
  vatNumber: string;
  address: string;
  postalCode: string;
  wilaya: string;
  commune: string;
  country: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  currency: string;
  fiscalYear: string;
  language: string;
  bank: string;
  bankAgency: string;
  bankAccount: string;
  rib: string;
  iban: string;
  swift: string;
  paymentTerms: string;
  notes: string;
  primaryColor: string;
  secondaryColor: string;
  invoiceFooter: string;
  emailFooter: string;
  printHeader: string;
  printFormat: string;
  printMargins: { top: number; right: number; bottom: number; left: number };
  qrEnabled: boolean;
};

function fromCompany(company: CompanyAdminDetail): EditFormState {
  return {
    name: company.name,
    nameAr: company.nameAr ?? "",
    commercialName: company.commercialName ?? "",
    legalName: company.legalName ?? "",
    legalForm: company.legalForm ?? "",
    activity: company.activity ?? "",
    secondaryActivity: company.secondaryActivity ?? "",
    type: company.type ?? "",
    capital: company.capital ?? "",
    establishedAt: company.establishedAt?.slice(0, 10) ?? "",
    expiryDate: company.expiryDate?.slice(0, 10) ?? "",
    taxId: company.taxId ?? "",
    rc: company.rc ?? "",
    nis: company.nis ?? "",
    ai: company.ai ?? "",
    vatNumber: company.vatNumber ?? "",
    address: company.address ?? "",
    postalCode: company.postalCode ?? "",
    wilaya: company.wilaya ?? "",
    commune: company.commune ?? "",
    country: company.country ?? "",
    phone: company.phone ?? "",
    mobile: company.mobile ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    currency: company.currency ?? "DZD",
    fiscalYear: company.fiscalYear?.toString() ?? "",
    language: company.language ?? "fr",
    bank: company.bank ?? "",
    bankAgency: company.bankAgency ?? "",
    bankAccount: company.bankAccount ?? "",
    rib: company.rib ?? "",
    iban: company.iban ?? "",
    swift: company.swift ?? "",
    paymentTerms: company.paymentTerms ?? "",
    notes: company.notes ?? "",
    primaryColor: company.primaryColor ?? "",
    secondaryColor: company.secondaryColor ?? "",
    invoiceFooter: company.invoiceFooter ?? "",
    emailFooter: company.emailFooter ?? "",
    printHeader: company.printHeader ?? "",
    printFormat: company.printFormat ?? "A4",
    printMargins: {
      top: company.printMargins?.top ?? 10,
      right: company.printMargins?.right ?? 10,
      bottom: company.printMargins?.bottom ?? 10,
      left: company.printMargins?.left ?? 10,
    },
    qrEnabled: company.qrEnabled,
  };
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {children}
      </CardContent>
    </Card>
  );
}

export function CompanyEditForm({
  company,
  currencies,
  countries,
  legalForms,
  banks,
  wilayas,
  communes,
}: {
  company: CompanyAdminDetail;
  currencies: Option[];
  countries: Option[];
  legalForms: Option[];
  banks: Option[];
  wilayas: WilayaOption[];
  communes: CommuneOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = React.useState<EditFormState>(() =>
    fromCompany(company),
  );
  const [saving, setSaving] = React.useState(false);

  const update = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const communeOptions =
    form.wilaya === "all" || !form.wilaya
      ? communes
      : communes.filter((c) => c.wilayaCode === form.wilaya);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t("admin.required"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || null,
        commercialName: form.commercialName.trim() || null,
        legalName: form.legalName.trim() || null,
        legalForm: form.legalForm || null,
        activity: form.activity.trim() || null,
        secondaryActivity: form.secondaryActivity.trim() || null,
        type: form.type.trim() || null,
        capital: form.capital.trim() || null,
        establishedAt: form.establishedAt || null,
        expiryDate: form.expiryDate || null,
        taxId: form.taxId.trim() || null,
        rc: form.rc.trim() || null,
        nis: form.nis.trim() || null,
        ai: form.ai.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        address: form.address.trim() || null,
        postalCode: form.postalCode.trim() || null,
        wilaya: form.wilaya || null,
        commune: form.commune || null,
        country: form.country || null,
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        currency: form.currency || "DZD",
        fiscalYear: form.fiscalYear ? Number(form.fiscalYear) : null,
        language: form.language || "fr",
        bank: form.bank || null,
        bankAgency: form.bankAgency.trim() || null,
        bankAccount: form.bankAccount.trim() || null,
        rib: form.rib.trim() || null,
        iban: form.iban.trim() || null,
        swift: form.swift.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        notes: form.notes.trim() || null,
        primaryColor: form.primaryColor.trim() || null,
        secondaryColor: form.secondaryColor.trim() || null,
        invoiceFooter: form.invoiceFooter.trim() || null,
        emailFooter: form.emailFooter.trim() || null,
        printHeader: form.printHeader.trim() || null,
        printFormat: form.printFormat || "A4",
        printMargins: form.printMargins,
        qrEnabled: form.qrEnabled,
      };

      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      toast.success(t("admin.updatedSuccess"));
      router.push(`/admin/companies/${company.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{company.code}</p>
          <h2 className="text-xl font-semibold">{t("admin.editCompany")}</h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/companies/${company.id}`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_back
            </span>
            {t("common.back")}
          </Link>
        </Button>
      </div>

      <Section title={t("admin.tabGeneral")}>
        <Field label={t("parametres.companyName")}>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <Field label={t("parties.nameAr")}>
          <Input
            value={form.nameAr}
            onChange={(e) => update("nameAr", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.legalName")}>
          <Input
            value={form.legalName}
            onChange={(e) => update("legalName", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.legalForm")}>
          <Select
            value={form.legalForm}
            onValueChange={(v) => update("legalForm", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {legalForms.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.activity")}>
          <Input
            value={form.activity}
            onChange={(e) => update("activity", e.target.value)}
          />
        </Field>
        <Field label={t("admin.secondaryActivity")}>
          <Input
            value={form.secondaryActivity}
            onChange={(e) => update("secondaryActivity", e.target.value)}
          />
        </Field>
        <Field label={t("admin.colType")}>
          <Input
            value={form.type}
            onChange={(e) => update("type", e.target.value)}
          />
        </Field>
        <Field label={t("admin.capital")}>
          <Input
            value={form.capital}
            onChange={(e) => update("capital", e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label={t("admin.establishedAt")}>
          <Input
            type="date"
            value={form.establishedAt}
            onChange={(e) => update("establishedAt", e.target.value)}
          />
        </Field>
        <Field label={t("admin.expiryDate")}>
          <Input
            type="date"
            value={form.expiryDate}
            onChange={(e) => update("expiryDate", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.defaultCurrency")}>
          <Select
            value={form.currency}
            onValueChange={(v) => update("currency", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("admin.language")}>
          <Select
            value={form.language}
            onValueChange={(v) => update("language", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.fiscalYear")}>
          <Input
            type="number"
            value={form.fiscalYear}
            onChange={(e) => update("fiscalYear", e.target.value)}
          />
        </Field>
        <Field label={t("parties.notes")} className="sm:col-span-2">
          <Textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("admin.tabLegal")}>
        <Field label={t("parties.taxId")}>
          <Input value={form.taxId} onChange={(e) => update("taxId", e.target.value)} />
        </Field>
        <Field label={t("parties.rc")}>
          <Input value={form.rc} onChange={(e) => update("rc", e.target.value)} />
        </Field>
        <Field label={t("parties.nis")}>
          <Input value={form.nis} onChange={(e) => update("nis", e.target.value)} />
        </Field>
        <Field label={t("parties.ai")}>
          <Input value={form.ai} onChange={(e) => update("ai", e.target.value)} />
        </Field>
        <Field label={t("parties.vatNumber")}>
          <Input
            value={form.vatNumber}
            onChange={(e) => update("vatNumber", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("admin.tabAddress")}>
        <Field label={t("parties.address")} className="sm:col-span-2">
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>
        <Field label={t("parties.postalCode")}>
          <Input
            value={form.postalCode}
            onChange={(e) => update("postalCode", e.target.value)}
          />
        </Field>
        <Field label={t("parties.wilaya")}>
          <Select
            value={form.wilaya}
            onValueChange={(v) => {
              update("wilaya", v);
              update("commune", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {wilayas.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parties.commune")}>
          <Select
            value={form.commune}
            onValueChange={(v) => update("commune", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {communeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parties.country")}>
          <Select
            value={form.country}
            onValueChange={(v) => update("country", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {countries.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.phone")}>
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </Field>
        <Field label={t("parametres.mobile")}>
          <Input value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
        </Field>
        <Field label={t("parties.email")}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.website")}>
          <Input
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("admin.tabBanking")}>
        <Field label={t("parametres.bank")}>
          <Select
            value={form.bank}
            onValueChange={(v) => update("bank", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.bankAgency")}>
          <Input
            value={form.bankAgency}
            onChange={(e) => update("bankAgency", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.bankAccount")}>
          <Input
            value={form.bankAccount}
            onChange={(e) => update("bankAccount", e.target.value)}
          />
        </Field>
        <Field label={t("parametres.rib")}>
          <Input value={form.rib} onChange={(e) => update("rib", e.target.value)} />
        </Field>
        <Field label={t("parametres.iban")}>
          <Input value={form.iban} onChange={(e) => update("iban", e.target.value)} />
        </Field>
        <Field label={t("parametres.swift")}>
          <Input value={form.swift} onChange={(e) => update("swift", e.target.value)} />
        </Field>
        <Field label={t("parties.paymentTerms")}>
          <Input
            value={form.paymentTerms}
            onChange={(e) => update("paymentTerms", e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t("admin.tabBranding")}>
        <Field label={t("admin.colorPrimary")}>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 cursor-pointer"
              value={form.primaryColor || "#000000"}
              onChange={(e) => update("primaryColor", e.target.value)}
            />
            <Input
              value={form.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              placeholder="#0F172A"
            />
          </div>
        </Field>
        <Field label={t("admin.colorSecondary")}>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 cursor-pointer"
              value={form.secondaryColor || "#000000"}
              onChange={(e) => update("secondaryColor", e.target.value)}
            />
            <Input
              value={form.secondaryColor}
              onChange={(e) => update("secondaryColor", e.target.value)}
              placeholder="#334155"
            />
          </div>
        </Field>
      </Section>

      <Section title={t("admin.tabPrinting")}>
        <Field label={t("admin.printFormat")}>
          <Select
            value={form.printFormat}
            onValueChange={(v) => update("printFormat", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="THERMAL">
                {t("parametres.printFormat_THERMAL")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("admin.qrEnabled")} className="sm:col-span-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch
              checked={form.qrEnabled}
              onCheckedChange={(v) => update("qrEnabled", v)}
              id="qr"
            />
            <div className="flex flex-col">
              <Label htmlFor="qr">{t("admin.qrEnabled")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("parametres.prefQrDescription")}
              </p>
            </div>
          </div>
        </Field>
        <Field label={t("admin.printMargins")} className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["top", "right", "bottom", "left"] as const).map((edge) => (
              <div key={edge} className="flex flex-col gap-1.5">
                <Label className="text-xs capitalize text-muted-foreground">
                  {edge}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.printMargins[edge]}
                  onChange={(e) =>
                    update("printMargins", {
                      ...form.printMargins,
                      [edge]: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Field>
        <Field label={t("admin.printHeader")} className="sm:col-span-2">
          <Textarea
            value={form.printHeader}
            onChange={(e) => update("printHeader", e.target.value)}
          />
        </Field>
        <Field label={t("admin.invoiceFooter")} className="sm:col-span-2">
          <Textarea
            value={form.invoiceFooter}
            onChange={(e) => update("invoiceFooter", e.target.value)}
          />
        </Field>
        <Field label={t("admin.emailFooter")} className="sm:col-span-2">
          <Textarea
            value={form.emailFooter}
            onChange={(e) => update("emailFooter", e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/companies/${company.id}`}>{t("common.cancel")}</Link>
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
