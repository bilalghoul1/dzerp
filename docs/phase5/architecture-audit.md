# Phase 5.1 — Architecture Audit

Multi-company architecture for DzERP Enterprise. This report is the deliverable of
Phase 5.1. It audits the current system, defines the target architecture, the migration
strategy, and the risk analysis. **No business logic is modified in this phase.**

Status: awaiting approval.

---

## 1. Audit findings

### 1.1 Stack (current)

- Next.js 16.2.12, React 19.2.4, TypeScript, Tailwind v4.
- Prisma 7.9.1 with PostgreSQL (Neon). Generated client in `src/generated/prisma`.
- `src/lib/prisma.ts` exports a single shared client (`globalThis` singleton) extended
  with `softDeleteExtension` (`setSoftDeleteDelegate`).
- i18n: fr / ar / en, strict dictionaries in `src/i18n/dictionaries.ts`.
- Auth: cookie session (HMAC payload `{sid, uid, exp}`), `SESSION_COOKIE="dzerp.session"`.
- Repo commands: `npm run lint` (eslint), `tsc --noEmit` (type-check), `npm run build`
  (next build), `npm run db:migrate`, `npm run db:seed`.

### 1.2 Schema review — model classification

54 models. Classification rule (from spec):

> If a record represents **business data owned by a legal entity**, attach `companyId`.
> If a record represents **reusable system configuration**, keep it global.

#### GLOBAL — no `companyId`

| Model | Reason |
|---|---|
| `User` | Global identity. Access to companies is via `UserCompany`/`CompanyRole`. |
| `Role` | Reusable role definition (permission template). |
| `Permission` | Global permission definition. |
| `RolePermission` | Global join role→permission. |
| `Session` | Auth record; gains `activeCompanyId` (persistence of active company). |
| `Country`, `LegalForm`, `BusinessSector`, `PaymentMethod`, `Wilaya`, `Commune`, `Bank` | Global reference data. |
| `Unit`, `VatCategory` | Global reference data (unit of measure, VAT rate definitions). |
| `Setting` | **Hybrid.** System keys stay global (`companyId = NULL`); company config keys (branding, numbering, tax config, company profile) become company-scoped (`companyId` set). One table, nullable column. |
| `Client`, `Counter` | Legacy, unused by the application (verified: no `prisma.client` / `prisma.counter` usage). Left untouched; candidates for removal in a later phase. |

#### COMPANY-SCOPED — `companyId` added (aggregate roots)

| Model | Why | Unique constraints to re-scope |
|---|---|---|
| `Branch` | Belongs to exactly one company. | `code` → `@@unique([companyId, code])` |
| `DocumentSeries` | Per-company numbering. | `key` and `docType` → `@@unique([companyId, key])`, `@@unique([companyId, docType])` |
| `Customer`, `Supplier` | Business partners of the company. | `code` → `@@unique([companyId, code])` |
| `Product` | Company catalog. | `code`, `sku` → `@@unique([companyId, code])`, `@@unique([companyId, sku])` |
| `ProductCategory`, `Brand`, `Manufacturer` | Company catalog taxonomy. | `code` → `@@unique([companyId, code])` |
| `Warehouse` | Company storage. | `code` → `@@unique([companyId, code])` |
| `InventoryMovement` | Company ledger. | `number` → `@@unique([companyId, number])` |
| `Quotation`, `SalesOrder`, `DeliveryNote`, `Invoice`, `CreditNote`, `PurchaseRequest`, `PurchaseOrder`, `GoodsReceipt`, `SupplierInvoice` | Company documents. They already reference `branch`; `companyId` is added explicitly because **the company relation is the primary security boundary** (branch is an operational subdivision). | `number` → `@@unique([companyId, number])` |
| `DocumentApproval` | Business workflow record. | — |
| `AuditLog` | Per-company audit trail (+ `branchId`). | — |
| `ActivityEvent` | Per-company timeline. | — |
| `FileAsset` | Business attachments (e.g. logos, stamps). | — |

#### CHILD / JOIN — no `companyId` (derive via parent)

`QuotationLine`, `SalesOrderLine`, `DeliveryNoteLine`, `InvoiceLine`, `CreditNoteLine`,
`PurchaseRequestLine`, `PurchaseOrderLine`, `GoodsReceiptLine`, `SupplierInvoiceLine`,
`ProductAttributeValue`, `ProductSupplier`, `WarehouseLocation` derive their company from
their aggregate root (document, product, warehouse). This respects the
"do not add companyId to every table" rule.

#### NEW MODELS

- `Company` — the legal entity.
- `UserCompany` — membership (which companies a user belongs to), with `isDefault`,
  `isActive`.
- `CompanyRole` — role assignment for a user **within** a company.

Target authorization chain (from spec):

```
User → UserCompany → CompanyRole → Role → RolePermission → Permission
```

### 1.3 Authentication review

- `src/features/auth/session.ts`: `createSession(userId, meta)` writes a signed cookie.
- `src/app/api/auth/login/route.ts`: validates credentials, creates session, records
  `LOGIN` audit, updates `lastLoginAt`. No company dimension today.
