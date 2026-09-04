"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { TabSection, Field, SaveBar } from "./shared";
import type { TabProps } from "./shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PrintingTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Partial<CompanyProfile>) => onUpdate(patch);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.printFormat")} description={t("parametres.printingDescription")}>
        <Field label={t("parametres.printFormat")}>
          <Select
            value={profile.printFormat || "A4"}
            onValueChange={(v) => u({ printFormat: v })}
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
        <Field label={t("parametres.prefQr")}>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="leading-snug">{t("parametres.prefQr")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("parametres.prefQrDescription")}
              </p>
            </div>
            <Switch
              checked={profile.qrEnabled}
              onCheckedChange={(v) => u({ qrEnabled: v })}
            />
          </div>
        </Field>
        <Field label={t("parametres.printHeader")} span={2}>
          <Input
            value={profile.printHeader}
            onChange={(e) => u({ printHeader: e.target.value })}
            placeholder="Texte d'en-tête optionnel pour les documents"
          />
        </Field>
        <Field label={t("parametres.invoiceFooter")} span={2}>
          <Input
            value={profile.invoiceFooter}
            onChange={(e) => u({ invoiceFooter: e.target.value })}
            placeholder="Notes de bas de page, remerciements, conditions..."
          />
        </Field>
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}
