# Company Settings — Audit (PHASE 1)

> Date: 2026-09-04 · Scope: read-only audit, **no code was modified**.
> Goal: map every source of company/identity/print data, identify source-of-truth
> conflicts, multi-company risks, print risks, migration risks and RBAC risks,
> and propose a target architecture to be finalized in PHASE 2.

---

## 1. Executive Summary

DzERP carries **two independent sources of truth for company identity data**:

1. The Prisma `Company` model — per-company, company-scoped, canonical. Used by the
   **print engine** (`getCompanyPrintData`) and by the **platform administrator**
   (`/admin/companies`).
2. The global `Setting` table — a **single flat key/value store NOT scoped by company**.
   Read/written by the **user-facing `/parametres`** pages via `getCompanyProfile()` /
   `PUT /api/settings`.

Because the `Setting` table has **no `companyId`**, user edits to `company.*` keys in
`/parametres` are written both:
- to a **single global row** (shared across ALL companies), and
- to the **current user's** `Company` row (correct, per-company).

Yet `getCompanyProfile()` reads **only from the global `Setting` table**, so a company A
user editing `company.name` makes `company.name` (global) = A, and a company B user's
`/parametres` page then shows **A's name**. This is a **confirmed multi-company data leak**.

The print engine (the closest thing to a "correct" consumer) reads `Company` only — so
print output is company-correct, but it is **disconnected from the UI source**. The user
sees one set of values in `/parametres` and a different set on the printed document.

This duplication, plus a disconnected print-format preference and several minor defects,
is what PHASE 2–7 will consolidate.

---

## 2. Current Architecture

```
                            ┌────────────────────────────────────────────┐
                            │  Setting  (GLOBAL — no companyId)          │
                            │  company.* keys  +  preference keys        │
                            └────────────────┬───────────────────────────┘
                                             │ read (getCompanyProfile)
   /parametres (user UI)      ┌──────────────▼──────────────────┐
   └ CompanyForm/Preferences ──►  PUT /api/settings             │
                                │   - writes Setting (global)   │
                                │   - + current Company row     │
                                └───────────────────────────────┘

   /admin/companies (SUPER_ADMIN)
   └ company-admin service ──► Company model (per-company, direct)

   Print/PDF (documents)
   └ getCompanyPrintData(companyId) ──► Company model (per-company, direct)
```

Key property: **`Setting` is a global singleton store**, while `Company` is the
multi-tenant row. The two read paths disagree, which is the root defect.

---

## 3. Data Sources (verified)

| Layer        | Reads company identity from      | Writes company identity to        |
|--------------|----------------------------------|-----------------------------------|
| `/parametres` home + Preferences | Global `Setting` via `getCompanyProfile()` (`features/settings/config.ts:162`) | Global `Setting` via `PUT /api/settings` (`api/settings/route.ts:109`) **and** current `Company` row |
| Platform admin (`/admin/companies`) | `Company` model (`company-admin/service.ts`) | `Company` model (`companyUpdateSchema`, `PATCH /api/admin/companies/[id]`) |
| Print/PDF (`documents/[id]/pdf`) | `Company` model only (`print/company-branding.ts:61`) | — (read-only) |
| Payroll slip PDF | `Company` model (direct read)    | — (read-only)                    |

---

## 4. `company.*` Key Inventory (`features/settings/keys.ts:7-54`)

All `company.*` keys below are dual-sourced (global `Setting` + `Company` row).

| Key | Company column (via `COMPANY_KEY_MAP`, `api/settings/keys-shared.ts`) | Type in UI (`CompanyProfile`) | Type in DB (`Company`) |
|-----|------------------------------------------|------------------|------------------|
| `company.name` | `name` | string | string |
| `company.nameAr` | `nameAr` | string | string |
| `company.legalName` | `legalName` | string | string |
| `company.legalForm` | `legalForm` | string | string |
| `company.capital` | `capital` | **string** | **Decimal?** ⚠️ |
| `company.activity` | `activity` | string | string |
| `company.secondaryActivity` | `secondaryActivity` | string | string |
| `company.establishedAt` | `establishedAt` | string (ISO) | DateTime? (parsed in route :93-98) |
| `company.taxId` | `taxId` | string | string |
| `company.rc` | `rc` | string | string |
| `company.nis` | `nis` | string | string |
| `company.ai` | `ai` | string | string |
| `company.vatNumber` | `vatNumber` | string | string |
| `company.country` | `country` | string | string |
| `company.wilaya` | `wilaya` | string | string |
| `company.commune` | `commune` | string | string |
| `company.postalCode` | `postalCode` | string | string |
| `company.address` | `address` | string | string |
| `company.phone` | `phone` | string | string |
| `company.mobile` | `mobile` | string | string |
| `company.email` | `email` | string | string |
| `company.website` | `website` | string | string |
| `company.bank` | `bank` | string | string |
| `company.bankAgency` | `bankAgency` | string | string |
| `company.bankAccount` | `bankAccount` | string | string |
| `company.rib` | `rib` | string | string |
| `company.iban` | `iban` | string | string |
| `company.swift` | `swift` | string | string |
| `company.logoKey` | `logoKey` | string | string |
| `company.stampKey` | `stampKey` | string | string |
| `company.signatureKey` | `signatureKey` | string | string |
| `company.primaryColor` | `primaryColor` | string | string |
| `company.printHeader` | `printHeader` | string | string |
| `company.invoiceFooter` | `invoiceFooter` | string | string |
| `company.printFormat` | `printFormat` | string | string |
| `company.currency` | `currency` | string | string |

