"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import { TabSection, TextField, SaveBar, MoreDetails } from "./shared";
import type { TabProps } from "./shared";

export function FiscalTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Record<string, unknown>) => onUpdate(patch as Record<string, never>);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.companyLegal")} description={t("parametres.fiscalDescription")}>
        <TextField
          label={t("parametres.nif")}
          value={profile.taxId}
          onChange={(v) => u({ taxId: v })}
        />
        <TextField
          label={t("parametres.nis")}
          value={profile.nis}
          onChange={(v) => u({ nis: v })}
        />
        <TextField
          label={t("parametres.rc")}
          value={profile.rc}
          onChange={(v) => u({ rc: v })}
        />
        <TextField
          label={t("parametres.ai")}
          value={profile.ai}
          onChange={(v) => u({ ai: v })}
        />

        <MoreDetails>
          <TextField
            label={t("parametres.vatNumber")}
            value={profile.vatNumber}
            onChange={(v) => u({ vatNumber: v })}
          />
        </MoreDetails>
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}
