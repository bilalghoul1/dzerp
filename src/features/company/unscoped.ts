import {
  isUnscopedContext,
  runUnscoped as runUnscopedImpl,
} from "@/features/company/context";

/**
 * Accès global explicite (Super Administrateur) hors du contexte société.
 *
 * Seul le module d'administration globale doit l'utiliser. Les modules métier
 * ne doivent jamais contourner le contexte société. En Phase 5.4, l'extension
 * Prisma de scoping lira `isUnscopedContext()` pour désactiver le filtrage
 * automatique par `companyId`.
 */
export { isUnscopedContext };

export function runUnscoped<T>(fn: () => T): T {
  return runUnscopedImpl(fn);
}

/** Alias documenté : `withUnscopedContext(fn)`. */
export function withUnscopedContext<T>(fn: () => T): T {
  return runUnscopedImpl(fn);
}