### Preference (non-company) keys also in the same global store
`fiscal.year`, `locale.default`, `theme.default`, `notifications.email`,
`print.defaultFormat`, `documents.qr.enabled`, `onboarding.dismissed`,
`tax.rates`, `currency.list`, `units.list`.

---

## 5. Source-of-Truth Conflicts

### 5.1 Company identity — TWO sources (CRITICAL)
`Company` model vs global `Setting`. `getCompanyProfile()` reads `Setting`;
print + admin read `Company`. The two can and do disagree.

### 5.2 Print format — DISCONNECTED (HIGH)
- User picks **A5/THERMAL** in `/parametres/preferences` → writes `print.defaultFormat`
  (`components/settings/preferences-form.tsx:57`).
- Print engine reads **`company.printFormat`** (`print/company-branding.ts:102-105`).
- `company.printFormat` is only written by the **CompanyForm** submit + admin.
- **Result:** the preference has no effect on printed output.

### 5.3 QR — read but never rendered (MEDIUM)
- `qrEnabled` surfaced in UI via `documents.qr.enabled`
  (`getCompanyProfile`, config.ts:259 → index 41).
- Print reads `company.qrEnabled` (company-branding.ts:110) but **no template renders a QR**.
- `qrEnabled` is effectively dead.

### 5.4 `printFormatted`/`printMargins`/`paymentTerms`/`emailFooter` — admin-only (MEDIUM)
These live only on `Company` and are editable only via `/admin/companies`. They are
never exposed in the user-facing `/parametres`, so the real print config is invisible
to the company user who needs it.

---

## 6. Multi-company Risks (verified evidence)

| # | Risk | Evidence | Severity |
|---|------|----------|----------|
| 1 | **Global `Setting` store leaks across companies.** `Setting` has no `companyId` (`schema.prisma:455-467`); `server.ts:36` reads a single global row per key. `getCompanyProfile()` (used by `/parametres`) reads only this global store. A company A edit becomes visible to company B. | `features/settings/server.ts:36`; `api/settings/route.ts:109-127`; `features/settings/config.ts:162-261` | 🔴 CRITICAL |
| 2 | `PUT /api/settings` writes `company.*` to global Setting AND to the *session* company. Under multi-company, the Setting write is wrong (global); only the Company write is correct. | `api/settings/route.ts:100-137` | 🔴 CRITICAL |
| 3 | **Latent print coupling:** `readBrandingImage` looks up FileAssets via the **session-scoped** `prisma` extension, not the `companyId` argument. Safe today because the session company == document company (enforced at `map-document.ts:176-178`), but unsafe if `getCompanyPrintData(otherCompanyId)` is ever called outside the active context — logo/stamp/signature would resolve to the wrong company or fail-closed. | `print/company-branding.ts:40-55, 66-70` | 🟠 HIGH (latent) |
| 4 | FileAsset is company-scoped (`companyId` required, in `COMPANY_SCOPED_MODELS`) — this part is correct. | `schema.prisma:511-530`; `lib/db/company-scope.ts` | ✅ OK |

---

## 7. Print Risks

| # | Risk | Evidence | Severity |
|---|------|----------|----------|
| 1 | Printed data comes from `Company`, but the UI edits `Setting` → documents show data the user didn't see/save. | `company-branding.ts:61` vs `config.ts:162` | 🔴 CRITICAL |
| 2 | `printFormat` preference disconnected (see §5.2). | `preferences-form.tsx:57` vs `company-branding.ts:102-105` | 🟠 HIGH |
| 3 | `capital` typed as **string** in `CompanyProfile`/UI but **Decimal?** on `Company`. A non-numeric string can fail on save/print. | `config.ts:57, 220`; `schema.prisma` (capital) | 🟠 HIGH |
| 4 | `legalName`, `postalCode`, `country`, `mobile`, `website`, `commercialName` are read into `PrintCompany` but **not rendered** in templates. | `company-branding.ts:77-93`; templates | 🟡 LOW |
| 5 | Historical documents are FK-bound to the live `Company` — nothing snapshots identity at issue time. (Deliberate, deferred.) | `map-document.ts` | 🟡 MEDIUM (architectural) |

