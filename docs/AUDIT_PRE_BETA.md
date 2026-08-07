# DzERP — Pre-Beta Full Architecture Audit

Date: 2026-08-05
Scope: whole codebase (Next.js 16.2.12 / React 19.2.4 / Prisma 7.9.1 / PostgreSQL Neon / multi-company)
Method: systematic source audit of all 54 models, 16 migrations, 37 API routes, all pages, all feature services, React/i18n/UI layers, security scan, performance scan.

---

## 1. Executive Summary

DzERP is in remarkably good shape for a pre-beta multi-tenant ERP. The **company-isolation architecture is sound**: a Prisma `companyScope` extension (fail-closed on strict models), `AsyncLocalStorage` context set by `runScoped`/`apiGuardWithContext` on every business route, a `React.cache` per-request fallback for RSC pages, explicit `companyId` re-verification in the document engine, and `runUnscoped` reserved for the admin module. Sessions are HMAC-signed, DB-backed, expiry-checked, and hardened cookies. Validation uses Zod pervasively.

The audit found **3 critical issues** (1 privilege escalation, 2 cross-company data leaks, 1 database numbering constraint that breaks per-company isolation), several major issues (non-atomic multi-row writes, TOCTOU on stock guard, no login rate limiting, document permission model mismatches, misleading dashboard counters), and a set of minor issues.

Everything else is classified below with precise `file:line` references.

---

## 2. Architecture Score: 8.5 / 10

Strengths:
- Multi-company design is layered and defense-in-depth: extension → ALS context → page fallback → explicit checks.
- Clean document engine with per-company series and a CAS (compare-and-swap) number allocator.
- Event-sourced inventory (append-only movement journal, derived stock) — no stale stock levels.
- Consistent soft-delete extension + per-company unique constraints.
- Uniform error contract `{ error: { message, code, details? } }`.

Costs:
- The line-item models (9 `*Line` tables) have no `companyId` and are not extension-scoped; the only live leak is fixed by this audit (dashboard), but the model-level gap remains (technical debt).
- `Setting` is platform-global — company-level settings are not isolated by design.
- No FTS/search index; global search is ~14 LIKE queries per keystroke.

---

## 3. Security Score: 7 / 10

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| S1 | CRITICAL | Privilege escalation: company admin can assign the global ADMIN role (any `roleId` accepted, no privilege comparison) and become Super Admin | `src/features/company-admin/schemas.ts:96-106`, `service.ts:839-847, 930-941` |
| S2 | MAJOR | No rate limiting / lockout / backoff on login (brute-force surface) | `src/app/api/auth/login/route.ts` |
| S3 | MAJOR | Login username-enumeration timing side channel (missing-user returns instantly, bcrypt compare only for existing) | `src/app/api/auth/login/route.ts:32-46` |
| S4 | MAJOR | Upload MIME type taken from client, served `Content-Disposition: inline` — crafted HTML/SVG can render in origin | `src/features/upload/storage.ts:51`, `src/app/api/files/[...key]/route.ts:41-45` |
| S5 | MINOR | Company/branch cookies not `httpOnly`/`secure` (validated server-side, so low impact) | `login/route.ts:67-81`, `resolver.ts:91-104` |
| S6 | MINOR | Logout does not clear company/branch cookies | `src/features/auth/session.ts:121-136` |
| S7 | MINOR | Legacy `UserRole` fallback grants global permissions to a membership with zero RoleAssignments | `src/features/company/store.ts:233-244` |
| S8 | MINOR | `apiGuardWithContext` maps real DB errors to 403 "Aucune société accessible" (masks 500s) | `src/features/company/api.ts:37-42` |
| S9 | MINOR | `prisma.localhost` fallback in `src/lib/prisma.ts:13-15` if `DATABASE_URL` missing (normally guarded) | `src/lib/prisma.ts` |
| S10 | MINOR | `uploads/` not in `.gitignore`; 2 test binaries committed | `.gitignore`, `uploads/` |

