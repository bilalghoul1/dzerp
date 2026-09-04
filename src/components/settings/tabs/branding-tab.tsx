"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { TabSection, Field, SaveBar } from "./shared";
import type { TabProps } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BrandingTab({ profile, onUpdate, onSave, busy }: TabProps) {
  const { t } = useI18n();
  const u = (patch: Partial<CompanyProfile>) => onUpdate(patch);

  return (
    <div className="space-y-4">
      <TabSection title={t("parametres.companyBranding")} description={t("parametres.brandingDescription")}>
        <Field label={t("parametres.logo")} span={2}>
          <BrandingUpload
            value={profile.logoKey}
            hint={t("parametres.uploadHint")}
            onUploaded={(key) => u({ logoKey: key })}
            onRemove={() => u({ logoKey: "" })}
          />
        </Field>
        <Field label={t("parametres.primaryColor")}>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              className="h-10 w-20 p-1"
              value={profile.primaryColor || "#0f172a"}
              onChange={(e) => u({ primaryColor: e.target.value })}
            />
            <Input
              value={profile.primaryColor}
              onChange={(e) => u({ primaryColor: e.target.value })}
              placeholder="#0f172a"
            />
          </div>
        </Field>

        <div className="sm:col-span-2 space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("parametres.stamp")}>
              <BrandingUpload
                value={profile.stampKey}
                hint={t("parametres.uploadHint")}
                onUploaded={(key) => u({ stampKey: key })}
                onRemove={() => u({ stampKey: "" })}
              />
            </Field>
            <Field label={t("parametres.signature")}>
              <BrandingUpload
                value={profile.signatureKey}
                hint={t("parametres.uploadHint")}
                onUploaded={(key) => u({ signatureKey: key })}
                onRemove={() => u({ signatureKey: "" })}
              />
            </Field>
          </div>
        </div>
      </TabSection>

      <SaveBar busy={busy} onSave={() => onSave(profile)} />
    </div>
  );
}

function BrandingUpload({
  value,
  hint,
  onUploaded,
  onRemove,
}: {
  value: string;
  hint: string;
  onUploaded: (key: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = React.useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("entity", "Company");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
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
      setUploadBusy(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">
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
          disabled={uploadBusy}
          onClick={() => inputRef.current?.click()}
        >
          {uploadBusy ? t("common.loading") : t("common.upload")}
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
