"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { DEFAULT_SERIES } from "@/features/company-admin/defaults";
import { cn } from "@/lib/utils";
import type { DocType } from "@/generated/prisma/enums";

type Option = { value: string; label: string; labelAr?: string | null };
type LookupOption = { value: string; label: string; labelAr?: string | null };

type SeriesRow = {
  docType: DocType;
  prefix: string;
  separator: string;
  suffix: string;
  withYear: boolean;
  padLength: number;
  step: number;
  nextValue: number;
};

type BranchRow = {
  code: string;
  name: string;
  nameAr: string;
  type: "HEADQUARTER" | "DIRECTION" | "AGENCY";
  city: string;
  phone: string;
  email: string;
  manager: string;
};

type MemberRow = {
  userId: string;
  roleId: string;
  defaultBranchCode: string;
};

type OwnerRow = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

type WizardForm = {
  code: string;
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
  country: string;
  wilaya: string;
  commune: string;
  postalCode: string;
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
  qrEnabled: boolean;
  printMargins: { top: number; right: number; bottom: number; left: number };
  series: SeriesRow[];
  branches: BranchRow[];
  members: MemberRow[];
  owner: OwnerRow;
  defaultBranchCode: string;
};

function defaultForm(): WizardForm {
  return {
    code: "",
    name: "",
    nameAr: "",
    commercialName: "",
    legalName: "",
    legalForm: "",
    activity: "",
    secondaryActivity: "",
    type: "",
    capital: "",
    establishedAt: "",
    expiryDate: "",
    taxId: "",
    rc: "",
    nis: "",
    ai: "",
    vatNumber: "",
    address: "",
    country: "",
    wilaya: "",
    commune: "",
    postalCode: "",
    phone: "",
    mobile: "",
    email: "",
    website: "",
    currency: "DZD",
    fiscalYear: "",
    language: "fr",
    bank: "",
    bankAgency: "",
    bankAccount: "",
    rib: "",
    iban: "",
    swift: "",
    paymentTerms: "",
    notes: "",
    primaryColor: "",
    secondaryColor: "",
    invoiceFooter: "",
    emailFooter: "",
    printHeader: "",
    printFormat: "A4",
    qrEnabled: false,
    printMargins: { top: 10, right: 10, bottom: 10, left: 10 },
    series: DEFAULT_SERIES.map((s) => ({
      docType: s.docType,
      prefix: s.prefix,
      separator: "-",
      suffix: "",
      withYear: s.withYear,
      padLength: s.padLength,
      step: 1,
      nextValue: 1,
    })),
    branches: [
      {
        code: "HQ",
        name: "Siège Social",
        nameAr: "المقر الرئيسي",
        type: "HEADQUARTER",
        city: "",
        phone: "",
        email: "",
        manager: "",
      },
    ],
    members: [],
    owner: {
      fullName: "",
      username: "",
      email: "",
      password: "",
    },
    defaultBranchCode: "HQ",
  };
}

function mergeDraft(base: WizardForm, draft: unknown): WizardForm {
  if (!draft || typeof draft !== "object") return base;
  const data = draft as Partial<WizardForm>;
  const merged: WizardForm = { ...base, ...data };
  merged.printMargins = {
    ...base.printMargins,
    ...(data.printMargins ?? {}),
  };
  if (!Array.isArray(data.series) || data.series.length === 0) {
    merged.series = base.series;
  }
  if (!Array.isArray(data.branches) || data.branches.length === 0) {
    merged.branches = base.branches;
  }
  if (!Array.isArray(data.members)) {
    merged.members = [];
  }
  merged.owner = {
    fullName: data.owner?.fullName ?? "",
    username: data.owner?.username ?? "",
    email: data.owner?.email ?? "",
    password: data.owner?.password ?? "",
  };
  return merged;
}

const STEPS = [
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
  "step7",
  "step8",
  "step9",
] as const;

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