**Good:** session cookie `httpOnly`/`secure`(prod)/`sameSite=lax`; HMAC-SHA256 signed token + timing-safe compare; DB session row with `revokedAt`/`expiresAt`; logout revokes server-side; password change revokes other sessions; bcrypt cost 12; zero raw SQL; no open redirects; no `dangerouslySetInnerHTML` on user input; no `NEXT_PUBLIC_` secrets; `.env*` gitignored.

---

## 4. Performance Score: 6.5 / 10

| # | Issue | Location |
|---|-------|----------|
| P1 | Document list double-fetch: server renders `initialItems`, client re-fetches identical page 1 on mount | `document-list-page.tsx:27-30` + `document-list.tsx:154-157` |
| P2 | `listDocuments` over-fetches: includes full `lines` for 20 rows on a list page (normalize uses headers only) | `engine/service.ts:347-356, 49-60` |
| P3 | `resolveDocType` N+1: up to 9 sequential `findUnique` per document request (duplicated verbatim in 2 routes) | `documents/[id]/route.ts:19-32`, `relations/route.ts:17-30` |
| P4 | Global search: `contains` LIKE across customer/supplier/product/user/branch + 9 doc tables (~14+ queries), no pg_trgm/FTS | `src/features/search/server.ts` |
| P5 | Dashboard fetches ALL active products (no `take`, no `minimumQuantity>0` filter) to compute a JS count | `page.tsx:110-115` |
| P6 | List helpers return full rows (no `select`): `listCustomers`, `listProducts` (7 includes), `listWarehouses`, `listInventoryMovements` | `customers/config.ts:23-29`, `products/config.ts:279-283` |
| P7 | Editor party dropdown loads full `BusinessPartnerRow` (30+ fields) just for `{id,name}` | `document-editor-page.tsx:36-39` |
| P8 | `softDeleteCompany` runs 16 sequential counts | `company-admin/service.ts:703-713` |

**Good:** atomic CAS numbering (`series.ts:60-88`); well-indexed doc models; session `expiresAt` index; `InventoryMovement` `(productId,warehouseId)` index; editor does NOT double-fetch (`initialDetail` seeds context).

---

## 5. Code Quality Score: 7 / 10

| # | Issue | Location |
|---|-------|----------|
| Q1 | Legacy models `Counter` and `Client` (unreferenced; `Client` survives via `clientId` FK columns, always written null) | `schema.prisma:495, 504` |
| Q2 | Dead export `getActiveBranch` (zero importers) | `src/features/session/active-branch.ts:17` |
| Q3 | Orphaned script `add-admin-company-permissions.ts` (not wired to npm) | `scripts/` |
| Q4 | Duplicated zod helpers `optionalText/optionalDecimal/optionalId` in 3 modules | `products/config.ts:16-44`, `warehouses/config.ts:7-21`, `inventory/config.ts` |
| Q5 | `resolveDocType` duplicated verbatim in 2 routes | see P3 |
| Q6 | 7 missing i18n keys render as raw key text | see I18N section |

**Good:** customers/suppliers correctly thin aliases over a shared business-partners module; centralized soft-delete; justified `eslint-disable` comments (7); zero TODO/FIXME/debugger; clean `next.config.ts`.

---

## 6. Multi-company Score: 7 / 10

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| M1 | CRITICAL | `InventoryMovement.number @unique` global unique left over from phase 4 — second company's first movement collides with `INV-000001` | `schema.prisma:955`; migration `20260803140000_phase54` dropped the other 20 global uniques but missed this one |
| M2 | CRITICAL | Dashboard "top products" aggregates `InvoiceLine` across ALL companies (model has no companyId, not scoped) | `page.tsx:99-104` |
| M3 | CRITICAL | Dashboard "users" stat counts all ACTIVE users platform-wide (User not scoped) | `page.tsx:75` |
| M4 | MAJOR | `listWarehouseOptions` returns all platform users as assignable warehouse managers | `warehouses/config.ts:200-205` |
| M5 | MAJOR | `Setting` is platform-global; any company user with `parametres.manage` writes platform-wide settings | `settings/server.ts:50-76`, `api/settings/route.ts:37` |
| M6 | MEDIUM | Extension bypasses scoping when `where`/`data` already contains `companyId` — trusted today, but unverified | `company-scope.ts:90-93, 105` |
| M7 | LOW | All 9 `*Line` models + global catalogs (Unit, VatCategory, ProductAttribute) unscoped | `schema.prisma` |

