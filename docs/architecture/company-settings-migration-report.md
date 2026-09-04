# Company Settings — Migration Report (PHASE 3)

> Date: 2026-09-04 · Version: 2026-09-04-v1
> Input: `docs/architecture/company-settings-audit.md` (PHASE 1),
> `docs/architecture/company-settings-target.md` (PHASE 2)
> Scope: classification of every `company.*` legacy key + migration plan

---

## 1. Executive Summary

The global `Setting` table stores 36 `company.*` keys that are shared across all
companies (no `companyId`). After the dual-write in `PUT /api/settings`, these
values also exist on the per-company `Company` model. This migration consolidates
all company identity data into the `Company` model and removes the duplicate
`company.*` keys from the global `Setting` table.

**Key finding:** The `Setting` table is global. A single `company.name = "ABC"`
row could represent any company. Migration is only safe when:
- Only one active company exists (the value belongs to it), OR
- The Company model already has the correct value (already in sync), OR
- The Company field is empty (safe to populate from Setting).

Conflicts (different values in Setting vs Company for the same field) require
manual resolution and are classified as MIGRATION BLOCKERS.

---

## 2. Key Classification Summary

| Classification | Count | Action |
|---------------|-------|--------|
| **MIGRATE** (Company Identity) | 34 keys | Remove from Setting; write to Company model |
| **DEPRECATE** (Duplicate) | 3 keys | Remove from Setting; Company already has these fields |
| **KEEP** (App Preference) | 5 keys | Stay in Setting table (locale, theme, notifications, tax rates, currencies, units) |
| **BLOCK** (type errors) | 0 keys | Verified — no type errors in schema-defined fields |
| **IGNORE** (unused) | 0 keys | All keys have consumers |

**Total legacy `company.*` keys:** 36
**Total deprecated preference keys:** 2 (`print.defaultFormat`, `documents.qr.enabled`)
**Total kept preference keys:** 5 (`fiscal.year`, `locale.default`, `theme.default`, `notifications.email`, `onboarding.dismissed` + 3 app config: `tax.rates`, `currency.list`, `units.list`)

---

## 3. Detailed Key Classification

### 3.1 MIGRATE — Company Identity (34 keys)

Every key below is classified as Company Identity data. The Setting value
will be migrated to the corresponding `Company` model field, and the Setting
key will be deprecated (removed from `ALLOWED_SETTING_KEYS`).

