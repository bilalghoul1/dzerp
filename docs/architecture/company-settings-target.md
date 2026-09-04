# Company Settings — Target Architecture (PHASE 2)

> Date: 2026-09-04 · Scope: architecture design only, **no code was modified**.
> Input: `docs/architecture/company-settings-audit.md` (PHASE 1).
> Goal: define the definitive target architecture, ownership matrix, API contracts,
> migration strategy, and UI design for the Company Settings consolidation.

---

## 1. Executive Summary

DzERP has two independent sources of truth for company identity: the per-company
Prisma `Company` model and the global `Setting` key/value table. The user-facing
`/parametres` pages read from the global `Setting` store (`getCompanyProfile()`),
while the print engine and platform admin read from the per-company `Company` model.
This causes:

- **Multi-company data leak**: company A's edits become visible to company B in the UI.
- **Print/UI desync**: the user edits data in `/parametres` that the print engine never sees.
- **Disconnected preferences**: `print.defaultFormat` (in Settings) doesn't reach `company.printFormat` (read by print).
- **No audit trail** for identity changes.

The target architecture eliminates this by making `Company` the **sole source of truth**
for all company identity, legal, commercial, contact, branding, and print configuration
data. The `Setting` table retains only app-wide configuration and per-user preferences.
A new `PUT /api/company/profile` endpoint replaces the dual-write in `PUT /api/settings`.

**No new Prisma model is needed.** The existing `Company` model already contains every
field required for identity, configuration, and print. The consolidation is a
**data-routing refactor**, not a schema change.

---

## 2. Architectural Principles

1. **`Company` = Master Data.** Single source of truth for who this company is,
   how it appears on documents, and how it configures document generation.
2. **`Setting` = App-wide Configuration.** Global behaviour defaults, locale, theme,
   and lookups (tax rates, currencies, units). NEVER company identity.
3. **User Settings = User Preferences.** Per-user, per-session. Locale, theme, notifications.
   Live in `Setting` (already scoped by user read).
4. **Document Snapshot = Historical Record.** Deferred to a future phase. Documents
   currently read live `Company` data via FK. This is documented as an accepted risk
   with a clear future mitigation path.
5. **`companyId` is explicit.** Every company-scoped operation must have a verified
   `companyId` derived from the authenticated session context — never from a global row.
6. **No dual source-of-truth.** After migration, each piece of data lives in exactly
   one place. No bidirectional sync.
7. **No rebuild.** Preserve the existing Company model, print engine, RBAC, multi-company
   infrastructure, and DocumentSeries. Change only the data-routing layer.
8. **Audit all identity changes.** Company identity changes produce an `AuditLog` entry.

---

## 3. Ownership Matrix

### 3.1 `company.*` Keys — Full Inventory

Every key currently in `ALLOWED_SETTING_KEYS` that starts with `company.` is classified
below. Classification is based on what the key **represents**, not what table it
currently lives in.

| # | Setting Key | Classification | Target Owner | Reason | Current Consumers | Target Consumers |
|---|------------|----------------|--------------|--------|-------------------|------------------|
| 1 | `company.name` | **A — Master Data** | `Company.name` | Company's trade name | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 2 | `company.nameAr` | **A — Master Data** | `Company.nameAr` | Arabic trade name | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 3 | `company.legalName` | **A — Master Data** | `Company.legalName` | Official legal name | getCompanyProfile, admin | getCompanySettings, print, admin |
| 4 | `company.legalForm` | **A — Master Data** | `Company.legalForm` | Legal structure (SARL, etc.) | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 5 | `company.capital` | **A — Master Data** | `Company.capital` | Share capital | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 6 | `company.activity` | **A — Master Data** | `Company.activity` | Business activity description | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 7 | `company.secondaryActivity` | **A — Master Data** | `Company.secondaryActivity` | Secondary activity | getCompanyProfile, admin | getCompanySettings, admin |
| 8 | `company.establishedAt` | **A — Master Data** | `Company.establishedAt` | Founding date | getCompanyProfile, admin | getCompanySettings, admin |
| 9 | `company.taxId` | **A — Master Data** | `Company.taxId` | NIF (tax identifier) | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 10 | `company.rc` | **A — Master Data** | `Company.rc` | Registre du Commerce | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 11 | `company.nis` | **A — Master Data** | `Company.nis` | NIS identifier | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 12 | `company.ai` | **A — Master Data** | `Company.ai` | AI identifier | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 13 | `company.vatNumber` | **A — Master Data** | `Company.vatNumber` | TVA registration number | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 14 | `company.country` | **A — Master Data** | `Company.country` | Country code | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 15 | `company.wilaya` | **A — Master Data** | `Company.wilaya` | Wilaya code | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 16 | `company.commune` | **A — Master Data** | `Company.commune` | Commune code | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 17 | `company.postalCode` | **A — Master Data** | `Company.postalCode` | Postal code | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 18 | `company.address` | **A — Master Data** | `Company.address` | Street address | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 19 | `company.phone` | **A — Master Data** | `Company.phone` | Primary phone | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 20 | `company.mobile` | **A — Master Data** | `Company.mobile` | Mobile phone | getCompanyProfile, admin | getCompanySettings, print, admin |
| 21 | `company.email` | **A — Master Data** | `Company.email` | Contact email | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 22 | `company.website` | **A — Master Data** | `Company.website` | Website URL | getCompanyProfile, admin | getCompanySettings, admin |
| 23 | `company.bank` | **A — Master Data** | `Company.bank` | Bank name | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 24 | `company.bankAgency` | **A — Master Data** | `Company.bankAgency` | Bank branch | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 25 | `company.bankAccount` | **A — Master Data** | `Company.bankAccount` | Account number | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 26 | `company.rib` | **A — Master Data** | `Company.rib` | RIB key | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 27 | `company.iban` | **A — Master Data** | `Company.iban` | IBAN | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 28 | `company.swift` | **A — Master Data** | `Company.swift` | SWIFT/BIC code | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 29 | `company.logoKey` | **A — Master Data** | `Company.logoKey` | Logo storage key | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 30 | `company.stampKey` | **A — Master Data** | `Company.stampKey` | Stamp image key | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 31 | `company.signatureKey` | **A — Master Data** | `Company.signatureKey` | Signature image key | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 32 | `company.primaryColor` | **A — Master Data** | `Company.primaryColor` | Print brand color | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 33 | `company.printHeader` | **A — Master Data** | `Company.printHeader` | PDF header text | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 34 | `company.invoiceFooter` | **A — Master Data** | `Company.invoiceFooter` | PDF footer text | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 35 | `company.printFormat` | **B — Company Config** | `Company.printFormat` | Default paper size (A4/A5/THERMAL) | getCompanyProfile, print, admin | getCompanySettings, print, admin |
| 36 | `company.currency` | **B — Company Config** | `Company.currency` | Default currency code | getCompanyProfile, print, admin | getCompanySettings, print, admin |

### 3.2 Non-`company.*` Keys

| # | Setting Key | Classification | Target Owner | Reason |
|---|------------|----------------|--------------|--------|
| 37 | `fiscal.year` | **C — User/Company Pref** | `Company.fiscalYear` (move to Company) | Fiscal year is company-scoped, not user-scoped. Already exists on Company model. |
| 38 | `locale.default` | **C — User Preference** | `Setting` (keep) | App-wide default locale for unauthenticated / new users. |
| 39 | `theme.default` | **C — User Preference** | `Setting` (keep) | App-wide default theme. |
| 40 | `notifications.email` | **C — User Preference** | `Setting` (keep) | App-wide default. |
| 41 | `print.defaultFormat` | **D — Deprecated** | Remove | Duplicate of `company.printFormat`. Owned by Company. No migration needed. |
| 42 | `documents.qr.enabled` | **B — Company Config** | `Company.qrEnabled` (already exists) | Duplicate of `Company.qrEnabled`. |
| 43 | `onboarding.dismissed` | **C — User Preference** | `Setting` (keep) | Per-user flag. |
| 44 | `tax.rates` | **B — App Config** | `Setting` (keep) | Global tax rate definitions (shared reference, not company-specific). |
| 45 | `currency.list` | **B — App Config** | `Setting` (keep) | Global currency list. |
| 46 | `units.list` | **B — App Config** | `Setting` (keep) | Global unit definitions. |