**Good:** per-company uniques on all 23 strict models; `resolveMembership` validates active status + company state; active company/branch re-validated per request; admin service runs `runUnscoped` with `assertGlobalAdmin`/`assertCompanyAccess`; dashboard + search + attachments explicitly company-filtered after this audit.

---

## 7. Document Engine Score: 6.5 / 10

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| D1 | MAJOR | Seeded roles can't use documents: pages/APIs require `documents.*` but seed grants only `ventes.*`/`achats.*`; MANAGER/READER/COMPANY_ADMIN get 403 on every document screen | `seed.ts:243-300`, `document-list-page.tsx:19`, `document-editor-page.tsx:25`, `api/documents/route.ts:15,50` |
| D2 | MAJOR | `permissionPrefix` (per-doc-type `ventes.devis.*` etc.) defined but never enforced — granular permission catalog is decorative for documents | `engine/config.ts:41-145`, `permissions.ts:82-206` |
| D3 | MAJOR | Conversion allows any source→target type with no server-side allowed-pairs or source-status validation (DRAFT/CANCELLED convertible; `INVOICE→PURCHASE_ORDER` copies customerId into supplierId) | `engine/conversion.ts`, `convert/route.ts:22-30` |
| D4 | MAJOR | `conversionRate` stored but never applied — target amounts copied verbatim | `conversion.ts:107-109, 122-126` |
| D5 | MAJOR | Non-atomic multi-row writes: `updateDocument`, `deleteDocument`, `convertDocument` (target+relation), `transitionStatus` (status+audit) | `engine/service.ts:203-229, 270-274`, `conversion.ts:116-148`, `workflow.ts:23-51` |
| D6 | MAJOR | Audit-after-commit is a false failure: `recordAudit`/`recordActivity` run after the write, unhandled → 500 on committed write (client may retry → duplicates) | `engine/service.ts:116-137`, `company-admin/service.ts:466-484` |
| D7 | MINOR | `DocumentApproval` model is dead code (scoped but never read/written) | `schema.prisma:1011-1031` |
| D8 | MINOR | No year rollover: `withYear` series keep the configured year forever | `series.ts:39-42` |
| D9 | MINOR | Orphan `DocumentRelation` rows on delete (no cleanup/cascade); UI "History" never shows status transitions | `engine/service.ts:270-274`, `document-history.tsx:50-70` |
| D10 | MINOR | Workflow bar shows approve buttons without checking `documents.approve` (UX; API is safe) | `document-workflow-bar.tsx:121-136` |

**Good:** CAS number allocation is concurrency-safe; per-company `@@unique([companyId, number])` everywhere; transitions validated server-side (`assertTransition`, 422); explicit `companyId` checks on every read/update/delete; conversion preserves company and dedupes via 409.

---

## 8. Technical Debt

1. Line-item models without `companyId` (9 tables) — proper fix is a migration + scoping (see Suggested Improvements).
2. `Client` + `Counter` legacy models and `clientId` FK columns.
3. Granular document permissions defined but unenforced (D1/D2) — seed and enforcement must be reconciled.
4. Global `Setting` model — needs per-company scoping for true multi-tenancy.
5. Search without FTS indexes; LIKE `contains` everywhere.
6. `Product.stock`, `Customer.balance`, `Invoice.paymentStatus` fields exist but no code maintains them → misleading surfaces (dashboard).
7. No CSRF tokens (mitigated by SameSite=Lax + JSON content type).
8. Two committed test binaries under `uploads/`.

---

## 9. Critical Issues

1. **C1 — Privilege escalation** (S1): arbitrary `roleId` in `addMember`/`updateMember` → company admin assigns global ADMIN → full platform control.
2. **C2 — Cross-company aggregation leak** (M2): dashboard top-products sums invoice lines of every tenant.
3. **C3 — Cross-company count leak** (M3): dashboard "users" is platform-wide; `listWarehouseOptions` exposes all platform users (M4).
4. **C4 — Broken per-company numbering** (M1): leftover global unique on `InventoryMovement.number` makes movement numbering collide across companies.

