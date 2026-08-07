/**
 * Limiteur de débit en mémoire (fenêtre fixe).
 *
 * Usage prévu : protection brute-force sur l'authentification. En mémoire par
 * process ; pour un déploiement multi-instance il faudrait un stockage partagé
 * (Redis). Les clés sont dérivées de l'adresse IP et du nom d'utilisateur.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const CLEANUP_THRESHOLD = 10_000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= CLEANUP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
