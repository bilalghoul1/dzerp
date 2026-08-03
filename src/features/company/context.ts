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

/**
 * Contexte société requis : échoue si la requête s'exécute hors contexte.
 * Utilisé par les services métier qui renseignent `companyId` explicitement
 * (le scoping d'écriture de l'extension le renseigne aussi à l'exécution).
 */
type FallbackResolver = () => Promise<CompanyContext | null>;

let fallbackResolver: FallbackResolver | null = null;

/**
 * Enregistre le résolveur de contexte de secours. Nécessaire car les rendus
 * asynchrones des pages RSC s'exécutent hors du contexte ALS du layout : les
 * requêtes Prisma scoped n'y trouvent aucun contexte ALS. Le résolveur doit
 * être mémorisé par requête (`React.cache`, layout racine) pour éviter une
 * résolution par requête Prisma.
 */
export function setFallbackContextResolver(
  resolver: FallbackResolver | null,
): void {
  fallbackResolver = resolver;
}

/**
 * Contexte société pour une opération Prisma : contexte ALS s'il existe,
 * sinon résolution de secours (par requête). Retourne `null` si l'utilisateur
 * n'est pas authentifié ou si aucun contexte n'est résolvable. Toute erreur de
 * résolution est traitée comme absence de contexte (fail-closed en aval).
 */
export async function getOrResolveCompanyContext(): Promise<CompanyContext | null> {
  const existing = getCompanyContext();
  if (existing) return existing;
  if (!fallbackResolver) return null;
  try {
    return await fallbackResolver();
  } catch {
    return null;
  }
}

/** Contexte société requis : échoue si la requête s'exécute hors contexte. */
export function requireCompanyContext(): CompanyContext {
  const context = getCompanyContext();
  if (!context) {
    throw new Error(
      "companyScope: opération métier sans contexte société " +
        "(runWithCompanyContext / apiGuardWithContext requis).",
    );
  }
  return context;
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
