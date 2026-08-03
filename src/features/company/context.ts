import { AsyncLocalStorage } from "node:async_hooks";
import type { CompanyContext } from "@/features/company/types";

type CompanyStore = {
  context: CompanyContext | null;
  unscoped: boolean;
};

const storage = new AsyncLocalStorage<CompanyStore>();

type ResolveCache = Map<string, Promise<unknown>>;

/**
 * Cache de résolution limité à la requête courante (permission evaluation).
 * Jamais partagé entre utilisateurs : le stock est créé par requête et jeté à
 * la fin de la résolution. Hors stock (route handlers), aucune mise en cache.
 */
const resolveCacheStorage = new AsyncLocalStorage<ResolveCache>();

export function runWithResolveCache<T>(fn: () => T): T {
  return resolveCacheStorage.run(new Map(), fn);
}

export function getResolveCache(): ResolveCache | null {
  return resolveCacheStorage.getStore() ?? null;
}

/**
 * Exécute `fn` dans le contexte société résolu pour la requête courante.
 * Utilisé par le layout racine pour propager le contexte à toute la sous-arborescence.
 */
export function runWithCompanyContext<T>(
  context: CompanyContext,
  fn: () => T,
): T {
  return storage.run({ context, unscoped: false }, fn);
}

/**
 * Contexte société courant. Retourne `null` hors d'un contexte société
 * (ex. pages publiques, scripts). Les helpers exposent une API plus ergonomique.
 */
export function getCompanyContext(): CompanyContext | null {
  return storage.getStore()?.context ?? null;
}

/** True si la fonction courante s'exécute dans un contexte "unscoped" (administration globale). */
export function isUnscopedContext(): boolean {
  return storage.getStore()?.unscoped ?? false;
}

/** Exécute `fn` dans un contexte "unscoped" (accès global administrateur). */
export function runUnscoped<T>(fn: () => T): T {
  const store = storage.getStore();
  return storage.run(
    { context: store?.context ?? null, unscoped: true },
    fn,
  );
}