- `src/features/auth/rbac.ts` `getCurrentUser()`: verifies cookie → loads `Session` →
  loads `User` (incl. `branch`) → aggregates **global** permissions from
  `UserRole → role.permissions`.
- **Gap:** sessions cannot remember the active company. "Restore automatically after
  login" requires `Session.activeCompanyId` (and optionally `Session.activeBranchId`).

### 1.4 RBAC review

- Permission catalog: `src/features/auth/permissions.ts` — 71 permissions,
  `PERMISSIONS`, `ALL_PERMISSION_KEYS`, `PERMISSION_MODULES`.
- Seeded roles: `ADMIN`, `MANAGER`, `READER` (global).
- Guards: `requireUser()`, `requirePermission(key)`, `hasPermission(permissions, key)`,
  API guard `apiGuard(permission?)` in `src/features/auth/api-guard.ts`.
- **Gap:** all permissions are flat and global. The same user cannot hold different
  roles in different companies. Permission evaluation must be resolved inside the
  active company (via `CompanyRole`), with `UserRole` kept only as a legacy fallback
  during migration.

### 1.5 Navigation review

- `src/components/shell/nav-config.tsx`: `mainNav` + `footerNav`, filtered by
  `filterNav(items, permissions)` in the shell. Since permissions will be resolved per
  active company, navigation continues to work unchanged once `getCurrentUser` returns
  company-scoped permissions.
- `src/components/shell/app-shell.tsx`: header renders static `CompanyBadge(name)` +
  `BranchSelector`. The static badge is replaced by a `CompanySwitcher` (single company →
  name only; multiple → dropdown; persistence + restore after login).
- `src/features/session/active-branch.ts`: branch selected via `dzerp.branch` cookie;
  must be validated against the active company.
- `src/app/(app)/layout.tsx`: loads `getCompanyProfile()` + `prisma.branch.findMany`
  + `getActiveBranch()` — all become company-aware via the context.

### 1.6 Current seams that change

| Concern | Today | Target |
|---|---|---|
| Company identity | `company.*` settings (global `Setting`) | `Company` row + company-scoped settings |
| Active company | none | `Session.activeCompanyId` (restored after login) + `dzerp.company` cookie for the current request |
| Active branch | `dzerp.branch` cookie, unfiltered | validated inside active company |
| Permissions | global via `UserRole` | per-company via `CompanyRole` |
| Numbering | global `DocumentSeries` (`docType` unique) | per-company series (`@@unique([companyId, docType])`) |
| Data queries | manual per-page filtering | automatic `companyId` scoping via context |
| Audit | no company/branch | `companyId` + `branchId` |

---

## 2. Target architecture

### 2.1 `Company` model (sketch)

```
Company
  id, code (unique), name, legalName, legalForm, activity, secondaryActivity,
  establishedAt, taxId, rc, nis, ai, vatNumber,
  country, wilaya, commune, postalCode, address, phone, mobile, email, website,
  bank, bankAgency, bankAccount, rib, iban, swift,
  logoKey, stampKey, signatureKey,
  currency, fiscalYear, isActive, isSystem (default-company marker),
  createdById, updatedById, createdAt, updatedAt

  branches, documentSeries, customers, suppliers, products, warehouses,
  inventoryMovements, documents…, auditLogs, activityEvents, fileAssets,
  userCompanies, companyRoles, settings
```

Reuses the field vocabulary already present in `CompanyProfile`
(`src/features/settings/config.ts`) so the existing company-form maps 1:1.

### 2.2 Membership + roles

```
UserCompany                CompanyRole
  id                         id
  userId                     userId
  companyId                  companyId
  isDefault  (bool)          roleId
  isActive   (bool)          isActive
  @@unique([userId, companyId])   @@unique([userId, companyId, roleId])
```

- `UserCompany` = membership. `isDefault` = the company restored after login.
- `CompanyRole` = which role the user holds in each company (user may hold several,
  permissions are the union).
- `UserRole` is kept temporarily for backward compatibility; the migration creates
  `CompanyRole` rows in the default company from existing `UserRole` rows so **no
  existing administrator loses access**.

### 2.3 Session

```
Session
  ...existing fields
  activeCompanyId String?   // restored after login
  activeBranchId  String?
```

### 2.4 Company context + authorization services

Server-side request context (AsyncLocalStorage) resolved once per request:

```
CompanyContext {
  userId, companyId, branchId,
  userCompany, companyRoleIds,
  permissions: PermissionKey[]
}
```

Exposed helpers (reusable by every future module — Sales, Purchasing, Inventory,
Accounting, Manufacturing, Reports):

- `getCurrentCompany()` — active company from `Session.activeCompanyId`/cookie,
  validated that the user is an active member (`UserCompany`); fallback to `isDefault`.
- `getCurrentBranch()` — active branch validated inside the active company.
- `getCurrentCompanyRole()` — roles for (user, active company).
- `hasPermission(key)` / `hasAnyPermission(...)` / `hasAllPermissions(...)` —
  evaluated against the active company's permissions.
