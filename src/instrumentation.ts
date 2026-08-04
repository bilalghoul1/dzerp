import { assertEnv } from "@/lib/env";

/**
 * Exécuté une fois au démarrage du serveur Next.js.
 * Fail-fast sur les variables d'environnement critiques.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertEnv();
  }
}
