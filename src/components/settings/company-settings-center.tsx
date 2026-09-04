"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { CompanyProfile } from "@/features/settings/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GeneralTab } from "./tabs/general-tab";
import { LegalTab } from "./tabs/legal-tab";
import { FiscalTab } from "./tabs/fiscal-tab";
import { BankingTab } from "./tabs/banking-tab";
import { BrandingTab } from "./tabs/branding-tab";
import { PrintingTab } from "./tabs/printing-tab";

type TabKey = "general" | "legal" | "fiscal" | "banking" | "branding" | "printing";

function computeCompletion(p: CompanyProfile): { score: number; sections: { key: string; labelKey: string; done: boolean }[] } {
  const identity = Boolean(p.name);
  const legal = Boolean(p.legalForm || p.legalName);
  const contact = Boolean(p.phone || p.email);
  const tax = Boolean(p.taxId || p.nis || p.rc || p.ai);
  const bank = Boolean(p.bank || p.rib);
  const brand = Boolean(p.logoKey);

  const checks = [
    { key: "identity", labelKey: "parametres.completionIdentity" as const, done: identity },
    { key: "legal", labelKey: "parametres.completionLegal" as const, done: legal },
    { key: "contact", labelKey: "parametres.completionContact" as const, done: contact },
    { key: "tax", labelKey: "parametres.completionTax" as const, done: tax },
    { key: "bank", labelKey: "parametres.completionBanking" as const, done: bank },
    { key: "brand", labelKey: "parametres.completionBranding" as const, done: brand },
  ];

  const score = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  return { score, sections: checks };
}

export function CompanySettingsCenter({
  profile: initialProfile,
}: {
  profile: CompanyProfile;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = React.useState(initialProfile);
  const [busy, setBusy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>("general");

  const completion = computeCompletion(profile);

  const updateProfile = (patch: Partial<CompanyProfile>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const saveCompany = async (fields: Partial<CompanyProfile>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: fields }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setProfile((p) => ({ ...p, ...fields }));
      toast.success(t("parametres.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("parametres.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const tabTriggers: { value: TabKey; labelKey: string }[] = [
    { value: "general", labelKey: "parametres.tabGeneral" },
    { value: "legal", labelKey: "parametres.tabLegal" },
    { value: "fiscal", labelKey: "parametres.tabFiscal" },
    { value: "banking", labelKey: "parametres.tabBanking" },
    { value: "branding", labelKey: "parametres.tabBranding" },
    { value: "printing", labelKey: "parametres.tabPrinting" },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <TabsList className="h-auto flex-wrap">
            {tabTriggers.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-sm">
                {t(tab.labelKey as never)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-3">
            <Badge variant={completion.score === 100 ? "success" : "secondary"} className="text-xs">
              {completion.score}%
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {t("parametres.companyCompletion")}
            </span>
          </div>
        </div>

        <TabsContent value="general">
          <GeneralTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
        <TabsContent value="legal">
          <LegalTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
        <TabsContent value="fiscal">
          <FiscalTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
        <TabsContent value="banking">
          <BankingTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
        <TabsContent value="printing">
          <PrintingTab profile={profile} onUpdate={updateProfile} onSave={saveCompany} busy={busy} />
        </TabsContent>
      </Tabs>

      <CompletionSidebar sections={completion.sections} />
    </div>
  );
}

function CompletionSidebar({
  sections,
}: {
  sections: { key: string; labelKey: string; done: boolean }[];
}) {
  const { t } = useI18n();
  return (
    <Card className="hidden xl:block">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("parametres.companyCompletion")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sections.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${s.done ? "bg-emerald-500" : "bg-muted"}`}
            />
            <span className={s.done ? "text-foreground" : "text-muted-foreground"}>
              {t(s.labelKey as never)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
