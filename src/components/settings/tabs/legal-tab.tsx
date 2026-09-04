"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import { TabSection, TextField, SaveBar, MoreDetails } from "./shared";
import type { TabProps } from "./shared";

export function LegalTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Record<string, unknown>) => onUpdate(patch as Record<string, never>);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.companyLegal")} description={t("parametres.legalDescription")}>
        <TextField
          label={t("parametres.legalName")}
          value={profile.legalName}
          onChange={(v) => u({ legalName: v })}
          span={2}
        />
        <TextField
          label={t("parametres.legalForm")}
          value={profile.legalForm}
          onChange={(v) => u({ legalForm: v })}
        />
        <TextField
          label={t("parametres.capital")}
          value={profile.capital}
          onChange={(v) => u({ capital: v })}
          placeholder="ex. 100 000 DZD"
        />

        <MoreDetails>
          <TextField
            label={t("parametres.establishedAt")}
            value={profile.establishedAt}
            onChange={(v) => u({ establishedAt: v })}
            type="date"
          />
        </MoreDetails>
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}
