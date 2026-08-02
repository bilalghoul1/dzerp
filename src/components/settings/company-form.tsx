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

export function CompanyForm({
  profile,
  currencies,
  description,
}: {
  profile: CompanyProfile;
  currencies: CurrencyItem[];
  description: string;
}) {
  const { t } = useI18n();
  const [values, setValues] = React.useState(profile);
  const [busy, setBusy] = React.useState(false);

  const update = (patch: Partial<CompanyProfile>) =>
    setValues((v) => ({ ...v, ...patch }));

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
            { key: "company.taxId", value: values.taxId, type: "STRING" },
            { key: "company.address", value: values.address, type: "STRING" },
            { key: "company.phone", value: values.phone, type: "STRING" },
            { key: "company.email", value: values.email, type: "STRING" },
            { key: "company.currency", value: values.currency, type: "STRING" },
            { key: "fiscal.year", value: values.fiscalYear, type: "NUMBER" },
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("parametres.company")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name">{t("parametres.companyName")}</Label>
            <Input
              id="company-name"
              value={values.name}
              onChange={(e) => update({ name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-taxid">{t("parametres.taxId")}</Label>
            <Input
              id="company-taxid"
              value={values.taxId}
              onChange={(e) => update({ taxId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-phone">{t("parametres.phone")}</Label>
            <Input
              id="company-phone"
              type="tel"
              value={values.phone}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-address">{t("parametres.address")}</Label>
            <Input
              id="company-address"
              value={values.address}
              onChange={(e) => update({ address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email">{t("parametres.email")}</Label>
            <Input
              id="company-email"
              type="email"
              value={values.email}
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-currency">
              {t("parametres.defaultCurrency")}
            </Label>
            <Select
              value={values.currency}
              onValueChange={(v) => update({ currency: v })}
            >
              <SelectTrigger id="company-currency">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-fiscal-year">
              {t("parametres.fiscalYear")}
            </Label>
            <Input
              id="company-fiscal-year"
              type="number"
              min={2000}
              max={2100}
              value={values.fiscalYear}
              onChange={(e) =>
                update({ fiscalYear: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