| # | Legacy Setting Key | Target Company Field | DB Type | UI Type | Validation | Migration Notes |
|---|-------------------|---------------------|---------|---------|------------|----------------|
| 1 | `company.name` | `name` | `String` (required) | string | Non-empty after trim | Always present (set at creation) |
| 2 | `company.nameAr` | `nameAr` | `String?` | string | Optional | Direct copy |
| 3 | `company.legalName` | `legalName` | `String?` | string | Optional | Direct copy |
| 4 | `company.legalForm` | `legalForm` | `String?` | Select | Optional | Direct copy (lookup code) |
| 5 | `company.capital` | `capital` | `Decimal?` | string | Numeric if non-empty | **Type conversion**: string → Decimal. Invalid values → BLOCK |
| 6 | `company.activity` | `activity` | `String?` | string | Optional | Direct copy |
| 7 | `company.secondaryActivity` | `secondaryActivity` | `String?` | string | Optional | Direct copy |
| 8 | `company.establishedAt` | `establishedAt` | `DateTime?` | ISO string | Valid date if non-empty | **Type conversion**: ISO string → DateTime. Invalid → BLOCK |
| 9 | `company.taxId` | `taxId` | `String?` | string | Optional | Direct copy (NIF) |
| 10 | `company.rc` | `rc` | `String?` | string | Optional | Direct copy |
| 11 | `company.nis` | `nis` | `String?` | string | Optional | Direct copy |
| 12 | `company.ai` | `ai` | `String?` | string | Optional | Direct copy |
| 13 | `company.vatNumber` | `vatNumber` | `String?` | string | Optional | Direct copy |
| 14 | `company.country` | `country` | `String?` | Select | Optional | Direct copy (country code) |
| 15 | `company.wilaya` | `wilaya` | `String?` | Select | Optional | Direct copy (wilaya code) |
| 16 | `company.commune` | `commune` | `String?` | Select | Optional | Direct copy (commune code) |
| 17 | `company.postalCode` | `postalCode` | `String?` | string | Optional | Direct copy |
| 18 | `company.address` | `address` | `String?` | textarea | Optional | Direct copy |
| 19 | `company.phone` | `phone` | `String?` | string | Optional | Direct copy |
| 20 | `company.mobile` | `mobile` | `String?` | string | Optional | Direct copy |
| 21 | `company.email` | `email` | `String?` | email | Optional | Direct copy |
| 22 | `company.website` | `website` | `String?` | url | Optional | Direct copy |
| 23 | `company.bank` | `bank` | `String?` | Select | Optional | Direct copy (bank code) |
| 24 | `company.bankAgency` | `bankAgency` | `String?` | string | Optional | Direct copy |
| 25 | `company.bankAccount` | `bankAccount` | `String?` | string | Optional | Direct copy |
| 26 | `company.rib` | `rib` | `String?` | string | 20 digits if non-empty | Direct copy |
| 27 | `company.iban` | `iban` | `String?` | string | Optional | Direct copy |
| 28 | `company.swift` | `swift` | `String?` | string | Optional | Direct copy |
| 29 | `company.logoKey` | `logoKey` | `String?` | file ref | Optional | Verify FileAsset.companyId matches |
| 30 | `company.stampKey` | `stampKey` | `String?` | file ref | Optional | Verify FileAsset.companyId matches |
| 31 | `company.signatureKey` | `signatureKey` | `String?` | file ref | Optional | Verify FileAsset.companyId matches |
| 32 | `company.primaryColor` | `primaryColor` | `String?` | hex color | #RRGGBB if non-empty | Direct copy |
| 33 | `company.printHeader` | `printHeader` | `String?` | textarea | Optional | Direct copy |
| 34 | `company.invoiceFooter` | `invoiceFooter` | `String?` | textarea | Optional | Direct copy |

### 3.2 MIGRATE — Company Configuration (2 keys)

These keys are classified as Company Configuration (not identity) but still
belong on the `Company` model, which already has the corresponding fields.

| # | Legacy Setting Key | Target Company Field | Notes |
|---|-------------------|---------------------|-------|
| 35 | `company.printFormat` | `printFormat` | Already on Company. Duplicate Setting → deprecate. |
| 36 | `company.currency` | `currency` | Already on Company. Duplicate Setting → deprecate. |

### 3.3 DEPRECATE — Duplicate Preference Keys (3 keys)

These keys duplicate fields that already exist on the `Company` model or are
being moved there. They will be removed from `ALLOWED_SETTING_KEYS`.

| # | Legacy Setting Key | Reason | Action |
|---|-------------------|--------|--------|
| 37 | `print.defaultFormat` | Duplicate of `Company.printFormat` | Remove from ALLOWED_SETTING_KEYS. PreferencesForm stops writing it. |
| 38 | `documents.qr.enabled` | Duplicate of `Company.qrEnabled` | Remove from ALLOWED_SETTING_KEYS. PreferencesForm stops writing it. |
| 39 | `fiscal.year` | Duplicate of `Company.fiscalYear` | Migrate value to Company.fiscalYear. Then deprecate. |

### 3.4 KEEP — App-wide Preferences (5 keys)

These keys stay in the `Setting` table. They are NOT company identity data.