### 3.3 Classification Summary

| Class | Count | Action |
|-------|-------|--------|
| **A — Master Data** (→ Company) | 34 keys | Remove from Setting; read/write Company directly |
| **B — Company Config** (→ Company) | 3 keys (`printFormat`, `currency`, `documents.qr.enabled`) | Same: Company already has these fields |
| **C — User/Company Preference** | 5 keys | `fiscal.year` → Company; 3 stay in Setting; 1 per-user |
| **D — Deprecated** | 1 key (`print.defaultFormat`) | Remove after migration |

**Net result:** 37 `company.*` keys are removed from the Setting store.
3 global preference keys remain. `print.defaultFormat` and `documents.qr.enabled` are deprecated.

---

## 4. Company Identity Model

### 4.1 Canonical Types

The `Company` model is the canonical store. No conversion is needed for database
storage — values are written as the Prisma schema specifies.

| Field | DB Type (Prisma) | Domain Type | API Response Type | UI Form Type | Validation |
|-------|------------------|-------------|-------------------|-------------|------------|
| `name` | `String` (required) | `string` | `string` | `<input>` (required) | Non-empty after trim |
| `nameAr` | `String?` | `string \| null` | `string \| null` | `<input dir="rtl">` | Optional |
| `legalName` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `legalForm` | `String?` | `string \| null` | `string \| null` | `<Select>` (from lookups) | Optional |
| `capital` | `Decimal?` | `string \| null` | `string \| null` | `<input type="number">` | Numeric or empty; parse as `Decimal` on write |
| `activity` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `secondaryActivity` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `establishedAt` | `DateTime?` | `string \| null` (ISO) | `string \| null` (ISO) | `<input type="date">` | Valid ISO date or empty |
| `taxId` (NIF) | `String?` | `string \| null` | `string \| null` | `<input>` | Optional; no format enforcement |
| `rc` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `nis` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `ai` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `vatNumber` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `address` | `String?` | `string \| null` | `string \| null` | `<textarea>` | Optional |
| `country` | `String?` | `string \| null` | `string \| null` | `<Select>` (from lookups) | Optional; defaults to `"DZ"` |
| `wilaya` | `String?` | `string \| null` | `string \| null` | `<Select>` (from lookups) | Optional |
| `commune` | `String?` | `string \| null` | `string \| null` | `<Select>` (filtered by wilaya) | Optional |
| `postalCode` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `phone` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `mobile` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `email` | `String?` | `string \| null` | `string \| null` | `<input type="email">` | Optional; basic email format if non-empty |
| `website` | `String?` | `string \| null` | `string \| null` | `<input type="url">` | Optional; URL format if non-empty |
| `bank` | `String?` | `string \| null` | `string \| null` | `<Select>` (from lookups) | Optional |
| `bankAgency` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `bankAccount` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `rib` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional; 20-digit format if non-empty |
| `iban` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `swift` | `String?` | `string \| null` | `string \| null` | `<input>` | Optional |
| `logoKey` | `String?` | `string \| null` | `string \| null` | File upload | Optional |
| `stampKey` | `String?` | `string \| null` | `string \| null` | File upload | Optional |
| `signatureKey` | `String?` | `string \| null` | `string \| null` | File upload | Optional |
| `primaryColor` | `String?` | `string \| null` | `string \| null` | Color picker + hex input | Optional; valid hex if non-empty |
| `secondaryColor` | `String?` | `string \| null` | `string \| null` | Color picker + hex input | Optional; valid hex if non-empty |
| `printHeader` | `String?` | `string \| null` | `string \| null` | `<textarea>` | Optional |
| `invoiceFooter` | `String?` | `string \| null` | `string \| null` | `<textarea>` | Optional |
| `printFormat` | `String` (default "A4") | `string` | `string` | `<Select>` (A4/A5/THERMAL) | One of `["A4","A5","THERMAL"]` |
| `qrEnabled` | `Boolean` (default false) | `boolean` | `boolean` | `<Switch>` | Boolean |
| `paymentTerms` | `String?` | `string \| null` | `string \| null` | `<textarea>` | Optional |
| `emailFooter` | `String?` | `string \| null` | `string \| null` | `<textarea>` | Optional |
| `printMargins` | `Json?` | `{top,right,bottom,left:number} \| null` | `object \| null` | Advanced settings | Object with 4 finite numbers or null |
| `currency` | `String` (default "DZD") | `string` | `string` | `<Select>` (from currencies) | One of configured currencies |
| `fiscalYear` | `Int?` | `number \| null` | `number \| null` | `<input type="number">` | 2000–2100 or empty |
| `language` | `String` (default "fr") | `string` | `string` | `<Select>` (fr/ar/en) | One of `["fr","ar","en"]` |

### 4.2 Type Normalization Boundaries

**`capital` (Decimal ↔ string):**
- DB: `Decimal?` (Prisma handles serialization)
- API: `"100000"` or `null` (string representation of the decimal)
- UI form: `<input type="number">` → user types `100000` → sent as string `"100000"` → server parses to `Decimal`
- Print: `String(company.capital)` (already handled at `company-branding.ts:100`)
- **Conversion**: On write: `value.trim() === "" ? null : new Prisma.Decimal(value)`. On read: `String(company.capital)`.

**`establishedAt` (DateTime ↔ ISO string):**
- DB: `DateTime?`
- API: ISO string `"2020-01-15"` or `null`
- UI: `<input type="date">` → `YYYY-MM-DD`
- **Conversion**: On write: `value ? new Date(value) : null`, with NaN check. On read: `company.establishedAt?.toISOString() ?? null`.

**`printMargins` (Json ↔ object):**
- DB: `Json?`
- API: `{ top: 10, right: 10, bottom: 10, left: 10 }` or `null`
- **Conversion**: Already handled by Prisma. Print: `parseMargins(company.printMargins)` (already exists).

**`fiscalYear` (Int ↔ number):**
- DB: `Int?`
- API: `number | null`
- **Conversion**: Direct. Validate 2000–2100 range.

### 4.3 Fields Not Exposed in Current UI (exist on Company model)

These fields are on the `Company` model but NOT currently shown in `/parametres`:

| Field | Already on Company? | Exposed in `/parametres`? | Action |
|-------|-------------------|-------------------------|--------|
| `commercialName` | ✅ Yes | ❌ No | Expose in CompanyForm (PHASE 4) |
| `secondaryColor` | ✅ Yes | ❌ No | Expose in branding tab (PHASE 4) |
| `language` | ✅ Yes | ❌ No (separate from locale pref) | Expose in print config tab (PHASE 4) |
| `type` | ✅ Yes | ❌ No | Expose in general tab (PHASE 4) |
| `notes` | ✅ Yes | ❌ No | Expose in general tab (PHASE 4) |
| `defaultBranchId` | ✅ Yes | ❌ No | Keep admin-only (operational) |
| `expiryDate` | ✅ Yes | ❌ No | Expose in general tab (PHASE 4) |
| `status` | ✅ Yes | ❌ No | Keep admin-only (operational) |
| `isDefault` | ✅ Yes | ❌ No | Keep admin-only |
| `isActive` | ✅ Yes | ❌ No | Keep admin-only |

---

## 5. Configuration Model

### 5.1 Company-scoped Configuration

All company-level configuration lives on the `Company` model. There is **no separate
`CompanyConfig` table** — the model already holds every configuration field needed:

