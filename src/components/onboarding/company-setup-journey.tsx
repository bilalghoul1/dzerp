"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JourneyState } from "@/features/onboarding/journey";

/**
 * Parcours d'amorçage calme, non bloquant et réutilisable.
 * Aucune modale, aucun overlay, aucune animation intrusive.
 * Le renoncement (Dismiss) persiste via PUT /api/settings (onboarding.dismissed).
 */
export function CompanySetupJourney({ journey }: { journey: JourneyState }) {
  const { t } = useI18n();
  const [hidden, setHidden] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const dismiss = async () => {
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "onboarding.dismissed", value: true, type: "BOOLEAN" },
          ],
        }),
      });
    } catch {
      /* non bloquant : on masque quand même côté client */
    } finally {
      setHidden(true);
      setBusy(false);
    }
  };

  // Bandeau subtil « prêt » : n'apparaît qu'une fois la fondation complétée.
  if (journey.showReady && !hidden) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                check_circle
              </span>
            </span>
            <div>
              <p className="text-sm font-medium">{t("onboarding.ready")}</p>
              <p className="text-xs text-muted-foreground">
                {t("onboarding.readySubtitle")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            disabled={busy}
          >
            {t("onboarding.dismiss")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!journey.show || hidden) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("onboarding.title")}</CardTitle>
        <CardDescription>{t("onboarding.subtitle")}</CardDescription>
        <p className="pt-1 text-xs font-medium text-muted-foreground">
          {t("onboarding.progress", {
            done: journey.completedCount,
            total: journey.totalCount,
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {journey.milestones.map((m) => (
            <li key={m.key}>
              <div className="flex items-center gap-3 rounded-md px-2 py-2">
                <span
                  className={
                    m.complete
                      ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                      : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  }
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {m.complete ? "check" : "arrow_forward"}
                  </span>
                </span>
                <span className="flex-1 text-sm font-medium">{t(m.labelKey)}</span>
                {m.optional ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {t("onboarding.optional")}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {journey.nextAction ? (
            <Button asChild>
              <Link href={journey.nextAction.href}>
                {t(journey.nextAction.labelKey)}
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={dismiss}
            disabled={busy}
            className="sm:ml-auto"
          >
            {t("onboarding.dismiss")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
