/**
 * Clés de paramètres autorisées via l'API générique `PUT /api/settings`.
 * Toute autre clé est refusée (le système de paramètres est global : un
 * administrateur de société ne doit pas pouvoir créer des clés arbitraires
 * affectant toutes les sociétés).
 *
 * NOTE: Les clés company.* ont été supprimées — l'identité, la configuration
 * et l'image de marque de la société sont désormais gérées exclusivement par
 * le modèle Company via `PUT /api/company/profile`.
 *
 * `print.defaultFormat` et `documents.qr.enabled` ont été supprimés —
 * ils appartiennent désormais à Company.printFormat et Company.qrEnabled.
 */
export const ALLOWED_SETTING_KEYS: ReadonlySet<string> = new Set([
  "fiscal.year",
  "locale.default",
  "theme.default",
  "notifications.email",
  "onboarding.dismissed",
  "tax.rates",
  "currency.list",
  "units.list",
]);
