/**
 * Mapping des clés `company.*` (Settings) vers les colonnes du modèle `Company`.
 * Source unique : utilisé par `PUT /api/settings` pour synchroniser la table
 * Settings vers le modèle Company, et par les tests E2E.
 */
export const COMPANY_KEY_MAP: Record<string, string> = {
  "company.name": "name",
  "company.legalName": "legalName",
  "company.legalForm": "legalForm",
  "company.activity": "activity",
  "company.secondaryActivity": "secondaryActivity",
  "company.establishedAt": "establishedAt",
  "company.taxId": "taxId",
  "company.rc": "rc",
  "company.nis": "nis",
  "company.ai": "ai",
  "company.vatNumber": "vatNumber",
  "company.country": "country",
  "company.wilaya": "wilaya",
  "company.commune": "commune",
  "company.postalCode": "postalCode",
  "company.address": "address",
  "company.phone": "phone",
  "company.mobile": "mobile",
  "company.email": "email",
  "company.website": "website",
  "company.bank": "bank",
  "company.bankAgency": "bankAgency",
  "company.bankAccount": "bankAccount",
  "company.rib": "rib",
  "company.iban": "iban",
  "company.swift": "swift",
  "company.logoKey": "logoKey",
  "company.stampKey": "stampKey",
  "company.signatureKey": "signatureKey",
  "company.currency": "currency",
};