| Config Category | Fields on Company | Currently in Setting? |
|----------------|-------------------|----------------------|
| Print format | `printFormat`, `printMargins`, `printHeader`, `invoiceFooter`, `paymentTerms`, `emailFooter` | `company.printFormat` (duplicate) |
| Document defaults | `qrEnabled`, `currency` | `documents.qr.enabled` (duplicate) |
| Fiscal | `fiscalYear` | `fiscal.year` (duplicate) |
| Language | `language` | Not in Settings (Company-only) |
| Branching | `defaultBranchId` | Not in Settings (admin-only) |

### 5.2 App-wide Configuration (stays in `Setting`)

| Key | Purpose | Scope |
|-----|---------|-------|
| `locale.default` | Default locale for new sessions | App-wide |
| `theme.default` | Default theme | App-wide |
| `notifications.email` | Default email notifications | App-wide |
| `tax.rates` | TVA rate definitions (JSON array) | App-wide reference data |
| `currency.list` | Supported currencies (JSON array) | App-wide reference data |
| `units.list` | Measurement units (JSON array) | App-wide reference data |

### 5.3 Deprecated Keys (remove after migration)

| Key | Deprecation Reason | Action |
|-----|-------------------|--------|
| `print.defaultFormat` | Duplicate of `company.printFormat` (Company) | Remove from `ALLOWED_SETTING_KEYS`; `PreferencesForm` stops writing it |
| `documents.qr.enabled` | Duplicate of `Company.qrEnabled` | Remove from `ALLOWED_SETTING_KEYS`; `PreferencesForm` stops writing it |
| All 36 `company.*` keys | Replaced by direct Company read | Remove from `ALLOWED_SETTING_KEYS` and `COMPANY_KEY_MAP` |

---

## 6. User Preference Model

User preferences stay in the `Setting` table (app-wide default) or could move to a
`UserPreference` model in the future. For this refactor:

| Preference | Current | Target | Notes |
|-----------|---------|--------|-------|
| `locale.default` | `Setting` | `Setting` (keep) | App-wide default |
| `theme.default` | `Setting` | `Setting` (keep) | App-wide default |
| `notifications.email` | `Setting` | `Setting` (keep) | App-wide default |
| `onboarding.dismissed` | `Setting` | `Setting` (keep) | Per-user flag |

The `PreferencesForm` will continue to read/write these via `PUT /api/settings`.
It will **stop** writing `print.defaultFormat` and `documents.qr.enabled` (both deprecated).

---

## 7. Historical Document Snapshot Model

### 7.1 Current State: NO SNAPSHOT

**Verified**: `Invoice`, `Quotation`, `DeliveryNote`, `CreditNote`, `PurchaseOrder`,
`GoodsReceipt`, `SupplierInvoice` — **none** have snapshot fields for company identity.
They reference `Company` via a `companyId` FK and read live data at print time.

```text
Document.companyId ──FK──► Company (live)
```

### 7.2 Risk Assessment

Changing `Company.name` or `Company.taxId` today silently rewrites the issuer identity
of all historical documents when reprinted. This is an **accepted architectural risk**
for this refactor.

**Why deferred:**
- Adding snapshot fields to 7+ document models requires a Prisma migration.
- The snapshot mechanism must be designed carefully (which fields, when captured, how reprints behave).
- This refactor focuses on making the **live source correct first**. A correct live source
  is a prerequisite for snapshot design.

### 7.3 Future Snapshot Architecture (design, not implemented)

```
Document
  ├── companyId          ──FK──► Company (for authorization)
  ├── companySnapshot    ──Json?── frozen CompanyIdentity at issuance time
  └── ...
```

**Snapshot fields (minimum):**
`name`, `nameAr`, `legalName`, `legalForm`, `taxId`, `rc`, `nis`, `ai`, `vatNumber`,
`address`, `wilaya`, `commune`, `phone`, `email`, `bank`, `rib`, `iban`,
`printHeader`, `invoiceFooter`, `primaryColor`, `logoKey`.

**Capture point:** When document status transitions from `DRAFT` to first non-draft status
(e.g., `SENT`, `CONFIRMED`, `ISSUED`).

**Print behavior:**
- `printDocument()` uses `CompanySnapshot` if present, falls back to live `Company`.
- `getCompanyPrintProfile(companyId, documentCompanySnapshot?)` accepts optional snapshot.

**This is NOT implemented in the current refactor. It is documented here as the
future mitigation for the historical document risk.**

---

## 8. Multi-Company Isolation

### 8.1 Core Invariant

```
Authenticated principal
        ↓
Authorized company context (via session.activeCompanyId)
        ↓
companyId (explicit, verified)
        ↓
Company-scoped query (via companyScope extension)
```

**Never:**
```
request
  ↓
global Setting row
  ↓
return data (cross-company leak)
```

### 8.2 What Changes

| Path | Before (leaks) | After (isolated) |
|------|----------------|------------------|
| `/parametres` reads | `getCompanyProfile()` → global `Setting` | `getCompanySettings(companyId)` → `Company` |
| `/parametres` writes | `PUT /api/settings` → global Setting + Company | `PUT /api/company/profile` → `Company` only |
| Print reads | `getCompanyPrintData(companyId)` → `Company` (OK) | Same (no change) |
| Admin reads | `getCompanyDetail(actor, companyId)` → `Company` (OK) | Same (no change) |
| `readBrandingImage` | session-scoped (latent risk) | explicit `companyId` + FileAsset validation |

### 8.3 Verification Requirement

After migration, a multi-company test must demonstrate:
```text
Company A edits "company.name" → "Foo A" in /parametres
Company B loads /parametres → sees "Foo B" (NOT "Foo A")
```

This test currently **fails**. After migration it must **pass**.

---

## 9. `getCompanyProfile()` Replacement

### 9.1 Current Problem

`getCompanyProfile()` (`features/settings/config.ts:162-261`):
- Reads **36 `company.*` keys from global `Setting`** (shared across all companies).
- Reads **6 preference keys from global `Setting`**.
- Returns a flat `CompanyProfile` with **37 identity fields + 6 preferences**.
- Used by: `/parametres/page.tsx`, `PreferencesForm`, `CompanyForm`.
- **Multi-company leak**: returns the last-written global value, not the active company's data.

### 9.2 Target: Two Replacing Functions

#### `getCompanySettings(companyId: string): Promise<CompanySettings>`

**Purpose:** Read all company identity + configuration data for the `/parametres` UI.

```text
Input:     companyId (string, from session context)
Auth:      Caller must have already resolved companyId from session (parametres.view)
Data:      prisma.company.findUnique({ where: { id: companyId } })
Output:    CompanySettings (all identity + config fields, string-normalized)
Errors:    throws if company not found
Ownership: Company (per-company, company-scoped)
```

**Output shape** (replaces `CompanyProfile`):
```ts
type CompanySettings = {
  // Identity
  name: string;           // required
  nameAr: string | null;
  commercialName: string | null;
  legalName: string | null;
  legalForm: string | null;
  capital: string | null;  // Decimal → string
  activity: string | null;
  secondaryActivity: string | null;
  establishedAt: string | null; // DateTime → ISO
  type: string | null;
  notes: string | null;
  // Legal / Tax
  taxId: string | null;
  rc: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  // Address
  country: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  address: string | null;
  // Contact
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  // Banking
  bank: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  rib: string | null;
  iban: string | null;
  swift: string | null;
  // Branding
  logoKey: string | null;
  stampKey: string | null;
  signatureKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  // Print configuration
  printFormat: string;       // default "A4"
  printHeader: string | null;
  invoiceFooter: string | null;
  paymentTerms: string | null;
  emailFooter: string | null;
  printMargins: object | null;
  qrEnabled: boolean;        // default false
  // Config
  currency: string;           // default "DZD"
  fiscalYear: number | null;
  language: string;           // default "fr"
  expiryDate: string | null;
  defaultBranchId: string | null;
  // Metadata
  isActive: boolean;
  isDefault: boolean;
};
```

#### `updateCompanySettings(companyId: string, input: Partial<CompanySettings>, actorId: string): Promise<void>`

**Purpose:** Write company identity + configuration. Validates, normalizes, and produces an AuditLog entry.