export function CompanyWizard({
  initialDraft,
  currencies,
  countries,
  legalForms,
  banks,
  wilayas,
  communes,
  users,
  roles,
}: {
  initialDraft: { step: number; data: unknown } | null;
  currencies: Option[];
  countries: Option[];
  legalForms: LookupOption[];
  banks: Option[];
  wilayas: { value: string; label: string; labelAr?: string | null }[];
  communes: { wilayaCode: string; value: string; label: string; labelAr?: string | null }[];
  users: { id: string; username: string; fullName: string | null; email: string | null }[];
  roles: { id: string; key: string; name: string; nameAr: string | null }[];
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [form, setForm] = React.useState<WizardForm>(() =>
    mergeDraft(defaultForm(), initialDraft?.data),
  );
  const [step, setStep] = React.useState(
    Math.min(Math.max(initialDraft?.step ?? 0, 0), 8),
  );
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState<{
    id: string;
    code: string;
    name: string;
    owner: { username: string; temporaryPassword: string } | null;
  } | null>(null);

  const update = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateSeries = (index: number, patch: Partial<SeriesRow>) => {
    setForm((prev) => ({
      ...prev,
      series: prev.series.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    setDirty(true);
  };

  const updateBranch = (index: number, patch: Partial<BranchRow>) => {
    setForm((prev) => ({
      ...prev,
      branches: prev.branches.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    setDirty(true);
  };

  const communeOptions =
    form.wilaya === "all" || !form.wilaya
      ? communes
      : communes.filter((c) => c.wilayaCode === form.wilaya);

  const saveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/companies/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, data: form }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setDirty(false);
      toast.success(t("admin.draftSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = async () => {
    if (!window.confirm(t("admin.discardDraft"))) return;
    try {
      await fetch("/api/admin/companies/draft", { method: "DELETE" });
      setForm(defaultForm());
      setStep(0);
      setDirty(false);
      toast.success(t("admin.draftCleared"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(t("admin.required"));
      return;
    }
    setCreating(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
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
        invoiceFooter: form.invoiceFooter || null,
        emailFooter: form.emailFooter || null,
        printHeader: form.printHeader || null,
        printFormat: form.printFormat || "A4",
        printMargins: form.printMargins,
        qrEnabled: form.qrEnabled,
        defaultBranchCode: form.defaultBranchCode || null,
        series: form.series.map((s) => ({
          docType: s.docType,
          prefix: s.prefix || undefined,
          separator: s.separator || undefined,
          suffix: s.suffix || undefined,
          withYear: s.withYear,
          padLength: s.padLength,
          step: s.step,
          nextValue: s.nextValue,
        })),
        branches: form.branches
          .filter((b) => b.code.trim() && b.name.trim())
          .map((b) => ({
            code: b.code,
            name: b.name,
            nameAr: b.nameAr || null,
            type: b.type,
            city: b.city || null,
            phone: b.phone || null,
            email: b.email || null,
            manager: b.manager || null,
          })),
        members: form.members.map((m) => ({
          userId: m.userId,
          roleId: m.roleId,
          defaultBranchCode: m.defaultBranchCode || null,
        })),
        owner:
          form.owner.fullName.trim() && form.owner.username.trim() && form.owner.password
            ? {
                fullName: form.owner.fullName.trim(),
                username: form.owner.username.trim(),
                email: form.owner.email.trim() || null,
                password: form.owner.password,
              }
            : null,
      };

      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      await fetch("/api/admin/companies/draft", { method: "DELETE" }).catch(
        () => null,
      );
      setCreated({
        id: json.data.company.id,
        code: json.data.company.code,
        name: json.data.company.name,
        owner: json.data.owner ?? null,
      });
      await router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  const addMember = (userId: string, roleId: string) => {
    if (!userId || !roleId) return;
    if (form.members.some((m) => m.userId === userId)) {
      toast.error(t("admin.memberExists"));
      return;
    }
    update("members", [
      ...form.members,
      { userId, roleId, defaultBranchCode: form.defaultBranchCode || "" },
    ]);
  };

  if (created) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.creationSuccess")}</CardTitle>
          <CardDescription>
            {created.code} · {created.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created.owner ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-2 font-medium">
                <span className="material-symbols-outlined align-middle text-[18px]" aria-hidden="true">
                  key
                </span>{" "}
                {t("admin.ownerCredentials")}
              </p>
              <p>
                {t("auth.username")} : <strong>{created.owner.username}</strong>
              </p>
              <p>
                {t("admin.ownerPassword")} :{" "}
                <strong>{created.owner.temporaryPassword}</strong>
              </p>
              <p className="mt-2 text-amber-700">
                {t("admin.ownerPasswordOnce")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("admin.noOwnerCreated")}
            </p>
          )}
          <Button onClick={() => router.push(`/admin/companies/${created.id}`)}>
            {t("admin.viewCompany")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-56 shrink-0">
        <nav
          aria-label={t("admin.wizardSubtitle")}
          className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
        >
          {STEPS.map((key, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "text-muted-foreground hover:bg-accent"
                      : "text-muted-foreground/70 hover:bg-accent",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    active
                      ? "border-primary-foreground/30"
                      : done
                        ? "border-transparent bg-success/20 text-success"
                        : "border-border",
                  )}
                >
                  {done ? "✓" : index + 1}
                </span>
                {t(`admin.${key}`)}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{t(`admin.${STEPS[step]}`)}</CardTitle>
              <CardDescription>
                {t(
                  `admin.${
                    [
                      "generalDescription",
                      "legalDescription",
                      "addressDescription",
                      "bankingDescription",
                      "brandingDescription",
                      "printingDescription",
                      "numberingDescription",
                      "branchesDescription",
                      "usersTabHint",
                    ][step]
                  }` as "admin.generalDescription",
                )}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={saveDraft}
              disabled={saving || !dirty}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                save
              </span>
              {saving ? t("common.saving") : t("admin.saveDraft")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("admin.colCode")} hint={t("admin.codePlaceholder")}>
                  <Input
                    value={form.code}
                    onChange={(e) => update("code", e.target.value)}
                    placeholder={t("admin.codePlaceholder")}
                  />
                </Field>
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
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("parties.taxId")}>
                  <Input
                    value={form.taxId}
                    onChange={(e) => update("taxId", e.target.value)}
                  />
                </Field>
                <Field label={t("parties.rc")}>
                  <Input
                    value={form.rc}
                    onChange={(e) => update("rc", e.target.value)}
                  />
                </Field>
                <Field label={t("parties.nis")}>
                  <Input
                    value={form.nis}
                    onChange={(e) => update("nis", e.target.value)}
                  />
                </Field>
                <Field label={t("parties.ai")}>
                  <Input
                    value={form.ai}
                    onChange={(e) => update("ai", e.target.value)}
                  />
                </Field>
                <Field label={t("parties.vatNumber")}>
                  <Input
                    value={form.vatNumber}
                    onChange={(e) => update("vatNumber", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </Field>
                <Field label={t("parametres.mobile")}>
                  <Input
                    value={form.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                  />
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
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <Input
                    value={form.rib}
                    onChange={(e) => update("rib", e.target.value)}
                  />
                </Field>
                <Field label={t("parametres.iban")}>
                  <Input
                    value={form.iban}
                    onChange={(e) => update("iban", e.target.value)}
                  />
                </Field>
                <Field label={t("parametres.swift")}>
                  <Input
                    value={form.swift}
                    onChange={(e) => update("swift", e.target.value)}
                  />
                </Field>
                <Field label={t("parties.paymentTerms")}>
                  <Input
                    value={form.paymentTerms}
                    onChange={(e) => update("paymentTerms", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid gap-4 sm:grid-cols-2">
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
                <Field label={t("admin.printHeader")}>
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
                <Field label={t("admin.printMargins")} className="sm:col-span-2">
                  <div className="grid grid-cols-4 gap-3">
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
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs font-medium text-muted-foreground sm:grid-cols-8">
                  <div className="sm:col-span-2">{t("parametres.seriesDoc")}</div>
                  <div>{t("parametres.seriesPrefix")}</div>
                  <div>{t("parametres.seriesSeparator")}</div>
                  <div>{t("parametres.seriesSuffix")}</div>
                  <div>{t("parametres.seriesYear")}</div>
                  <div>{t("parametres.seriesPad")}</div>
                  <div>{t("parametres.seriesNext")}</div>
                </div>
                <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
                  {form.series.map((row, index) => (
                    <div
                      key={row.docType}
                      className="grid grid-cols-2 items-center gap-3 rounded-md border p-2 sm:grid-cols-8"
                    >
                      <p className="text-sm font-medium sm:col-span-2">
                        {t(`docTypes.${row.docType}` as "docTypes.QUOTATION")}
                      </p>
                      <Input
                        value={row.prefix}
                        onChange={(e) =>
                          updateSeries(index, { prefix: e.target.value })
                        }
                        aria-label={t("parametres.seriesPrefix")}
                      />
                      <Input
                        value={row.separator}
                        onChange={(e) =>
                          updateSeries(index, { separator: e.target.value })
                        }
                        aria-label={t("parametres.seriesSeparator")}
                      />
                      <Input
                        value={row.suffix}
                        onChange={(e) =>
                          updateSeries(index, { suffix: e.target.value })
                        }
                        aria-label={t("parametres.seriesSuffix")}
                      />
                      <Switch
                        checked={row.withYear}
                        onCheckedChange={(v) =>
                          updateSeries(index, { withYear: v })
                        }
                        aria-label={t("parametres.seriesYear")}
                      />
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={row.padLength}
                        onChange={(e) =>
                          updateSeries(index, {
                            padLength: Math.min(
                              12,
                              Math.max(1, Number(e.target.value) || 1),
                            ),
                          })
                        }
                        aria-label={t("parametres.seriesPad")}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={row.nextValue}
                        onChange={(e) =>
                          updateSeries(index, {
                            nextValue: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        aria-label={t("parametres.seriesNext")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 7 ? (
              <div className="space-y-3">
                {form.branches.map((branch, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <Field label={t("parametres.branchCode")}>
                      <Input
                        value={branch.code}
                        onChange={(e) =>
                          updateBranch(index, { code: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parametres.branchName")}>
                      <Input
                        value={branch.name}
                        onChange={(e) =>
                          updateBranch(index, { name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parametres.branchNameAr")}>
                      <Input
                        value={branch.nameAr}
                        onChange={(e) =>
                          updateBranch(index, { nameAr: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parametres.branchType")}>
                      <Select
                        value={branch.type}
                        onValueChange={(v) =>
                          updateBranch(index, {
                            type: v as BranchRow["type"],
                          })
                        }
                      >
                        <SelectTrigger>
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
                    </Field>
                    <Field label={t("parametres.branchCity")}>
                      <Input
                        value={branch.city}
                        onChange={(e) =>
                          updateBranch(index, { city: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parties.phone")}>
                      <Input
                        value={branch.phone}
                        onChange={(e) =>
                          updateBranch(index, { phone: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parties.email")}>
                      <Input
                        type="email"
                        value={branch.email}
                        onChange={(e) =>
                          updateBranch(index, { email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("parametres.manager")}>
                      <Input
                        value={branch.manager}
                        onChange={(e) =>
                          updateBranch(index, { manager: e.target.value })
                        }
                      />
                    </Field>
                    <div className="flex items-end sm:col-span-2 lg:col-span-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        disabled={form.branches.length <= 1}
                        onClick={() => {
                          if (form.branches.length <= 1) return;
                          setForm((prev) => ({
                            ...prev,
                            branches: prev.branches.filter(
                              (_, i) => i !== index,
                            ),
                          }));
                          setDirty(true);
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      branches: [
                        ...prev.branches,
                        {
                          code: "",
                          name: "",
                          nameAr: "",
                          type: "DIRECTION",
                          city: "",
                          phone: "",
                          email: "",
                          manager: "",
                        },
                      ],
                    }))
                  }
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    add
                  </span>
                  {t("parametres.addBranch")}
                </Button>
                <Field label={t("admin.defaultBranch")}>
                  <Select
                    value={form.defaultBranchCode}
                    onValueChange={(v) => update("defaultBranchCode", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {form.branches.map((branch, index) => (
                        <SelectItem key={index} value={branch.code}>
                          {branch.code || branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}

            {step === 8 ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("admin.ownerTitle")}
                    </CardTitle>
                    <CardDescription>{t("admin.ownerHint")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("profile.fullName")}>
                        <Input
                          value={form.owner.fullName}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              owner: { ...prev.owner, fullName: e.target.value },
                            }))
                          }
                          placeholder="Ali Benali"
                        />
                      </Field>
                      <Field label={t("auth.username")}>
                        <Input
                          value={form.owner.username}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              owner: { ...prev.owner, username: e.target.value },
                            }))
                          }
                          placeholder="ali.benali"
                        />
                      </Field>
                      <Field label={t("profile.email")}>
                        <Input
                          type="email"
                          value={form.owner.email}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              owner: { ...prev.owner, email: e.target.value },
                            }))
                          }
                          placeholder="ali@entreprise.dz"
                        />
                      </Field>
                      <Field label={t("admin.ownerPassword")}>
                        <Input
                          type="password"
                          value={form.owner.password}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              owner: { ...prev.owner, password: e.target.value },
                            }))
                          }
                          placeholder="••••••••"
                          minLength={8}
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {form.owner.fullName.trim() && form.owner.username.trim() && form.owner.password
                        ? t("admin.ownerWillBeCreated")
                        : t("admin.ownerOptional")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("admin.members")}
                    </CardTitle>
                    <CardDescription>{t("admin.usersTabHint")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-sm">{t("admin.addMember")}</Label>
                        <MemberPicker
                          users={users}
                          roles={roles}
                          form={form}
                          onAdd={addMember}
                        />
                      </div>
                    </div>
                    {form.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("admin.noMembers")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("search.users")}</TableHead>
                            <TableHead>{t("admin.assignRole")}</TableHead>
                            <TableHead>{t("admin.defaultBranchForUser")}</TableHead>
                            <TableHead className="w-10 text-end">
                              {t("common.actions")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.members.map((member, index) => {
                            const user = users.find(
                              (u) => u.id === member.userId,
                            );
                            return (
                              <TableRow key={member.userId}>
                                <TableCell>
                                  <p className="font-medium">
                                    {user?.fullName || user?.username || member.userId}
                                  </p>
                                  {user?.email ? (
                                    <p className="text-xs text-muted-foreground">
                                      {user.email}
                                    </p>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  {roles.find((r) => r.id === member.roleId)?.name ?? "—"}
                                </TableCell>
                                <TableCell>{member.defaultBranchCode || "—"}</TableCell>
                                <TableCell className="text-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() =>
                                      setForm((prev) => ({
                                        ...prev,
                                        members: prev.members.filter(
                                          (_, i) => i !== index,
                                        ),
                                      }))
                                    }
                                  >
                                    {t("admin.removeMember")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("admin.summaryTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <SummaryRow label={t("admin.colCode")} value={form.code} />
                      <SummaryRow
                        label={t("parametres.companyName")}
                        value={form.name}
                      />
                      <SummaryRow
                        label={t("parametres.legalName")}
                        value={form.legalName}
                      />
                      <SummaryRow label={t("parties.taxId")} value={form.taxId} />
                      <SummaryRow label={t("parties.rc")} value={form.rc} />
                      <SummaryRow label={t("parties.nis")} value={form.nis} />
                      <SummaryRow label={t("parties.ai")} value={form.ai} />
                      <SummaryRow
                        label={t("parametres.defaultCurrency")}
                        value={form.currency}
                      />
                      <SummaryRow
                        label={t("parametres.branches")}
                        value={String(form.branches.filter((b) => b.code && b.name).length)}
                      />
                      <SummaryRow
                        label={t("admin.members")}
                        value={String(form.members.length)}
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      {form.code.trim() && form.name.trim() ? (
                        <Badge variant="success">
                          {form.code} · {form.name}
                        </Badge>
                      ) : (
                        <Badge variant="warning">{t("admin.required")}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </CardContent>

          <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => discardDraft()}
                disabled={!dirty && !initialDraft}
              >
                {t("admin.discardDraft")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                {t("admin.previous")}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                  {t("admin.next")}
                </Button>
              ) : (
                <Button onClick={create} disabled={creating}>
                  {creating ? t("common.saving") : t("admin.create")}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MemberPicker({
  users,
  roles,
  form,
  onAdd,
}: {
  users: { id: string; username: string; fullName: string | null; email: string | null }[];
  roles: { id: string; key: string; name: string; nameAr: string | null }[];
  form: WizardForm;
  onAdd: (userId: string, roleId: string) => void;
}) {
  const { t } = useI18n();
  const [userId, setUserId] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const available = users.filter(
    (u) => !form.members.some((m) => m.userId === u.id),
  );
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger>
          <SelectValue placeholder={t("common.selectPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {available.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.fullName || user.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={roleId} onValueChange={setRoleId}>
        <SelectTrigger>
          <SelectValue placeholder={t("admin.assignRole")} />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={() => {
          onAdd(userId, roleId);
          setUserId("");
          setRoleId("");
        }}
        disabled={!userId || !roleId}
      >
        {t("admin.addMember")}
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value || "—"}</span>
    </div>
  );
}
