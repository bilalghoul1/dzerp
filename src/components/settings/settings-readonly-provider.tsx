"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";

/**
 * Contexte serveur-borne : un utilisateur avec `parametres.view` mais SANS
 * `parametres.manage` peut consulter les paramètres (lecture seule). La
 * permission d'écriture reste ENFORCÉE côté serveur (403 sur les API);
 * ce contexte ne fait qu'aligner l'UI (contrôles désactivés + bannière).
 */
const SettingsReadOnlyContext = React.createContext(false);

export function useSettingsReadOnly(): boolean {
  return React.useContext(SettingsReadOnlyContext);
}

export function SettingsReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <SettingsReadOnlyContext.Provider value={readOnly}>
      {children}
    </SettingsReadOnlyContext.Provider>
  );
}

/** Bannière « lecture seule » affichée dans les paramètres quand l'écriture est refusée. */
export function SettingsReadOnlyBanner() {
  const { t } = useI18n();
  const readOnly = useSettingsReadOnly();
  if (!readOnly) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <span
        className="material-symbols-outlined mt-0.5 text-[18px]"
        aria-hidden="true"
      >
        visibility
      </span>
      <p>
        <strong className="font-semibold">{t("parametres.readOnlyTitle")}</strong>{" "}
        {t("parametres.readOnlyDescription")}
      </p>
    </div>
  );
}