```text
Input:     companyId, partial input, actorId
Auth:      Caller must have parametres.manage for the company
Data:      prisma.company.update() + AuditLog.create()
Output:    void (throws on error)
Errors:    NOT_FOUND, VALIDATION, INTERNAL_ERROR
Transaction: Yes (Company update + AuditLog in same transaction)
```

**Validation rules:**
- `name`: required, non-empty after trim.
- `capital`: if non-empty, must parse as numeric → `Decimal`.
- `establishedAt`: if non-empty, must parse as valid Date → `DateTime`.
- `printFormat`: must be one of `["A4", "A5", "THERMAL"]`.
- `primaryColor`/`secondaryColor`: if non-empty, must match `/^#[0-9a-fA-F]{6}$/`.
- `rib`: if non-empty, must be exactly 20 digits.
- `email`: if non-empty, must contain `@`.
- `website`: if non-empty, must start with `http://` or `https://`.

**Audit entry:**
```ts
{
  action: "UPDATE",
  entity: "Company",
  entityId: companyId,
  actorId: actorId,
  companyId: companyId,
  changes: { field: { from: oldValue, to: newValue } }  // only changed fields
}
```

### 9.3 What Disappears

| Before | After |
|--------|-------|
| `getCompanyProfile()` (`config.ts:162`) | **Deleted** (replaced by `getCompanySettings`) |
| `updateCompanyProfile()` (`config.ts:263`) | **Deleted** (dead code, never called) |
| `CompanyProfile` type (`config.ts:51`) | **Deleted** (replaced by `CompanySettings`) |
| `DEFAULT_COMPANY_PROFILE` (`config.ts:102`) | **Deleted** (defaults on Company model) |

---

## 10. Branding / FileAsset Architecture

### 10.1 Current Problem

`readBrandingImage()` (`company-branding.ts:40-55`) queries `prisma.fileAsset.findFirst(
{ where: { storageKey } })` relying on the **session-scoped** company extension. The
`companyId` argument is not used for the FileAsset lookup — it's used only for the
`prisma.company.findUnique` read.

Safe today because the session company == document company is enforced at
`map-document.ts:176-178`. But unsafe if `getCompanyPrintData(targetCompanyId)` is ever
called outside the active session context.

### 10.2 Target Architecture

```ts
async function readBrandingImage(
  companyId: string,    // explicit, required
  storageKey: string | null
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!storageKey) return null;

  // Verify the asset belongs to the target company (not the session company).
  const asset = await prismaBase.fileAsset.findFirst({
    where: { storageKey, companyId },  // explicit companyId filter
    select: { storageKey: true, mimeType: true },
  });
  if (!asset) return null;

  const result = await readUploadFile(asset.storageKey);
  if (!result) return null;
  return { buffer: result.buffer, mimeType: asset.mimeType };
}
```

**Key changes:**
- Uses `prismaBase` (unscoped) instead of session-scoped `prisma`.
- Passes **both** `storageKey` AND `companyId` to the query.
- The caller (`getCompanyPrintData`) passes the `companyId` it already has.

**Security invariant:** `readBrandingImage` never relies on session scope. It trusts
only the explicit `companyId` argument, which is derived from `document.companyId`
(authorized by `map-document.ts:176-178`).

### 10.3 Upload Isolation

Uploads are already correctly isolated:
- `FileAsset` has a required `companyId` field (`schema.prisma:522`).
- `FileAsset` is in `COMPANY_SCOPED_MODELS` (`lib/db/company-scope.ts`).
- Upload API stamps `companyId: guard.context.company.id` (`api/upload/route.ts:61`).
- Download API uses scoped `prisma.fileAsset.findFirst` (auto-filtered by company).

**No changes needed for upload isolation.**

---

## 11. Print Architecture

### 11.1 Current (correct) Flow

```
Document
  ↓
document.companyId (from session, verified against document ownership)
  ↓
getCompanyPrintData(companyId)  ← reads Company model directly
  ↓
PrintCompany + PrintBranding
  ↓
Template → Renderer → PDF
```

**This flow is correct and is preserved.** The `companyId` is explicit, not derived
from global Settings or currentUser.

### 11.2 Target (enhanced) Flow

```
Document
  │
  ├── document.companyId  (authorization: must match session company)
  │
  └── getCompanyPrintProfile(companyId)
         │
         ├── prisma.company.findUnique({ where: { id: companyId } })
         │      → readBrandingImage(companyId, company.logoKey)
         │      → readBrandingImage(companyId, company.stampKey)
         │      → readBrandingImage(companyId, company.signatureKey)
         │
         └── CompanyPrintProfile DTO
                │
                ├── Template (consumes PrintCompany + PrintBranding)
                ├── Renderer (pdf-lib)
                └── PDF output
```

**Changes from current:**
1. `readBrandingImage` takes explicit `companyId` (§10.2).
2. Function renamed to `getCompanyPrintProfile` (naming clarity).
3. No other changes — the Company model read at `company-branding.ts:61` is already correct.

### 11.3 Print Data Source

| Field | Source (current) | Source (target) | Changed? |
|-------|-----------------|-----------------|----------|
| Company identity | `Company` model | `Company` model | No |
| Branding images | `FileAsset` (via storageKey) | `FileAsset` (via storageKey + explicit companyId) | Yes (§10) |
| Print format | `Company.printFormat` | `Company.printFormat` | No |
| Print margins | `Company.printMargins` | `Company.printMargins` | No |
| QR enabled | `Company.qrEnabled` | `Company.qrEnabled` | No |
| Payment terms | `Company.paymentTerms` | `Company.paymentTerms` | No |
| Email footer | `Company.emailFooter` | `Company.emailFooter` | No |

---

## 12. Print Format Ownership

### 12.1 Current Disconnect

```
PreferencesForm  →  writes print.defaultFormat (Setting)  →  NEVER reaches print
CompanyForm      →  writes company.printFormat (Setting)  →  synced to Company  →  reaches print
Admin            →  writes Company.printFormat (Company)  →  reaches print
```

**Result:** Two competing sources. User can change format in Preferences without effect.

### 12.2 Target

```
Canonical field:  Company.printFormat
Owner:            Company (per-company)
Read API:         getCompanySettings(companyId) → printFormat
Write API:        updateCompanySettings(companyId, { printFormat }) or PATCH /api/admin/companies/[id]
Print consumer:   getCompanyPrintProfile(companyId) → company.printFormat
```

| Concern | Resolution |
|---------|-----------|
| `print.defaultFormat` (Setting) | **Deprecated.** Removed from `ALLOWED_SETTING_KEYS`. `PreferencesForm` stops writing it. |
| `company.printFormat` (Setting) | **Deprecated.** Same: removed from `ALLOWED_SETTING_KEYS`. |
| `Company.printFormat` (Company model) | **Single source of truth.** Read by print, written by UI and admin. |
| Migration | Global Setting `company.printFormat` value copied to Company if Company field is empty. Then Setting keys removed. |
| Backward compat | `PreferencesForm` no longer has a print format selector (it moves to the Company print tab in `/parametres`). |

**User changes print format:**
```
User (in /parametres print tab)
  → updateCompanySettings(companyId, { printFormat: "A5" })
  → Company.printFormat = "A5"
  → Next print: getCompanyPrintProfile → printFormat = "A5"
  → PDF rendered in A5
```

---

## 13. QR Code Ownership

### 13.1 Current State

- `Company.qrEnabled` (Boolean, default `false`) — on Company model, read by print.
- `documents.qr.enabled` (Setting) — read by `getCompanyProfile()` for UI display.
- **No template renders a QR code.** The field is read but unused.

### 13.2 Target Architecture