**No `currentUser`/`manager` data is used as the issuer in print** — the print path is
company-correct. This is the part to preserve.

---

## 8. Migration Risks

| # | Risk | Note |
|---|------|------|
| 1 | Global `Setting` rows are shared; cannot be split per-company retroactively. | Migration must **not** try to deduce per-company values from a single global row for more than one company. |
| 2 | Do not delete `company.*` Setting rows before verifying `Company` columns are populated and correct. | See PHASE 3 ordering (validate → map → verify → deprecate). |
| 3 | `establishedAt` DateTime parsing, `capital` Decimal, `logoKey`/`stampKey`/`signatureKey` FK integrity must each be validated. | `api/settings/route.ts:92-98` shows current fragile parse. |
| 4 | Migration must be idempotent + rerunnable + transactional where possible. | PHASE 3. |
| 5 | Admin writes to `Company` directly today; after migration `/parametres` also writes `Company` — no field/format drift. | Validate `capital` Decimal conversion on both paths. |

---

## 9. RBAC & Security Risks

| # | Risk | Evidence | Severity |
|---|------|----------|----------|
| 1 | `PUT /api/settings` (incl. `company.*`) requires only `parametres.manage` — any role with this permission can overwrite global settings. (Allowlist mitigates arbitrary keys, but company identity is still in the global store.) | `api/settings/route.ts:49-74` | 🟠 MEDIUM |
| 2 | `PUT /api/settings` writes **no AuditLog**. Changing NIF/RIB/address is un-logged. | route.ts GET/PUT | 🟠 HIGH |
| 3 | `PATCH /api/admin/companies/[id]` — is it audited? (admin routes call `requestMeta`; verify full audit coverage in PHASE 7.) | `api/admin/companies/[companyId]/route.ts:52-57` | 🟡 to verify |
| 4 | **No cache** anywhere for settings/company/print (single `React.cache` at `company/context.ts:65` is per-request). No `revalidateTag`/`revalidatePath`. → **No cache invalidation is currently needed**; if we add caching in PHASE 7 we must add invalidation at write sites. | explored | ✅ OK now |
| 5 | Uploads: optional `entity`/`entityId` are unvalidated free strings; MIME is client-declared (no magic-byte check); `octet-stream` allowed. `sanitizeStorageKey` blocks traversal. | `api/upload/route.ts:22-56`; `upload/storage.ts` | 🟡 MEDIUM (hardening) |

---

## 10. Recommended Target Architecture (direction — detailed in PHASE 2)

```
Company (Master Data, canonical, per-company row)
   │
   ├── getCompanyProfileService()   ── server service, company-scoped
   │        │
   │        ▼
   │   PUT /api/company/profile     ── new endpoint (guard + validate + AUDIT)
   │        │
   │        └───► /parametres UI (Tabs)

Company
   │
   └── getCompanyPrintProfile(companyId)  ── print service (company-scoped)
            │
            ▼
        Document ──► Template ──► Renderer ──► PDF
        (document.companyId, never currentUser)

Setting   ──► Configuration / Behaviour / Preferences ONLY
User Settings ──► per-user preferences (locale, theme, fiscal year, notifications)
Document Snapshot ──► historical record (deferred / optional)
```

**Principles locked in:**
- `Company` = single source of truth for identity/master/print/branding data.
- `Setting` = global configuration & behaviour only (no per-company identity).
- Print depends only on `document.companyId → CompanyProfileService → CompanyPrintProfile`; never on `currentUser`, never on global `Setting`.
- Keep the existing print engine, `Company` model, RBAC, multi-company infra — **no rebuild**.

---

## 11. Open Items / To Confirm

- Exact total of user-facing `/parametres` sub-pages: home, preferences, branches,
  currencies, numbering, referentiels, taxes, units (verified).
- Whether admin company PATCH is fully audited (to confirm in PHASE 7).
- Whether `qrEnabled` rendering is desired (design decision for PHASE 4–5).
- Whether `emailFooter`/`paymentTerms`/`printMargins` should be exposed in `/parametres` (PHASE 4).

---

*End of PHASE 1 audit. STOP — no code changed. PHASE 2 (target architecture) is next after review.*