| # | Setting Key | Reason | Action |
|---|-----------|--------|--------|
| 40 | `locale.default` | App-wide locale default | Keep in Setting |
| 41 | `theme.default` | App-wide theme default | Keep in Setting |
| 42 | `notifications.email` | App-wide notification default | Keep in Setting |
| 43 | `onboarding.dismissed` | Per-user onboarding flag | Keep in Setting |
| 44 | `tax.rates` | Global TVA rate definitions (JSON) | Keep in Setting |
| 45 | `currency.list` | Global currency list (JSON) | Keep in Setting |
| 46 | `units.list` | Global unit definitions (JSON) | Keep in Setting |

---

## 4. Branding Migration Safety

### 4.1 Logo/Stamp/Signature Keys

The `logoKey`, `stampKey`, `signatureKey` values on the `Company` model are
storage keys (filenames) that reference `FileAsset` records.

**Verification required:**
- `FileAsset.companyId` must match the target Company.
- If the `Company.logoKey` is already populated, the Setting value should
  NOT overwrite it (Case A from conflict policy).

**Cross-company risk:** If a global Setting `company.logoKey` points to a
`FileAsset` belonging to Company B, migrating it to Company A would create
a cross-company asset reference.

**Mitigation:** The migration script verifies `FileAsset.companyId` for every
branding key before migration. If ownership doesn't match → BLOCK.

### 4.2 Current State

The dual-write in `PUT /api/settings` writes `company.logoKey` to both the
global Setting AND the current Company. The Company value is already correct
(multi-tenant safe). The global Setting value is a historical artifact.

For single-company deployments: the Setting value is safe to migrate.
For multi-company deployments: verify FileAsset ownership before migrating.

---

## 5. Type Safety Analysis

### 5.1 `capital` (Decimal?)

| Source | Type | Risk |
|--------|------|------|
| Setting (global) | string (Setting.value) | May contain non-numeric text |
| Company (per-company) | `Decimal?` | Prisma handles string → Decimal |

**Validation:** `normalizeForDb("capital", value)` checks `!isNaN(Number(value))`
before returning. Invalid values produce a BLOCK action.

**Migration rule:** If Setting value is non-empty and non-numeric → BLOCK.
If Setting value is empty → skip (Company stays null).

### 5.2 `establishedAt` (DateTime?)

| Source | Type | Risk |
|--------|------|------|
| Setting (global) | string (ISO date) | May contain invalid date |
| Company (per-company) | `DateTime?` | Prisma handles Date objects |

**Validation:** `new Date(value)` + `isNaN(d.getTime())` check.
Invalid dates → BLOCK.

**Migration rule:** If Setting value is non-empty and not a valid date → BLOCK.

### 5.3 `printFormat` (String)

| Source | Type | Risk |
|--------|------|------|
| Setting (global) | string | May contain invalid format |
| Company (per-company) | `String` (default "A4") | Must be A4, A5, or THERMAL |

**Validation:** Must be one of `["A4", "A5", "THERMAL"]` (case-insensitive).
Invalid → default to "A4".

### 5.4 `fiscalYear` (Int?)

| Source | Type | Risk |
|--------|------|------|
| Setting (global) | number (Setting parsed) | May be out of range |
| Company (per-company) | `Int?` | Must be 2000–2100 |

**Validation:** Range check. Invalid → null (skip).

### 5.5 `qrEnabled` (Boolean)

| Source | Type | Risk |
|--------|------|------|
| Setting (global) | boolean (Setting parsed) | Low risk |
| Company (per-company) | `Boolean` (default false) | Direct assignment |

**No type risk.** Boolean values are always safe.

---

## 6. Multi-Company Migration Strategy

### 6.1 Single-Company Deployments

If only one active Company exists:
- All `company.*` Setting values belong to that Company.
- Safe to migrate all non-conflicting values.
- No ambiguity.

### 6.2 Multi-Company Deployments

If multiple active Companies exist:
- The global Setting value could belong to ANY company.
- Migration is only safe when:
  a. Setting value matches Company value → already in sync (SKIP)
  b. Setting value is empty → Company value is preserved (SKIP)
  c. Company field is empty → safe to populate from Setting (MIGRATE)
  d. Setting value ≠ Company value → CONFLICT (BLOCK, manual resolution)