## 10. Major Issues

1. No login rate limiting + timing side channel (S2, S3).
2. Upload MIME trust (S4).
3. Seeded roles unusable with document module + granular permissions unenforced (D1, D2).
4. Conversion validation gaps + rate not applied (D3, D4).
5. Non-atomic writes and audit-after-commit false failures (D5, D6).
6. TOCTOU on inventory stock guard (two concurrent "out" movements can both pass → negative stock).
7. Dead/misleading dashboard counters (`status:"PENDING"` never written; `paymentStatus` never updated; `balance` never maintained).
8. Settings platform-global (M5).

## 11. Minor Issues

- Cookie hygiene (S5, S6); `apiGuardWithContext` 403-masks-500 (S8); prisma localhost fallback (S9); uploads gitignore (S10).
- Legacy `UserRole` fallback (S7).
- `requirePermission` redirects to `/` instead of denying (rbac.ts:91-102); dashboard not gated by `dashboard.view`.
- Nav/quick-create links to routes that don't exist (`/ventes`, `/ventes/proforma/nouveau`, `/rapports`) → 404s.
- Permission key inconsistency (`achats.demande` vs catalog `achats.besoin.*`).
- i18n: 7 used keys missing from dictionaries.
- 2 icon-only buttons in `document-attachments.tsx:168-187` / `document-line-editor.tsx:420-462` without aria-labels.
- Dead code (Q1–Q3), duplicated zod helpers (Q4), duplicated `resolveDocType` (Q5).
- Perf items P1–P8.

## 12. Suggested Improvements

1. **Add `companyId` to the 9 line models** + backfill from parent + add to `COMPANY_SCOPED_MODELS` (removes the whole class of leak, not just the dashboard symptom). Nested creates must then be stamped explicitly (the extension does not intercept nested `create`).
2. **Harden `scopeWhere`/`scopeCreate`**: when an explicit `companyId` is present, verify it equals the context company (or the context is `runUnscoped`).
3. **Reconcile document permissions**: decide granular vs generic; if granular, enforce `permissionPrefix` in routes/service and align seed roles; add `ventes.facture` etc. to seeded MANAGER.
4. **Server-side allowed-conversion map** + status precondition; apply `conversionRate` to amounts or remove the field.
5. **Rate limit login** (in-memory per-IP+username) + dummy-bcrypt for missing users.
6. **MIME allowlist** + `Content-Disposition: attachment` fallback for uploads.
7. **Transactional audit**: run `recordAudit`/`recordActivity` inside the same `$transaction` or make them best-effort (never fail the primary write).
8. **Move `assertStockAvailable` inside the movement transaction** and document the residual race, or use serializable isolation.
9. **Fix dashboard semantics**: drop the always-zero `PENDING` counters or align workflow to write `PENDING`; maintain `paymentStatus`/`balance` (needs a payment flow — feature, so out of scope) or label counters accordingly.
10. **Search**: add pg_trgm GIN indexes; trim per-query table set.
11. **Cleanup**: remove `Client`/`Counter`/`clientId` in a migration; delete `active-branch.ts` and un-wired scripts; dedupe zod helpers and `resolveDocType`; gitignore `uploads/`; add the 7 missing i18n keys; fix dead nav links; gate dashboard with `dashboard.view`.

## 13. Recommended Fix Order

1. C1 privilege escalation (security, cheap, high value).
2. C4 `InventoryMovement` global unique → migration.
3. C2/C3 dashboard leaks + `listWarehouseOptions` (explicit company scoping).
4. S2/S3 login hardening.
5. S4 upload MIME allowlist.
6. D5/D6 + inventory TOCTOU (transactional correctness).
7. D3/D4 conversion validation.
8. D1/D2 document permission reconciliation (needs product decision).
9. Minor batch: i18n keys, cookie hygiene, gitignore, dead nav links, `dashboard.view` gate, dead code cleanup.
10. Performance batch: P1/P2/P3/P6 (low-risk slims).

---

## Quality Gates (run at the end of the stabilization)

- [x] `npx prisma validate`
- [x] `npx prisma generate`
- [x] `npx prisma migrate status`
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Smoke test against running dev server (login + all main pages 200)
