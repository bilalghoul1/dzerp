"use client";

import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { TabSection, Field, TextField, SaveBar, MoreDetails } from "./shared";
import { Input } from "@/components/ui/input";
import type { TabProps } from "./shared";

export function GeneralTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Partial<CompanyProfile>) => onUpdate(patch);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.companyGeneral")} description={t("parametres.generalDescription")}>
        <TextField
          label={t("parametres.companyName")}
          value={profile.name}
          onChange={(v) => u({ name: v })}
          required
          span={2}
        />
        <TextField
          label={t("parametres.companyName") + " (arabe)"}
          value={profile.nameAr}
          onChange={(v) => u({ nameAr: v })}
          span={2}
        />
        <TextField
          label={t("parametres.activity")}
          value={profile.activity}
          onChange={(v) => u({ activity: v })}
        />

        <MoreDetails>
          <TextField
            label={t("parametres.secondaryActivity")}
            value={profile.secondaryActivity}
            onChange={(v) => u({ secondaryActivity: v })}
          />
        </MoreDetails>
      </TabSection>

      <TabSection title={t("parametres.companyContacts")} description={t("parametres.generalDescription")}>
        <TextField
          label={t("parametres.phone")}
          value={profile.phone}
          onChange={(v) => u({ phone: v })}
          type="tel"
        />
        <TextField
          label={t("parametres.email")}
          value={profile.email}
          onChange={(v) => u({ email: v })}
          type="email"
        />
        <TextField
          label={t("parametres.website")}
          value={profile.website}
          onChange={(v) => u({ website: v })}
          type="url"
        />
        <TextField
          label={t("parametres.mobile")}
          value={profile.mobile}
          onChange={(v) => u({ mobile: v })}
          type="tel"
        />
      </TabSection>

      <TabSection title={t("parametres.companyAddress")}>
        <TextField
          label={t("parametres.address")}
          value={profile.address}
          onChange={(v) => u({ address: v })}
          span={2}
        />
        <Field label={t("parametres.country")}>
          <Input value={profile.country} onChange={(e) => u({ country: e.target.value })} />
        </Field>
        <TextField
          label={t("parametres.wilaya")}
          value={profile.wilaya}
          onChange={(v) => u({ wilaya: v })}
        />
        <TextField
          label={t("parametres.commune")}
          value={profile.commune}
          onChange={(v) => u({ commune: v })}
        />
        <TextField
          label={t("parametres.postalCode")}
          value={profile.postalCode}
          onChange={(v) => u({ postalCode: v })}
        />
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}
