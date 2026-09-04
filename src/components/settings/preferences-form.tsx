"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PreferencesForm({
  profile,
  description,
}: {
  profile: CompanyProfile;
  description: string;
}) {
  const { t, locale, setLocale, locales } = useI18n();
  const [values, setValues] = React.useState(profile);
  const [busy, setBusy] = React.useState(false);

  const update = (patch: Partial<CompanyProfile>) =>
    setValues((v) => ({ ...v, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      // Company-owned fields: write to Company model via dedicated endpoint
      const companyRes = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            printFormat: values.printFormat,
            qrEnabled: values.qrEnabled,
          },
        }),
      });

      // App-wide preferences: write to global Setting via legacy endpoint
      const prefRes = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "locale.default", value: values.locale, type: "STRING" },
            { key: "theme.default", value: values.theme, type: "STRING" },
            { key: "fiscal.year", value: values.fiscalYear, type: "NUMBER" },
            {
              key: "notifications.email",
              value: values.notificationsEmail,
              type: "BOOLEAN",
            },
          ],
        }),
      });

      if (!companyRes.ok) {
        const json = await companyRes.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Company save failed");
      }
      if (!prefRes.ok) {
        const json = await prefRes.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Preferences save failed");
      }

      const nextLocale = locales.find((l) => l === values.locale);
      if (nextLocale && nextLocale !== locale) {
        setLocale(nextLocale);
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
        <CardTitle>{t("parametres.preferences")}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pref-language">{t("parametres.prefLanguage")}</Label>
          <Select
            value={values.locale}
            onValueChange={(v) => update({ locale: v })}
          >
            <SelectTrigger id="pref-language" className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pref-theme">{t("parametres.prefTheme")}</Label>
          <Select
            value={values.theme}
            onValueChange={(v) => update({ theme: v })}
          >
            <SelectTrigger id="pref-theme" className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("preferences.light")}</SelectItem>
              <SelectItem value="dark">{t("preferences.dark")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pref-fiscal-year">
            {t("parametres.prefFiscalYear")}
          </Label>
          <Input
            id="pref-fiscal-year"
            type="number"
            min={2000}
            max={2100}
            className="w-full sm:max-w-xs"
            value={values.fiscalYear}
            onChange={(e) =>
              update({ fiscalYear: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pref-print-format">
            {t("parametres.prefPrintFormat")}
          </Label>
          <Select
            value={values.printFormat}
            onValueChange={(v) => update({ printFormat: v })}
          >
            <SelectTrigger id="pref-print-format" className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">{t("parametres.printFormat_A4")}</SelectItem>
              <SelectItem value="A5">{t("parametres.printFormat_A5")}</SelectItem>
              <SelectItem value="THERMAL">
                {t("parametres.printFormat_THERMAL")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="pref-qr" className="leading-snug">
              {t("parametres.prefQr")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("parametres.prefQrDescription")}
            </p>
          </div>
          <Switch
            id="pref-qr"
            checked={values.qrEnabled}
            onCheckedChange={(v) => update({ qrEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="pref-notifications" className="leading-snug">
              {t("parametres.prefNotifications")}
            </Label>
          </div>
          <Switch
            id="pref-notifications"
            checked={values.notificationsEmail}
            onCheckedChange={(v) => update({ notificationsEmail: v })}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={busy}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
