"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type {
  CompanyProfile,
  CurrencyItem,
} from "@/features/settings/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Option = {
  value: string;
  label: string;
  labelAr?: string | null;
};

export function CompanyForm({
  profile,
  currencies,
  countries,
  legalForms,
  banks,
  wilayas,
  communes,
  description,
}: {
  profile: CompanyProfile;
  currencies: CurrencyItem[];
  countries: Option[];
  legalForms: Option[];
  banks: Option[];
  wilayas: Option[];
  communes: { wilayaCode: string; value: string; label: string; labelAr?: string | null }[];
  description: string;
}) {
  const { t, locale } = useI18n();
  const [values, setValues] = React.useState(profile);
  const [busy, setBusy] = React.useState(false);

  const update = (patch: Partial<CompanyProfile>) =>
    setValues((v) => ({ ...v, ...patch }));

  const optionLabel = (option: Option) =>
    locale === "ar" && option.labelAr ? option.labelAr : option.label;

  const optionLabelForValue = (value: string, options: Option[]) => {
    const option = options.find((o) => o.value === value);
    return option ? optionLabel(option) : value;
  };

  const filteredCommunes = communes.filter(
    (c) => c.wilayaCode === values.wilaya,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "company.name", value: values.name, type: "STRING" },
            { key: "company.nameAr", value: values.nameAr, type: "STRING" },
            { key: "company.legalName", value: values.legalName, type: "STRING" },
            { key: "company.legalForm", value: values.legalForm, type: "STRING" },
            { key: "company.capital", value: values.capital, type: "STRING" },
            { key: "company.activity", value: values.activity, type: "STRING" },
            { key: "company.secondaryActivity", value: values.secondaryActivity, type: "STRING" },
            { key: "company.establishedAt", value: values.establishedAt, type: "STRING" },
            { key: "company.taxId", value: values.taxId, type: "STRING" },
            { key: "company.rc", value: values.rc, type: "STRING" },
            { key: "company.nis", value: values.nis, type: "STRING" },
            { key: "company.ai", value: values.ai, type: "STRING" },
            { key: "company.vatNumber", value: values.vatNumber, type: "STRING" },
            { key: "company.country", value: values.country, type: "STRING" },
            { key: "company.wilaya", value: values.wilaya, type: "STRING" },
            { key: "company.commune", value: values.commune, type: "STRING" },
            { key: "company.postalCode", value: values.postalCode, type: "STRING" },
            { key: "company.address", value: values.address, type: "STRING" },
            { key: "company.phone", value: values.phone, type: "STRING" },
            { key: "company.mobile", value: values.mobile, type: "STRING" },
            { key: "company.email", value: values.email, type: "STRING" },
            { key: "company.website", value: values.website, type: "STRING" },
            { key: "company.bank", value: values.bank, type: "STRING" },
            { key: "company.bankAgency", value: values.bankAgency, type: "STRING" },
            { key: "company.bankAccount", value: values.bankAccount, type: "STRING" },
            { key: "company.rib", value: values.rib, type: "STRING" },
            { key: "company.iban", value: values.iban, type: "STRING" },
            { key: "company.swift", value: values.swift, type: "STRING" },
            { key: "company.logoKey", value: values.logoKey, type: "STRING" },
            { key: "company.stampKey", value: values.stampKey, type: "STRING" },
            { key: "company.signatureKey", value: values.signatureKey, type: "STRING" },
            { key: "company.primaryColor", value: values.primaryColor, type: "STRING" },
            { key: "company.printHeader", value: values.printHeader, type: "STRING" },
            { key: "company.invoiceFooter", value: values.invoiceFooter, type: "STRING" },
            { key: "company.printFormat", value: values.printFormat, type: "STRING" },
            { key: "company.currency", value: values.currency, type: "STRING" },
          ],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      toast.success(t("parametres.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const brandingT = t;

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("parametres.company")}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>

      <SectionCard title={t("parametres.companyGeneral")}>
        <Field label={t("parametres.companyName")} span={2} required>
          <Input
            value={values.name}
            onChange={(e) => update({ name: e.target.value })}
            required
          />
        </Field>
        <Field label={t("parametres.nameAr")} span={2}>
          <Input
            dir="rtl"
            value={values.nameAr}
            onChange={(e) => update({ nameAr: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.legalName")} span={2}>
          <Input
            value={values.legalName}
            onChange={(e) => update({ legalName: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.legalForm")}>
          <Select
            value={values.legalForm}
            onValueChange={(v) => update({ legalForm: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")}>
                {values.legalForm
                  ? optionLabelForValue(values.legalForm, legalForms)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {legalForms.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {optionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.establishedAt")}>
          <Input
            type="date"
            value={values.establishedAt}
            onChange={(e) => update({ establishedAt: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.activity")}>
          <Input
            value={values.activity}
            onChange={(e) => update({ activity: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.secondaryActivity")}>
          <Input
            value={values.secondaryActivity}
            onChange={(e) => update({ secondaryActivity: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.currencies")}>
          <Select
            value={values.currency}
            onValueChange={(v) => update({ currency: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code} · {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </SectionCard>

      <SectionCard title={t("parametres.companyLegal")}>
        <Field label={t("parametres.capital")}>
          <Input
            value={values.capital}
            onChange={(e) => update({ capital: e.target.value })}
            placeholder="ex. 100 000 DZD"
          />
        </Field>
        <Field label={t("parametres.taxId")}>
          <Input
            value={values.taxId}
            onChange={(e) => update({ taxId: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.rc")}>
          <Input
            value={values.rc}
            onChange={(e) => update({ rc: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.nis")}>
          <Input
            value={values.nis}
            onChange={(e) => update({ nis: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.ai")}>
          <Input
            value={values.ai}
            onChange={(e) => update({ ai: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.vatNumber")}>
          <Input
            value={values.vatNumber}
            onChange={(e) => update({ vatNumber: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title={t("parametres.companyAddress")}>
        <Field label={t("parametres.country")}>
          <Select
            value={values.country}
            onValueChange={(v) => update({ country: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {optionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.postalCode")}>
          <Input
            value={values.postalCode}
            onChange={(e) => update({ postalCode: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.wilaya")}>
          <Select
            value={values.wilaya}
            onValueChange={(v) => update({ wilaya: v, commune: "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")}>
                {values.wilaya
                  ? optionLabelForValue(values.wilaya, wilayas)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {wilayas.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {optionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.commune")}>
          <Select
            value={values.commune}
            onValueChange={(v) => update({ commune: v })}
            disabled={!values.wilaya || filteredCommunes.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {filteredCommunes.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {locale === "ar" && option.labelAr
                    ? option.labelAr
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.address")} span={2}>
          <Input
            value={values.address}
            onChange={(e) => update({ address: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title={t("parametres.companyContacts")}>
        <Field label={t("parametres.phone")}>
          <Input
            type="tel"
            value={values.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.mobile")}>
          <Input
            type="tel"
            value={values.mobile}
            onChange={(e) => update({ mobile: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.email")}>
          <Input
            type="email"
            value={values.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.website")}>
          <Input
            type="url"
            value={values.website}
            onChange={(e) => update({ website: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title={t("parametres.companyBank")}>
        <Field label={t("parametres.bank")}>
          <Select
            value={values.bank}
            onValueChange={(v) => update({ bank: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectPlaceholder")}>
                {values.bank
                  ? optionLabelForValue(values.bank, banks)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {banks.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {optionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.bankAgency")}>
          <Input
            value={values.bankAgency}
            onChange={(e) => update({ bankAgency: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.bankAccount")}>
          <Input
            value={values.bankAccount}
            onChange={(e) => update({ bankAccount: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.rib")}>
          <Input
            value={values.rib}
            onChange={(e) => update({ rib: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.iban")}>
          <Input
            value={values.iban}
            onChange={(e) => update({ iban: e.target.value })}
          />
        </Field>
        <Field label={t("parametres.swift")}>
          <Input
            value={values.swift}
            onChange={(e) => update({ swift: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title={t("parametres.companyBranding")}>
        <BrandingUpload
          label={t("parametres.logo")}
          value={values.logoKey}
          hint={t("parametres.uploadHint")}
          onUploaded={(key) => update({ logoKey: key })}
          onRemove={() => update({ logoKey: "" })}
          t={brandingT}
        />
        <BrandingUpload
          label={t("parametres.stamp")}
          value={values.stampKey}
          hint={t("parametres.uploadHint")}
          onUploaded={(key) => update({ stampKey: key })}
          onRemove={() => update({ stampKey: "" })}
          t={brandingT}
        />
        <BrandingUpload
          label={t("parametres.signature")}
          value={values.signatureKey}
          hint={t("parametres.uploadHint")}
          onUploaded={(key) => update({ signatureKey: key })}
          onRemove={() => update({ signatureKey: "" })}
          t={brandingT}
        />
        <Field label={t("parametres.primaryColor")}>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              className="h-10 w-20 p-1"
              value={values.primaryColor || "#0f172a"}
              onChange={(e) => update({ primaryColor: e.target.value })}
            />
            <Input
              value={values.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              placeholder="#0f172a"
            />
          </div>
        </Field>
        <Field label={t("parametres.printFormat")}>
          <Select
            value={values.printFormat || "A4"}
            onValueChange={(v) => update({ printFormat: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="THERMAL">{t("parametres.printFormat_THERMAL")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parametres.printHeader")} span={2}>
          <Input
            value={values.printHeader}
            onChange={(e) => update({ printHeader: e.target.value })}
            placeholder="Texte d'en-tête optionnel pour les documents"
          />
        </Field>
        <Field label={t("parametres.invoiceFooter")} span={2}>
          <Input
            value={values.invoiceFooter}
            onChange={(e) => update({ invoiceFooter: e.target.value })}
            placeholder="Notes de bas de page, remerciements, conditions..."
          />
        </Field>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function SectionCard({
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

function Field({
  label,
  span,
  required,
  children,
}: {
  label: string;
  span?: number;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

function BrandingUpload({
  label,
  value,
  hint,
  onUploaded,
  onRemove,
  t,
}: {
  label: string;
  value: string;
  hint: string;
  onUploaded: (key: string) => void;
  onRemove: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("entity", "Company");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error");
      }
      const saved = json?.data?.[0];
      if (saved?.storageKey) {
        onUploaded(saved.storageKey);
        toast.success(t("parametres.saveSuccess"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("upload.uploadError"),
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Label className="leading-snug">{label}</Label>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {value ? value.slice(-30) : hint}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            {t("common.delete")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("common.loading") : t("common.upload")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
