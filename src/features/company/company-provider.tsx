"use client";

import { createContext, useContext } from "react";
import type { CompanyContext } from "@/features/company/types";

const CompanyContextState = createContext<CompanyContext | null>(null);

/**
 * Fournisseur client du contexte société (propagé depuis le layout serveur).
 * Permet aux composants client (en-tête, sélecteurs, futurs modules) d'accéder
 * à la société/succursale active sans résoudre manuellement.
 */
export function CompanyProvider({
  context,
  children,
}: {
  context: CompanyContext;
  children: React.ReactNode;
}) {
  return (
    <CompanyContextState.Provider value={context}>
      {children}
    </CompanyContextState.Provider>
  );
}

/** Accès au contexte société dans un composant client (doit être dans un provider). */
export function useCompany(): CompanyContext {
  const ctx = useContext(CompanyContextState);
  if (!ctx) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return ctx;
}

/** Accès optionnel au contexte société (retourne `null` hors provider). */
export function useCompanyOptional(): CompanyContext | null {
  return useContext(CompanyContextState);
}
