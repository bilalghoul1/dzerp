"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

/**
 * Écran affiché à un utilisateur AUTHENTIFIÉ mais sans aucune société active
 * (non SUPER_ADMIN, aucune adhésion UserCompany active). Remplace le contenu
 * métier : l'utilisateur n'a pas accès aux données d'une société et ne doit
 * jamais voir un HTTP 500 ni un « Aucune société accessible. ».
 */
export function NoCompanyScreen() {
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            domain_off
          </span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {t("auth.noCompany")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.noCompanyHint")}
        </p>
        <Button onClick={handleLogout} className="mt-6 w-full">
          {t("auth.logout")}
        </Button>
      </div>
    </div>
  );
}
