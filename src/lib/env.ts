const INSECURE_SESSION_SECRET = "dzerp-insecure-secret";

/**
 * Valide les variables d'environnement critiques au démarrage du serveur.
 * Fail-fast : le serveur refuse de démarrer si un secret indispensable
 * manque en production. Évite tout fallback silencieux et non sécurisé.
 */
export function assertEnv(): void {
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL) {
    throw new Error("[env] DATABASE_URL is required.");
  }

  if (isProd && !process.env.SESSION_SECRET) {
    throw new Error(
      "[env] SESSION_SECRET is required in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }

  if (process.env.SESSION_SECRET === INSECURE_SESSION_SECRET) {
    throw new Error("[env] SESSION_SECRET must not use the insecure default value.");
  }
}

export function isInsecureSessionSecret(): boolean {
  return process.env.SESSION_SECRET === INSECURE_SESSION_SECRET;
}