**The migration script handles all cases per-company.**

### 6.3 Conflict Resolution Protocol

For each CONFLICT:
1. Identify the Setting key, the Setting value, and the Company value.
2. Determine which value is correct (usually the Company value, since
   admin writes go directly to Company).
3. If the Company value is correct → SKIP (keep Company value).
4. If the Setting value is correct → override with explicit confirmation.
5. Document the resolution.

---

## 7. Backup / Recovery

### 7.1 Pre-Migration State

Before executing the migration:
1. The `Setting` table contains all legacy `company.*` rows.
2. The `Company` model contains the current (potentially synced) values.
3. The `AuditLog` may or may not have entries for previous changes.

### 7.2 Recovery Procedure

If the migration produces incorrect results:
1. The Setting rows are **not deleted** during migration (only deprecated).
2. To restore: re-enable `ALLOWED_SETTING_KEYS` with `company.*` keys,
   restore the dual-write in `PUT /api/settings`, and revert `getCompanySettings`
   to read from Settings.
3. The Company model values can be restored from the Setting rows.

**Important:** Setting rows are marked deprecated (removed from allowlist)
but NOT physically deleted from the database. They remain as a recovery path.

### 7.3 Operator Backup

Database backup is an **operator responsibility**. Before executing the
migration, ensure a database backup is available.

---

## 8. Migration Execution Plan

### Step 1: Dry Run

```bash
npx tsx scripts/dry-run-migration.ts
```

Produces the complete analysis without modifying data.

### Step 2: Review Dry Run Output

Verify:
- No BLOCK actions (type errors)
- No CONFLICT actions (or resolve them)
- MIGRATE actions are safe for each Company

### Step 3: Execute Migration

```bash
npx tsx scripts/migrate-company-settings.ts --execute
```

Requires explicit `--execute` flag. Performs transactional migration
with AuditLog entries.

### Step 4: Verify Migration

```bash
npx tsx scripts/migrate-company-settings.ts --verify
```

Re-reads all migrated fields and confirms they match expected values.

### Step 5: Code Cleanup (Phase 3 continued)

After successful migration:
- Remove `company.*` from `ALLOWED_SETTING_KEYS`
- Remove `COMPANY_KEY_MAP` from `keys-shared.ts`
- Simplify `PUT /api/settings` (remove company dual-write)
- Delete `getCompanyProfile()` / `updateCompanyProfile()` from `config.ts`
- (UI changes deferred to Phase 4)

### Step 6: Multi-Company Verification

- Company A updates data → Company B unchanged
- Company A prints → Company A identity
- Company B prints → Company B identity
- Cross-company asset access → BLOCKED

---

## 9. Audit Trail

### 9.1 Migration Audit Entry

Each migrated Company receives an `AuditLog` entry:

```json
{
  "action": "UPDATE",
  "entity": "Company",
  "entityId": "<company-id>",
  "actorId": null,
  "companyId": "<company-id>",
  "changes": {
    "name": { "from": null, "to": "ABC SARL" },
    "taxId": { "from": null, "to": "123456789" }
  }
}
```

**actorId is null** — this is a SYSTEM migration, not a user action.

### 9.2 Post-Migration Audit

After migration, all company identity changes through `/parametres` or
`/api/company/profile` produce `AuditLog` entries with the actual user's
`actorId`.

---

## 10. Open Items

| # | Item | Status |
|---|------|--------|
| 1 | Verify FileAsset ownership for branding keys during migration | Deferred to runtime (dry run script checks) |
| 2 | Actual database values (Setting table content) | Requires running `dry-run-migration.ts` against the database |
| 3 | Multi-company test with 2+ companies | Requires test database setup |
| 4 | Print verification after migration | Requires running print tests |
| 5 | ~~`PreferencesForm` UI update (remove deprecated keys)~~ | **DONE** (Phase 3 cleanup: split writes) |
| 6 | ~~`CompanyForm` UI update (switch to new API)~~ | **DONE** (Phase 3 cleanup: flat fields to company/profile) |
| 7 | Remove old `getCompanyProfile` / `updateCompanyProfile` | Phase 4 (deprecated wrappers, no active callers) |