| Aspect | Decision |
|--------|----------|
| **Owner** | Company (per-company configuration) |
| **Level** | Company-wide (all documents or none) |
| **Setting** | `documents.qr.enabled` → **deprecated.** `Company.qrEnabled` is the source. |
| **UI** | Print configuration tab in `/parametres` (Switch toggle) |
| **Print** | `getCompanyPrintProfile()` → `qrEnabled` (already read at `company-branding.ts:110`) |
| **Rendering** | Deferred to a future phase. When enabled, QR contains document URL or structured data per document type. |
| **Missing data** | If enabled but required data is missing (e.g., no document URL), QR section is silently omitted (no error). |

**This is NOT implemented in the current refactor. Only the ownership is defined.**

---

## 14. Data Type Normalization

### 14.1 `capital` (Decimal ↔ string)

| Layer | Type | Conversion |
|-------|------|-----------|
| Database (Prisma) | `Decimal?` | Native |
| Domain / Service | `string \| null` | On read: `String(company.capital)`. On write: `value.trim() === "" ? null : new Prisma.Decimal(value)` |
| API Response | `string \| null` | `"100000"` or `null` |
| UI Form | `<input type="number">` | User types `100000`, sent as `"100000"` |
| Print | `string \| null` | `company.capital ? String(company.capital) : null` (already in `company-branding.ts:100`) |
| Validation | Non-empty string must be numeric | Server-side: `!isNaN(Number(value))` before Decimal conversion |

### 14.2 `establishedAt` (DateTime ↔ ISO string)

| Layer | Type | Conversion |
|-------|------|-----------|
| Database | `DateTime?` | Native |
| Domain / Service | `string \| null` | On read: `company.establishedAt?.toISOString() ?? null` |
| API | `string \| null` | `"2020-01-15T00:00:00.000Z"` |
| UI | `<input type="date">` | `YYYY-MM-DD` |
| Validation | Valid ISO date or empty | Server-side: `new Date(value)`, check `!isNaN(date.getTime())` |

### 14.3 `printMargins` (Json ↔ object)

Already handled. No change needed.

### 14.4 `fiscalYear` (Int ↔ number)

| Layer | Type | Conversion |
|-------|------|-----------|
| Database | `Int?` | Native |
| API | `number \| null` | Direct |
| UI | `<input type="number">` | Direct |
| Validation | 2000–2100 or empty | Server-side range check |

---

## 15. RBAC

### 15.1 Permission Matrix

| Action | Permission | Sensitive Fields |
|--------|-----------|-----------------|
| **View Company Identity** | `parametres.view` | None (identity is not secret within the company) |
| **Edit Company Identity** | `parametres.manage` | All identity fields |
| **Edit Legal Information** | `parametres.manage` | `taxId`, `rc`, `nis`, `ai`, `vatNumber`, `legalForm`, `capital` |
| **Edit Branding** | `parametres.manage` | `logoKey`, `stampKey`, `signatureKey`, `primaryColor`, `secondaryColor` |
| **Edit Print Configuration** | `parametres.manage` | `printFormat`, `printMargins`, `printHeader`, `invoiceFooter`, `paymentTerms`, `emailFooter`, `qrEnabled` |
| **Edit Tax Configuration** | `parametres.manage` | Tax rate definitions in `tax.rates` Setting |
| **Edit Banking Information** | `parametres.manage` | `bank`, `bankAccount`, `rib`, `iban`, `swift` |
| **Manage Company (admin)** | `admin.company.update` | All fields, including `status`, `isDefault`, `defaultBranchId` |
| **Delete Company (admin)** | `admin.company.delete` | SUPER_ADMIN only |

### 15.2 Enforcement

- All `/parametres` endpoints require `parametres.view` (read) or `parametres.manage` (write) — **already enforced** via `apiGuard`.
- All `/admin/companies` endpoints require `admin.company.*` permissions — **already enforced** via `adminGuard`.
- **No additional granular permissions** are introduced for this refactor. `parametres.manage` covers all company identity edits. Finer-grained control (e.g., "legal info editable only by SUPER_ADMIN") is a future consideration.

### 15.3 Sensitive Fields (audit-logged)

Changes to the following fields **must** produce an `AuditLog` entry (§16):
`taxId`, `rc`, `nis`, `ai`, `vatNumber`, `capital`, `bank`, `bankAccount`, `rib`,
`iban`, `swift`, `name`, `legalName`, `legalForm`.

---

## 16. Audit Trail

### 16.1 Current Gap

`PUT /api/settings` produces **no `AuditLog` entry**. Company identity changes via
`/parametres` are completely un-logged.

`PATCH /api/admin/companies/[id]` uses `requestMeta(request)` but audit logging in
`company-admin/service.ts` needs verification (flagged for PHASE 7).

### 16.2 Target Audit Architecture

**Every write to `Company` identity fields produces an `AuditLog` entry.**

```ts
// Produced by updateCompanySettings() and admin updateCompany()
await tx.auditLog.create({
  data: {
    action: "UPDATE",
    entity: "Company",
    entityId: companyId,
    actorId: actorId,
    companyId: companyId,
    ip: requestMeta.ip,
    userAgent: requestMeta.userAgent,
    changes: {
      name: { from: "Old Name", to: "New Name" },
      taxId: { from: "123456789", to: "987654321" },
      // only fields that actually changed
    },
  },
});
```

**Fields that trigger audit logging:**
All identity, legal, tax, banking, and branding fields. Config-only fields (`printFormat`,
`currency`, `qrEnabled`) are also logged but at a lower priority.

**Implementation:**
The `updateCompanySettings` service compares old vs new values and writes only the
changed fields to `AuditLog.changes` (JSON). This is the same pattern used by
`company-admin/service.ts` for admin updates.

---

## 17. UI Architecture

### 17.1 Current State

`/parametres` has:
- **Home page** (`page.tsx`): renders `CompanyForm` — a single monolithic form with ALL fields.
- **Sub-pages**: branches, currencies, numbering, preferences, referentiels, taxes, units.
- **Preferences page** (`preferences/page.tsx`): renders `PreferencesForm` — locale, theme, fiscal year, print format, QR, notifications.

### 17.2 Target: Tabbed Company Settings

The home page (`/parametres`) becomes a **tabbed interface** with the following tabs:

```
/parametres
├── [Tab: General]          → CompanyOverview component
│   ├── Company name (FR)
│   ├── Company name (AR)
│   ├── Commercial name
│   ├── Legal form (Select from lookups)
│   ├── Activity
│   ├── Secondary activity
│   ├── Capital
│   ├── Established date
│   ├── Company type
│   └── Notes
│
├── [Tab: Legal]            → LegalInformation component
│   ├── NIF (taxId)
│   ├── RC
│   ├── NIS
│   ├── AI
│   └── VAT number
│
├── [Tab: Contact]          → ContactInformation component
│   ├── Country (Select)
│   ├── Wilaya (Select)
│   ├── Commune (Select, filtered by wilaya)
│   ├── Postal code
│   ├── Address (textarea)
│   ├── Phone
│   ├── Mobile
│   ├── Email
│   └── Website
│
├── [Tab: Branding]         → BrandingSettings component
│   ├── Logo (upload + preview)
│   ├── Stamp (upload + preview)
│   ├── Signature (upload + preview)
│   ├── Primary color (color picker + hex)
│   └── Secondary color (color picker + hex)
│
├── [Tab: Banking]          → BankingInformation component
│   ├── Bank (Select from lookups)
│   ├── Bank agency
│   ├── Bank account
│   ├── RIB
│   ├── IBAN
│   └── SWIFT
│
├── [Tab: Print]            → PrintSettings component
│   ├── Print format (A4/A5/THERMAL)
│   ├── QR enabled (Switch)
│   ├── Print header (textarea)
│   ├── Invoice footer (textarea)
│   ├── Payment terms (textarea)
│   ├── Email footer (textarea)
│   ├── Print margins (advanced, collapsible)
│   └── Currency (Select)
│
├── [Tab: Preferences]      → PreferencesForm (existing, simplified)
│   ├── Locale (fr/ar/en)
│   ├── Theme (light/dark)
│   ├── Fiscal year
│   └── Notifications
│
└── Sub-pages (unchanged):
    ├── /parametres/branches
    ├── /parametres/currencies
    ├── /parametres/numbering
    ├── /parametres/referentiels
    ├── /parametres/taxes
    └── /parametres/units
```

