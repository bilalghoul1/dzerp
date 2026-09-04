"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import { TabSection, TextField, SaveBar, MoreDetails } from "./shared";
import type { TabProps } from "./shared";

export function BankingTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Record<string, unknown>) => onUpdate(patch as Record<string, never>);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.companyBank")} description={t("parametres.bankingDescription")}>
        <TextField
          label={t("parametres.bank")}
          value={profile.bank}
          onChange={(v) => u({ bank: v })}
        />
        <TextField
          label={t("parametres.rib")}
          value={profile.rib}
          onChange={(v) => u({ rib: v })}
        />

        <MoreDetails>
          <TextField
            label={t("parametres.bankAgency")}
            value={profile.bankAgency}
            onChange={(v) => u({ bankAgency: v })}
          />
          <TextField
            label={t("parametres.bankAccount")}
            value={profile.bankAccount}
            onChange={(v) => u({ bankAccount: v })}
          />
          <TextField
            label={t("parametres.iban")}
            value={profile.iban}
            onChange={(v) => u({ iban: v })}
            span={2}
          />
          <TextField
            label={t("parametres.swift")}
            value={profile.swift}
            onChange={(v) => u({ swift: v })}
          />
        </MoreDetails>
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}