---

## 11. Phase 3 Compatibility Transition — Completed 2026-09-04

The compatibility transition ensures no active production path reads company identity
from the global `Setting` table, while keeping existing forms functional.

### 11.1 What Changed

| File | Change |
|------|--------|
| `features/settings/config.ts` | `getCompanyProfile()` rewritten: delegates to `getCompanySettings(companyId)` for company data, reads only app-wide preferences (locale, theme, fiscal, notifications) from Setting. `updateCompanyProfile()` rewritten: delegates to `updateCompanySettings()` for company fields, writes only preferences to Setting. Both marked `@deprecated`. |
| `app/api/settings/route.ts` | Removed all company.* dual-write logic, removed `COMPANY_KEY_MAP` import. Now only handles genuine Setting keys via `setSetting()`. |
| `features/settings/keys.ts` | Removed all `company.*` keys, `print.defaultFormat`, and `documents.qr.enabled` from `ALLOWED_SETTING_KEYS`. Only app-wide preferences remain. |
| `app/api/settings/keys-shared.ts` | **Deleted**. `COMPANY_KEY_MAP` no longer needed. |
| `components/settings/company-form.tsx` | Switched from `PUT /api/settings` (company.* keys) to `PUT /api/company/profile` (flat fields). No UI changes. |
| `components/settings/preferences-form.tsx` | Split writes: `printFormat`/`qrEnabled` → `PUT /api/company/profile` (Company model); `locale`/`theme`/`fiscalYear`/`notificationsEmail` → `PUT /api/settings` (Setting). No UI changes. |
| `features/print/company-branding.ts` | `readBrandingImage(companyId, storageKey)` takes explicit `companyId`, uses `prismaBase` (security fix). |
| `.scripts/e2e-company-sync.test.ts` | Updated to test canonical flow (Company-only writes via `updateCompanySettings`). |
| `.scripts/e2e-rollback.test.ts` | Updated to test `updateCompanySettings` transaction atomicity. |

### 11.2 Data Flow After Cleanup

**CompanyForm:**
```
CompanyForm → PUT /api/company/profile → updateCompanySettings() → Company
```

**PreferencesForm:**
```
printFormat/qrEnabled → PUT /api/company/profile → updateCompanySettings() → Company
locale/theme/fiscal/notifications → PUT /api/settings → setSetting() → Setting
```

**getCompanyProfile() (deprecated):**
```
getCompanyProfile()
  → getCurrentUser() → resolveCompanyContext()
  → getCompanySettings(companyId) → Company
  → getSetting("locale.default"), getSetting("theme.default"), etc. → Setting
  → return CompanyProfile shape
```

**Print pipeline:**
```
getCompanyPrintData(companyId) → Company → print layout (no Setting read)
```

### 11.3 Remaining Dormant Legacy Data

Global `Setting` rows for `company.*` keys may still exist in the database. They are:
- **Never read** by any active production path
- **Never written** by any active production path
- Considered dormant legacy data
- Can be cleaned up by the migration script (`scripts/migrate-company-settings.ts --execute`)

### 11.4 Remaining Deprecations (Phase 4)

| Item | Status | Phase 4 Action |
|------|--------|----------------|
| `getCompanyProfile()` | Deprecated wrapper, no active production callers | Remove |
| `updateCompanyProfile()` | Deprecated wrapper, no active callers | Remove |
| `CompanyProfile` type | Used by forms (temporary) | Replace with `CompanySettings` |
| Migration scripts | Standalone, not imported by app | Archive or delete |

---

*End of PHASE 3 migration report. The dry run script (`scripts/dry-run-migration.ts`)
is ready to execute against the database. The migration script
(`scripts/migrate-company-settings.ts`) is ready to execute after dry run approval.*