### 17.3 Tab Field Mapping

| Tab | Fields | Required | Source |
|-----|--------|----------|--------|
| General | `name`, `nameAr`, `commercialName`, `legalForm`, `activity`, `secondaryActivity`, `capital`, `establishedAt`, `type`, `notes` | `name` only | `Company` |
| Legal | `taxId`, `rc`, `nis`, `ai`, `vatNumber` | None (but document generation may require some) | `Company` |
| Contact | `country`, `wilaya`, `commune`, `postalCode`, `address`, `phone`, `mobile`, `email`, `website` | None | `Company` |
| Branding | `logoKey`, `stampKey`, `signatureKey`, `primaryColor`, `secondaryColor` | None | `Company` + `FileAsset` |
| Banking | `bank`, `bankAgency`, `bankAccount`, `rib`, `iban`, `swift` | None | `Company` |
| Print | `printFormat`, `qrEnabled`, `printHeader`, `invoiceFooter`, `paymentTerms`, `emailFooter`, `printMargins`, `currency` | `printFormat` (default "A4") | `Company` |
| Preferences | `locale`, `theme`, `fiscalYear`, `notificationsEmail` | None | `Setting` + `Company.fiscalYear` |

### 17.4 UI Behaviour

- **Tab-level save**: Each tab has its own Save button. Saving one tab does not affect others.
- **Unsaved changes protection**: `beforeunload` + visual indicator if any tab has unsaved changes.
- **Loading state**: Skeleton/spinner on initial load and on save.
- **Success/error feedback**: `toast.success()` / `toast.error()` on save.
- **Empty state**: Meaningful empty states per tab (e.g., "No logo uploaded yet" with upload button).
- **Progressive disclosure**: Print margins section is collapsed by default (advanced).
- **Image preview**: Logo/stamp/signature show current image thumbnail + upload/replace/remove buttons.
- **RTL/LTR**: `nameAr` and Arabic content fields use `dir="rtl"` (already implemented).

---

## 18. Completion Model

### 18.1 Principles

- **Deterministic**: Same company always produces the same completion status.
- **Explainable**: User can see exactly what's missing.
- **Non-blocking**: Incomplete profile does not prevent document creation.
- **Company-scoped**: Completion is per-company.
- **Permission-aware**: Only users with `parametres.view` see the completion indicator.

### 18.2 Section Definitions

| Section | Required Fields | Complete When |
|---------|----------------|---------------|
| **Basic Info** | `name` (always present on creation) | Always complete (name is set during company creation) |
| **Legal Identity** | `taxId` OR `rc` (at least one) | At least one of taxId/rc is non-empty |
| **Address** | `address` OR (`wilaya` AND `commune`) | At least one address indicator is present |
| **Contact** | `phone` OR `email` | At least one contact method is present |
| **Branding** | `logoKey` | Logo is uploaded |
| **Banking** | `bank` AND `bankAccount` | Both bank name and account number are present |
| **Tax Config** | `vatNumber` (for invoicing with TVA) | vatNumber is present (or company is exempt — future) |
| **Print** | `printFormat` (always has default) | Always complete (default "A4") |

### 18.3 Completion Score

```
Company Profile
█████████░ 90%

✓ Basic Info      — Complete
✓ Legal Identity  — Complete (NIF + RC)
✓ Address         — Complete
✓ Contact         — Complete
✗ Branding        — No logo uploaded
✓ Banking         — Complete
✓ Tax Config      — Complete
✓ Print           — Complete
```

**Score formula:** `completed sections / total sections * 100`.

**Not a simple field count** — sections use logical rules (e.g., "at least one of X or Y").

### 18.4 Display

- Shown at the top of the `/parametres` page (above tabs).
- Collapsible (user can dismiss).
- Color-coded: green (>80%), yellow (50-80%), red (<50%).
- Clicking a red/yellow section scrolls to the relevant tab.

---

## 19. API / Service Boundaries

### 19.1 New Endpoints

#### `GET /api/company/profile`

```text
Auth:       parametres.view
Input:      none (companyId from session context)
Data:       getCompanySettings(companyId)
Output:     CompanySettings (JSON)
Errors:     401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR
```

#### `PUT /api/company/profile`

```text
Auth:       parametres.manage
Input:      { settings: Array<{ key: string, value: unknown }> }  (subset of CompanySettings)
Data:       updateCompanySettings(companyId, parsedInput, actorId)
Output:     { updated: number }
Errors:     400 VALIDATION, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 500 INTERNAL_ERROR
Audit:      AuditLog.create() for identity changes
```

**Allowed keys** (new allowlist, replaces `ALLOWED_SETTING_KEYS` for company data):

Only Company model field names are accepted (flat object, not `company.*` prefixed):
`name`, `nameAr`, `commercialName`, `legalName`, `legalForm`, `capital`, `activity`,
`secondaryActivity`, `establishedAt`, `type`, `notes`, `taxId`, `rc`, `nis`, `ai`,
`vatNumber`, `country`, `wilaya`, `commune`, `postalCode`, `address`, `phone`,
`mobile`, `email`, `website`, `bank`, `bankAgency`, `bankAccount`, `rib`, `iban`,
`swift`, `logoKey`, `stampKey`, `signatureKey`, `primaryColor`, `secondaryColor`,
`printHeader`, `invoiceFooter`, `paymentTerms`, `emailFooter`, `printFormat`,
`qrEnabled`, `currency`, `fiscalYear`, `language`.

### 19.2 Existing Endpoints (modified)

#### `PUT /api/settings` (simplified)

```text
After migration, this endpoint ONLY handles:
  - locale.default, theme.default, notifications.email (user prefs)
  - tax.rates, currency.list, units.list (app config)
  - onboarding.dismissed (per-user)

All company.* keys are REMOVED from the allowlist.
No more dual-write to Company model.
```

### 19.3 Existing Endpoints (unchanged)

| Endpoint | Purpose | Change |
|----------|---------|--------|
| `PATCH /api/admin/companies/[id]` | Admin company update | Verify audit logging (PHASE 7) |
| `GET /api/admin/companies/[id]` | Admin company detail | No change |
| `GET /api/documents/[id]/pdf` | Print document | No change (reads Company via print service) |
| `GET /api/settings` | List all settings | After migration: returns only non-company settings |

### 19.4 Service Layer

```
features/company/settings.ts          ← NEW: getCompanySettings, updateCompanySettings
features/settings/config.ts           ← MODIFIED: remove getCompanyProfile, updateCompanyProfile, CompanyProfile
features/settings/keys.ts             ← MODIFIED: remove all company.* from ALLOWED_SETTING_KEYS
features/settings/server.ts           ← UNCHANGED
app/api/settings/route.ts             ← MODIFIED: remove company.* dual-write
app/api/settings/keys-shared.ts       ← DELETED (COMPANY_KEY_MAP no longer needed)
app/api/company/profile/route.ts      ← NEW: GET + PUT endpoints
features/print/company-branding.ts    ← MODIFIED: readBrandingImage takes companyId; rename to getCompanyPrintProfile
```

---

## 20. Migration Strategy

### 20.1 Principles

1. **Idempotent**: Safe to run multiple times.
2. **Transactional**: Company update + Setting cleanup in same transaction where possible.
3. **Validated**: Checks Company fields before writing; never overwrites non-empty Company data with Setting data.
4. **Observable**: Logs every action; produces a migration report.
5. **Multi-company safe**: Handles the global Setting problem (§20.3).

### 20.2 Migration Steps (script, not Prisma migration)

