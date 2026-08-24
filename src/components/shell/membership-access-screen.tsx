"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import type { CompanyRef } from "@/features/company/types";
import type { SessionUser } from "@/features/auth/types";

/**
 * État d'accès DÉGRADÉ : l'utilisateur est authentifié et membre ACTIF d'une
 * société, mais son adhésion ne porte AUCUN rôle valide (invariant d'intégrité
 * violé). Échec sûr (fail-closed) : AUCUNE donnée société n'est rendue, pas de
 * sidebar vide, pas de HTTP 500, pas de tableau de bord trompeur — uniquement
 * un message clair (FR / AR) et la déconnexion.
 */
export function MembershipAccessScreen({
  user,
  company,
}: {
  user: SessionUser;
  company: CompanyRef;
}) {
  const router = useRouter();
  const { t } = useI18n();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            manage_accounts
          </span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {t("auth.noCompanyRole")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.noCompanyRoleHint")}
        </p>
        <p className="mt-3 truncate text-xs text-muted-foreground">
          {company.name} · {user.username}
        </p>
        <Button onClick={handleLogout} className="mt-6 w-full">
          {t("auth.logout")}
        </Button>
      </div>
    </div>
  );
}