- `apiGuard(permission?)` — upgraded to resolve the context and authorize.

Prisma scoping: a `$extends` client auto-injects `companyId` into queries for
company-scoped models, with an `.unscoped()` escape hatch for administration and
migration tasks.

---

## 3. Migration strategy (non-breaking)

Principle: every step keeps the previous build running.

1. **Additive schema** — add `Company`, `UserCompany`, `CompanyRole`; add nullable
   `companyId` (+ relations) to company-scoped models; add `Session.activeCompanyId` /
   `activeBranchId`. No data moved, no constraint dropped. Old code still compiles and
   runs (nullable columns are ignored by it).
2. **Backfill migration** — create the **default company** "DzERP Algérie" (matching the
   current seed/company profile) if none exists; set `companyId` on all existing business
   rows; create `UserCompany` (membership) and `CompanyRole` (role from `UserRole`) for
   the default company; set `Session.activeCompanyId` to the default company.
3. **Constraint re-scope** — replace global uniques with composite uniques
   (`@@unique([companyId, …])`) on `Branch.code`, `Customer.code`, `Supplier.code`,
   `Product.code`/`sku`, `ProductCategory.code`, `Brand.code`, `Manufacturer.code`,
   `Warehouse.code`, `InventoryMovement.number`, each document `number`,
   `DocumentSeries.key`/`docType`, `Setting.key` (→ `@@unique([companyId, key])`).
   Safe because backfill guarantees one company per row first.
4. **NOT NULL** — flip `companyId` to required on aggregate roots (e.g. `Branch`) after
   backfill; keep nullable where a global fallback is legitimate (`Setting`, audit).
5. **Runtime transition** — authorization helpers read `CompanyRole` first, fall back to
   `UserRole` while both exist; drop the legacy path in a later phase once confirmed.

Order of work per phase: 5.2 context (no schema) → 5.3 authz schema (steps 1–2) →
5.4 isolation (steps 3–4) → 5.5 companies UI → 5.6 integration → 5.7 final audit.

---

## 4. Risk analysis

| Risk | Impact | Mitigation |
|---|---|---|
| Composite-unique migration on `DocumentSeries`/`number`/`code` could collide if backfill is incomplete | Constraint failure, blocked deploy | Backfill in the same migration before constraints; validate zero NULL `companyId` rows prior |
| Auto-scoped Prisma client silently filters admin queries | Data hidden from Super Admin | `.unscoped()` escape hatch + explicit Super Admin path; unit tests per scoped model |
| Existing users lose permissions | Business interruption | `UserRole → CompanyRole` backfill into default company; legacy fallback during transition |
| `nextDocumentNumber` CAS relies on `docType @unique` | Concurrent numbering breaks across companies | Re-scope CAS to `(companyId, docType)`; per-company `nextValue` keeps `INV-2026-000001` valid in both companies |
| Two role paths (`UserRole` + `CompanyRole`) drift | Permission divergence | One source of truth after migration; helpers hide the legacy path; removal phase tracked |
| Branch cookie from another company | Cross-company data access | `getActiveBranch()` validates branch belongs to active company |
| `Setting.key` global unique blocks company-scoped keys | Cannot have per-company branding | Composite `@@unique([companyId, key])` with `NULL` = global |
| Large schema churn in one migration | Review burden | Phased migrations (additive → backfill → constraints), each `migrate dev` + lint/typecheck/build verified |

---

## 5. Implementation plan (per milestone)

### Phase 5.2 — Company context foundation
- `CompanyContext` (AsyncLocalStorage), `getCurrentCompany()`, `getCurrentBranch()`.
- `CompanySwitcher` in header (replaces static `CompanyBadge`), `dzerp.company` cookie,
  `Session.activeCompanyId` persistence, restore after login.
- Authorization helper module (`hasPermission`, `hasAnyPermission`, `hasAllPermissions`).
- No business modules modified. QA: lint + type-check + build.

### Phase 5.3 — Authorization refactor
- Schema: `Company`, `UserCompany`, `CompanyRole`, `Session.activeCompanyId`.
- Migration + backfill (default company, `UserRole → CompanyRole`).
- Company-aware `getCurrentUser` / `apiGuard` / `requirePermission`.
- QA: lint + type-check + build.

### Phase 5.4 — Data isolation
- `companyId` on branch, series, customers, suppliers, products, warehouses, movements,
  documents; composite uniques; services filter by context.
- No UI redesign. QA.

### Phase 5.5 — Company management
- Companies page (list/details), CRUD, 8-step wizard, settings, branding.
- QA.

### Phase 5.6 — Integration
- Dashboard, global search, navigation, APIs, audit logs — all via company context.
- QA.

### Phase 5.7 — Final audit
- Architecture/DB/RBAC/API/UI/perf/security review; `npm run lint`, `tsc --noEmit`,
  `npm run build`; final documentation. Stop for approval.

---

*Commands (repo is npm, not pnpm):* `npm run lint` · `npx tsc --noEmit` · `npm run build`
· `npm run db:migrate` · `npm run db:seed`.