```
Step 1: READ global Setting values for all company.* keys
Step 2: READ each Company's current field values
Step 3: CLASSIFY each Setting value per Company:
          a. Setting value === Company field value → already in sync, no action needed
          b. Setting value !== Company field value AND Company field is empty → MIGRATE (copy Setting → Company)
          c. Setting value !== Company field value AND Company field is non-empty → CONFLICT (flag for manual review)
          d. Setting value exists but no Company exists → MIGRATION BLOCKER (unresolvable)
Step 4: APPLY migrations (step 3b) in transaction
Step 5: VERIFY each migrated Company field matches the Setting value
Step 6: REMOVE company.* keys from Setting table (or mark deprecated)
Step 7: REMOVE company.* from ALLOWED_SETTING_KEYS
Step 8: REMOVE COMPANY_KEY_MAP from keys-shared.ts
Step 9: PRODUCE migration report
```

### 20.3 The Global Setting Problem

The `Setting` table has **no `companyId`**. A single global row `company.name = "Foo"` could
represent:
- The last company that edited it (most likely).
- A legacy default from initial setup.
- Data from a deleted company.

**Detection strategy:**

For each `company.*` Setting key:
```text
globalValue = Setting[key].value

For each Company:
  companyValue = Company[field]

  if companyValue === globalValue:
    → MATCH (already synced, no action)
  else if companyValue is empty/null:
    → CANDIDATE for migration (Setting → Company)
  else:
    → CONFLICT (different values; flag for manual review)
```

**If only one Company exists:** All CANDIDATE values are migrated safely.

**If multiple Companies exist:**
- CANDIDATE values can only be migrated to Companies where the field is empty.
- If the global Setting value differs from ALL Company fields → **MIGRATION BLOCKER**
  (the value's ownership is ambiguous).
- Report the blocker with the key, the global value, and all Company values for manual resolution.

### 20.4 Migration Script Location

```
scripts/migrate-company-settings.ts
```

Run via: `npx tsx scripts/migrate-company-settings.ts`

Not a Prisma migration. A one-time operational script.

### 20.5 Rollback

If the migration produces incorrect results:
1. The original Setting rows are preserved (deprecated, not deleted) until manual verification.
2. `ALLOWED_SETTING_KEYS` can be restored to re-enable dual-write.
3. The `getCompanySettings` function can be reverted to read from Settings.

**Rollback window:** Until the Setting rows are physically deleted (never — they are
left in place as deprecated, not removed from the database).

---

## 21. Backward Compatibility

### 21.1 Consumer Migration Matrix

| Current Consumer | Current Source | Target Source | Migration |
|-----------------|---------------|---------------|-----------|
| `getCompanyProfile()` (`config.ts:162`) | Global Setting | **Deleted.** Replaced by `getCompanySettings(companyId)`. | Callers updated to pass companyId |
| `CompanyForm` submit → `PUT /api/settings` | Global Setting + Company | → `PUT /api/company/profile` → Company only | Form updated to call new endpoint |
| `PreferencesForm` submit → `PUT /api/settings` | Global Setting (print.defaultFormat, documents.qr.enabled) | Remove print.format + qr from PreferencesForm; move to Company settings | PreferencesForm simplified |
| `PUT /api/settings` (route) | Global Setting + Company dual-write | Global Setting only (no company.* keys) | Route simplified |
| `ALLOWED_SETTING_KEYS` (`keys.ts`) | 36 company.* keys | Remove all company.* keys | Keys trimmed |
| `COMPANY_KEY_MAP` (`keys-shared.ts`) | Maps company.* → Company fields | **Deleted** (no mapping needed) | File removed |
| `getCompanyPrintData()` (`company-branding.ts`) | Company model | Same (no change) | readBrandingImage takes explicit companyId |
| `getCompanyDetail()` (admin) | Company model | Same (no change) | No migration needed |
| `updateCompany()` (admin) | Company model | Same + AuditLog | Audit added in PHASE 7 |
| `getTaxRates()` / `setTaxRates()` | `tax.rates` Setting | Same (no change) | No migration |
| `getCurrencies()` / `setCurrencies()` | `currency.list` Setting | Same (no change) | No migration |
| `getUnits()` / `setUnits()` | `units.list` Setting | Same (no change) | No migration |
| `listSettings()` | All Setting rows | Same (fewer rows after deprecation) | No migration |

### 21.2 No Orphaned Reads

Every read of `company.*` from Settings is traced and replaced:
- `getCompanyProfile()` → `getCompanySettings(companyId)` (reads Company)
- `getCompanyPrintData()` → already reads Company (no change)
- `getCompanyDetail()` → already reads Company (no change)

### 21.3 No Orphaned Writes

Every write of `company.*` to Settings is traced and replaced:
- `CompanyForm` submit → `PUT /api/company/profile` (writes Company)
- `PreferencesForm` → remove `print.defaultFormat` and `documents.qr.enabled` writes
- `PUT /api/settings` → remove `company.*` handling
- Admin → already writes Company (no change)

### 21.4 No Dual Source-of-Truth

After migration:
- `company.*` data lives **only** on `Company` model.
- `Setting` table holds **only** app-wide config and user preferences.
- No bidirectional sync exists.

---

## 22. Architecture Diagrams

### 22.1 Target Data Flow

```
                         ┌────────────────────┐
                         │   Auth / RBAC       │
                         │   parametres.view   │
                         │   parametres.manage │
                         └─────────┬──────────┘
                                   │
                          session.activeCompanyId
                                   │
                    ┌──────────────▼──────────────┐
                    │         companyId            │
                    │   (explicit, verified)       │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
   ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
   │  Company Model   │  │  Company Model   │  │  Company Model    │
   │  (Master Data)   │  │  (Config)        │  │  (Branding)       │
   └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘
            │                    │                    │
            ▼                    ▼                    ▼
   getCompanySettings()   getCompanySettings()   getCompanyPrintProfile()
            │                    │                    │
            ▼                    ▼                    ▼
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ /parametres  │     │ Preferences  │     │  Print/PDF   │
   │ (UI Tabs)    │     │ (UI Form)    │     │  Engine      │
   └──────────────┘     └──────────────┘     └──────────────┘
```

### 22.2 Setting Table (After Migration)

```
Setting (GLOBAL — no companyId)
  │
  ├── locale.default        (app-wide default)
  ├── theme.default         (app-wide default)
  ├── notifications.email   (app-wide default)
  ├── tax.rates             (JSON — global reference data)
  ├── currency.list         (JSON — global reference data)
  ├── units.list            (JSON — global reference data)
  ├── onboarding.dismissed  (per-user flag)
  │
  └── (all company.* keys REMOVED)
```

### 22.3 Print Flow

```
Document (has companyId)
  │
  └── getCompanyPrintProfile(document.companyId)
         │
         ├── prisma.company.findUnique({ where: { id: companyId } })
         │     → Company.printFormat, Company.primaryColor, etc.
         │
         ├── readBrandingImage(companyId, company.logoKey)
         │     → prismaBase.fileAsset.findFirst({ where: { storageKey, companyId } })
         │
         ├── readBrandingImage(companyId, company.stampKey)
         ├── readBrandingImage(companyId, company.signatureKey)
         │
         └── CompanyPrintProfile DTO
                │
                └── Template → Renderer → PDF
```

### 22.4 Company Settings UI

```
/parametres
  │
  ├── Completion indicator (top)
  │     ████░░ 67%  "Upload a logo to complete branding"
  │
  ├── Tabs
  │     [General] [Legal] [Contact] [Branding] [Banking] [Print] [Preferences]
  │
  ├── Tab content (each tab: own Save button)
  │     ├── General:     name, nameAr, commercialName, legalForm, activity, ...
  │     ├── Legal:       taxId, rc, nis, ai, vatNumber
  │     ├── Contact:     country, wilaya, commune, address, phone, email, ...
  │     ├── Branding:    logo (upload+preview), stamp, signature, colors
  │     ├── Banking:     bank, account, rib, iban, swift
  │     ├── Print:       format, qr, header, footer, margins, currency
  │     └── Preferences: locale, theme, fiscal year, notifications
  │
  └── Sub-pages (unchanged):
        branches / currencies / numbering / referentiels / taxes / units
```

### 22.5 Document Snapshot (Future)

```
Document
  │
  ├── companyId          ─── FK to Company (for authorization)
  │
  ├── companySnapshot    ─── Json? (frozen at issuance)
  │     ├── name, nameAr, legalName, legalForm
  │     ├── taxId, rc, nis, ai, vatNumber
  │     ├── address, wilaya, commune, phone, email
  │     ├── bank, rib, iban
  │     ├── logoKey, primaryColor, printHeader, invoiceFooter
  │     └── capturedAt: DateTime
  │
  └── Print engine:
        if (document.companySnapshot) → use snapshot
        else → use live Company (fallback)
```

---

## 23. Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Global Setting values may not represent any single company in multi-company deployments. | 🔴 HIGH | §20.3 detection strategy: classify each value as MATCH/CANDIDATE/CONFLICT. BLOCKER for ambiguous data. |
| 2 | `capital` Decimal conversion may fail if global Setting contains non-numeric string. | 🟠 MEDIUM | Validate before migration; log errors; skip + flag. |
| 3 | `establishedAt` DateTime conversion may fail if global Setting contains invalid date. | 🟠 MEDIUM | Same as above. |
| 4 | `readBrandingImage` change (explicit companyId) may break if called from outside active session context. | 🟡 LOW | Today: always called within print (session == document). Change is backward-compatible. |
| 5 | Historical documents show current Company data (no snapshot). | 🟡 MEDIUM (accepted) | Documented as deferred. Future: Json snapshot field on documents. |
| 6 | `PreferencesForm` users expect print format selector in Preferences. | 🟡 LOW (UX) | Move to Print tab. Communicate change. |
| 7 | `updateCompanySettings` must not allow mass-assignment of arbitrary fields. | 🟠 MEDIUM | Strict allowlist of Company field names in the PUT endpoint. |

---

## 24. Open Questions

| # | Question | Status |
|---|---------|--------|
| 1 | Should `fiscalYear` move from Setting to Company? It's currently in both (`fiscal.year` Setting + `Company.fiscalYear`). | **DECIDED:** Move to Company. The Setting value is a duplicate. |
| 2 | Should the `language` field on Company be exposed in `/parametres`? | **DECIDED:** Yes, in the Print tab. Currently `Company.language` (default "fr") is unused by UI. |
| 3 | Is `qrEnabled` rendering desired in this refactor? | **DEFERRED:** Ownership defined (§13). Rendering deferred to future phase. |
| 4 | Should `emailFooter` / `paymentTerms` be exposed in `/parametres`? | **DECIDED:** Yes, in the Print tab. Currently admin-only. |
| 5 | Should the admin PATCH endpoint also produce AuditLog? | **DEFERRED:** Verify in PHASE 7. If not, add audit there too. |
| 6 | Should `printMargins` be exposed in `/parametres`? | **DECIDED:** Yes, in Print tab (advanced/collapsed section). |
| 7 | How should the multi-company migration handle deleted companies? | **DEFERRED:** Skip deleted Companies (deletedAt IS NOT NULL). They have no active users. |
| 8 | Should `documents.qr.enabled` Setting key be physically deleted or just deprecated? | **DECIDED:** Deprecated (left in DB, removed from allowlist). Physical deletion is unnecessary. |

---

## 25. Phase 3 Implementation Plan

### 25.1 Scope

Phase 3 implements the **data migration** only. No UI changes. No schema changes.

### 25.2 Files Created

| File | Purpose |
|------|---------|
| `scripts/migrate-company-settings.ts` | One-time migration script |
| `features/company/settings.ts` | `getCompanySettings(companyId)` + `updateCompanySettings(companyId, input, actorId)` |
| `app/api/company/profile/route.ts` | `GET /api/company/profile` + `PUT /api/company/profile` |

### 25.3 Files Modified

| File | Change |
|------|--------|
| `features/settings/keys.ts` | Remove all 37 `company.*` keys + `print.defaultFormat` + `documents.qr.enabled` from `ALLOWED_SETTING_KEYS` |
| `app/api/settings/keys-shared.ts` | **Delete file** (COMPANY_KEY_MAP no longer needed) |
| `app/api/settings/route.ts` | Remove company.* dual-write logic; remove companyId resolution; simplify to Settings-only |
| `features/settings/config.ts` | Delete `getCompanyProfile()`, `updateCompanyProfile()`, `CompanyProfile`, `DEFAULT_COMPANY_PROFILE`; keep `getTaxRates`, `setTaxRates`, `getCurrencies`, `setCurrencies`, `getUnits`, `setUnits` |
| `features/print/company-branding.ts` | Modify `readBrandingImage` to take explicit `companyId`; use `prismaBase`; rename function to `getCompanyPrintProfile` |

### 25.4 Files NOT Modified (yet)

| File | Phase |
|------|-------|
| `components/settings/company-form.tsx` | PHASE 4 (UI rebuild) |
| `components/settings/preferences-form.tsx` | PHASE 4 (remove deprecated keys) |
| `app/(app)/parametres/page.tsx` | PHASE 4 (use new service) |
| `prisma/schema.prisma` | No change needed |
| `app/api/admin/companies/[companyId]/route.ts` | PHASE 7 (audit verification) |

### 25.5 Migration Script Flow

```ts
// scripts/migrate-company-settings.ts
async function main() {
  const report = { migrated: 0, conflicts: 0, blockers: 0, skipped: 0 };

  // Step 1: Read all company.* Setting values
  const settingKeys = COMPANY_KEY_MAP entries; // from keys-shared.ts (before deletion)
  const settings = await prisma.setting.findMany({
    where: { key: { in: settingKeys.map(([k]) => k) } },
  });

  // Step 2: Read all non-deleted Companies
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
  });

  // Step 3: Classify and migrate
  for (const [settingKey, companyField] of settingKeys) {
    const setting = settings.find(s => s.key === settingKey);
    if (!setting) continue;

    for (const company of companies) {
      const currentValue = company[companyField];
      const settingValue = parseSettingValue(setting.value, setting.type);

      if (currentValue === settingValue || (currentValue === null && settingValue === "")) {
        // MATCH: already in sync
        report.skipped++;
      } else if (currentValue === null || currentValue === "" || currentValue === undefined) {
        // CANDIDATE: Company field empty, Setting has value → migrate
        await prisma.company.update({
          where: { id: company.id },
          data: { [companyField]: settingValue },
        });
        report.migrated++;
      } else {
        // CONFLICT: both have different non-empty values → flag
        report.conflicts++;
        console.warn(`CONFLICT: ${company.name} ${companyField}: Company="${currentValue}" vs Setting="${settingValue}"`);
      }
    }
  }

  // Step 4: Handle missing Companies for Setting values (blockers)
  // (skip for now — log only)

  // Step 5: Verify
  // (re-read and compare)

  // Step 6: Produce report
  console.log(JSON.stringify(report, null, 2));
}
```

### 25.6 Verification Checklist (Phase 3 exit gate)

- [ ] `getCompanySettings(companyId)` returns correct data for Company A
- [ ] `getCompanySettings(companyId)` returns correct data for Company B
- [ ] `getCompanySettings(A)` does NOT return B's data (multi-company isolation)
- [ ] `updateCompanySettings(A, { name: "Foo A" })` updates only Company A
- [ ] `PUT /api/company/profile` requires `parametres.manage`
- [ ] `PUT /api/company/profile` produces AuditLog entry
- [ ] `PUT /api/settings` no longer accepts `company.*` keys (returns 400)
- [ ] `getCompanyPrintProfile(A)` returns A's branding (not B's)
- [ ] Print output matches `/parametres` data (no desync)
- [ ] Migration script produces report with 0 blockers for single-company
- [ ] `tsc` passes with 0 errors
- [ ] `eslint` passes with 0 errors

---

*End of PHASE 2 target architecture. STOP — no code was modified. PHASE 3 (migration + service layer) is next after review.*
