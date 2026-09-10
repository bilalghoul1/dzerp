# Phase 6 — Product Decisions + Authenticated Visual Validation

> **Phase 6 deliverable — evidence and product decisions only. No implementation.**
>
> - Status: **PHASE 6 COMPLETE** (result: **AUTHENTICATION BLOCKED**)
> - Date: 2026-09-05
> - Follow-on from: `admin-dashboard-complete-audit.md` (25 sections) and `admin-dashboard-implementation-roadmap.md` (Phase 5)

---

## 1. Phase Context

Phase 6 resolves the three open **product decisions** of the roadmap (PD-1 dashboard KPI,
PD-2 `/ventes`/`/achats` information architecture, PD-3 canonical permission model), performs
**authenticated visual validation** of the areas previously marked `NOT VERIFIED`, revalidates
audit findings R01–R18 and QW1–QW10, applies the **security gate**, and produces the
**Phase 7 readiness gate**.

**Hard mandate:** this phase takes **decisions and evidence only**. It performs **zero
implementation** — no code, schema, migration, permission, API, navigation or database
changes, no bug fixes (bugs are documented, not fixed), no weakened or bypassed authentication.

## 2. Scope and Non-Goals

**In scope**
- Read code and documentation (source-level evidence).
- Run the application; use only **existing test/development accounts and existing test harnesses**.
- HTTP semantics validation (status codes, redirects, cookies, headers).
- The project's own self-cleaning E2E harness (`scripts/e2e-http.ts`) as a legitimate existing test.
- Security enforcement review (platform vs company plane, permission keys, session hygiene).
- Resolve PD-1, PD-2, PD-3; revalidate R01–R18 and QW1–QW10; security gate; readiness gate.

**Non-goals / explicitly NOT done**
- Any implementation or fix (including confirmed P0 items such as R02 `achats.demande`).
- Any schema, migration, seed, provisioning or data modification.
- Creating or minting sessions outside existing mechanisms; weakening auth; role or permission changes.
- Replacing component styling, navigation restructuring, or UI rewrites.

## 3. Validation Strategy, Evidence and Confidence Standards

- **Confidence levels:** `VERIFIED` (proven — source and/or runtime), `OBSERVED` (seen at
  runtime), `PARTIALLY VERIFIED`, `INFERRED` (deduced), `NOT VERIFIED` (no evidence obtainable).
- **Severity:** P0 (critical), P1 (high), P2 (medium), P3 (low/process).
- Every finding uses: `ID / Route / Screen / Role / Viewport / Language / State / Expected /
  Observed / Evidence / Severity / Related Audit Finding / Related Roadmap Item / Confidence`.
- Cosmetic findings are not inflated; each is tied to a named roadmap item.
- Contradictions with earlier phases are reported as *Previous finding → New evidence →
  Resolution → Impact on roadmap* (never silently rewritten).
- **Roadmap update policy:** the roadmap file is left untouched in this phase; every decision's
  impact on roadmap items is recorded in §24. Roadmap edits are deferred to Phase 7 planning
  (keeps change-control minimal and consistent with the manual).

## 4. Environment and Application State

- Local dev server `http://localhost:3000` (Windows/PowerShell). Public landing → `200`;
  authenticated areas → `307` → `/login`.
- Production build present (`.next/BUILD_ID`); used only by the E2E harness on port 3199.
- Cookies: `dzerp.session` (session), `dzerp.company`, `dzerp.branch`; locale `dzerp.lang`.
  (Sources: `src/lib/constants.ts:20-24`, login route.)
- DB: Neon Postgres (`neondb`); two Prisma clients: `prisma` (soft-delete + companyScope
  extensions) and `prismaBase` (unscoped) — `src/lib/prisma.ts`.
- No `middleware.ts` / `proxy.ts`: authorization is enforced **per route/handler** (see §20).

## 5. AUTHENTICATION BLOCKED

**Interactive authenticated login could not be obtained.** Evidence:

| Item | Evidence |
|---|---|
| Documented demo accounts | `directeur.oran`, `lecteur` — `DzERP-Demo-2026`; dev SA `superadmin` — `Super-Admin-Dev-2026!` (`prisma/seed.ts`, `scripts/ensure-demo-super-admin.ts`) |
| Attempted logins | All returned `401 {"error":{"message":"Identifiants incorrects.","code":"INVALID_CREDENTIALS"}}` (rate limit not hit; polite and legitimate rejection) |
| Actual users in DB (read-only probe) | Only **3**: `superadmin` (SUPER_ADMIN, `mustChangePassword=true`, no companies), `loversmilsad` (COMPANY_ADMIN @ `SKYN`), `ghoul.bilal` (COMPANY_ADMIN @ `gh`) |
| Seed demo accounts | **Do not exist** in this DB — the database was restored via `restore-super-admin` (SA-only provisioning), the demo seed was never run |
| `superadmin` credential | Initially generated with a **random one-time password** (`bootstrap-super-admin.ts`); `mustChangePassword=true`; the printed password is not recoverable from the DB |

Alternatives considered and rejected:
- **Minting sessions via `SESSION_SECRET`** for the purpose of browsing: equivalent to forging
  credentials; violates Phase 5.3 invariants ("never create fake authentication"). Rejected.
- **Running `db:seed` / any provisioning script** to create demo accounts: a destructive /
  data-altering database change. Rejected.
- **The project's own E2E harness (`scripts/e2e-http.ts`)**: a legitimate existing test that
  provisions scoped test sessions, exercises authenticated flows, and cleans up. **USED** — it
  provides genuine authenticated evidence for print/PDF and the security gate (§19).

**Declaration:** `AUTHENTICATION BLOCKED` for interactive, authenticated visual validation.
Authenticated UI rendering therefore remains `NOT VERIFIED` at runtime. Validation was completed
via (i) source-level inspection, (ii) unauthenticated HTTP behaviour, and (iii) authenticated
API-level checks through the existing harness. Sections 12–13 reflect this status honestly.

## 6. Login and Session Evidence

`src/app/api/auth/login/route.ts` (verified in full):
- Zod validation (`username`, `password`); invalid body → `400 INVALID_BODY`.
- **Anti-enumeration timing**: bcrypt comparison always runs against `DUMMY_HASH` when the user
  does not exist (`route.ts:27-28, 61-62`).
- **Rate limiting**: 10 attempts / 60 s per IP and per username → `429 TOO_MANY_ATTEMPTS`
  (`route.ts:44-57`).
- `401 INVALID_CREDENTIALS` (bad credentials), `403 ACCOUNT_DISABLED` (status ≠ ACTIVE).
- On success: `resolveLoginContext` → default company/branch; session created; cookies set
  (`httpOnly`, `sameSite=lax`, `secure` per env); `LOGIN` audit + `lastLoginAt`.
- `mustChangePassword` is returned to the client (`route.ts:121-127`) — enforcement is
  client-side redirect to the password-change flow. **Not** re-blocked at login.

Session semantics (`src/features/auth/session.ts` per Phase 5): HMAC-signed `dzerp.session`,
12-hour TTL, revocation on logout; `getCurrentUser` re-validates row, expiry and userId
(`src/features/auth/rbac.ts:30-102`).

The E2E harness (its own HMAC session minting, test-scoped) verified that sessions validated by
the same code path do authenticate (see §13 for the 15 checks).

## 7. Sources Reviewed

Primary — `docs/ux/admin-dashboard-complete-audit.md`, `docs/ux/admin-dashboard-implementation-roadmap.md`.

Code and runtime evidence:
- `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/financial-pulse.tsx`,
  `src/components/dashboard/kpi-card.tsx`
- `src/app/(app)/ventes/page.tsx`, `src/app/(app)/achats/page.tsx`,
  `src/app/(app)/documents/page.tsx`, `src/components/shell/nav-config.ts`
- `src/components/command-palette.tsx` (prior + referenced), `src/components/shell/*`
- `src/features/auth/rbac.ts`, `src/features/auth/permissions.ts`,
  `src/features/auth/api-guard.ts`, `src/features/auth/session.ts`
- `src/features/company/api.ts`, `src/features/company/resolver.ts`,
  `src/features/company/context.ts`
- `src/features/company-admin/api.ts`, `src/features/company-admin/service.ts` (L1–220,
  L347–417, L566–635), `src/app/api/admin/**`
- `src/app/api/auth/login/route.ts`
- `src/features/documents/engine/config.ts`, `framework/ui-config.ts`, `src/features/print/*`,
  `src/app/api/documents/[id]/pdf/`, `preview/`, `src/features/documents/series.ts`
- `src/features/i18n/dictionaries.ts` (labels §8)
- `prisma/seed.ts`, `scripts/bootstrap-super-admin.ts`, `scripts/ensure-demo-super-admin.ts`,
  `scripts/restore-super-admin.ts`, `scripts/migrate-rbac-two-roles.ts`,
  `scripts/e2e-http.ts`
- Route enumeration (`src/app/(app)/**/page.tsx`, `src/app/api/**/route.ts`) — §20.
- `.env` (presence of `DATABASE_URL`, `SESSION_SECRET` only; values never echoed).

## 8. PD-1 — Dashboard KPI Metric Decision

**Current state (verified in source).** The 4th KPI of the Financial Pulse uses the i18n key
`dashboard.netCashFlow` (`dashboard/page.tsx:451`):

| Lang | Current label | Dict line |
|---|---|---|
| FR | `Trésorerie nette` | `dictionaries.ts:267` |
| AR | `صافي التدفق النقدي` (net cash flow) | `dictionaries.ts:2106` |
| EN | `Net Cash Flow` | `dictionaries.ts:3941` |

**What the metric actually computes** (`dashboard/page.tsx:114-222`, verified):
- `cashFlow = monthlyRevenue − monthlyExpenses`, where
  - `monthlyRevenue` = Σ `totalTtc` of **invoices** issued this month (not cancelled),
  - `monthlyExpenses` = Σ `totalTtc` of **supplier invoices** issued this month (not cancelled),
  - `receivables` = Σ `totalDue` for invoices `UNPAID | PARTIAL | OVERDUE`.
- This is a **monthly accrual billed trade balance** — it ignores cash receipts, bank payments,
  payroll and other outflows. It is **not** treasury and **not** cash flow.

**Decision — relabel, keep the metric, add period + tooltip:**

| Field | Value |
|---|---|
| Current label | FR `Trésorerie nette` — AR `صافي التدفق النقدي` — EN `Net Cash Flow` |
| Recommended label | FR **`Résultat du mois (ventes − achats)`** — AR **`نتيجة الشهر (المبيعات − المشتريات)`** — EN **`Month result (sales − purchases)`** |
| Rationale | The name must reflect the accrual formula, not treasury; avoids a misleading signal (strong billed balance ≠ cash available) |
| Accounting interpretation | Gross commercial result of the month from **issued** invoices; unrealized, pre-operating-expense basis — not net income |
| UX impact | Label truthfulness + expectation setting; a red (`cashFlow < 0`) still reads as negative billed balance |
| Implementation implication | i18n string change (FR/AR/EN) + optional `tooltip` prop on `KpiCard` (component API, non-breaking); **no logic change** |
| Also required | Add a period qualifier on all four KPIs (`ce mois` / هذا الشهر / this month) + tooltip describing the formula; `KpiCard` currently has no tooltip slot |
| Confidence | `VERIFIED` (source); runtime label rendering `NOT VERIFIED` (auth blocked) but the value is server-rendered i18n, so behaviour follows dict change |
| Roadmap impact | Confirms R08 → IMP (BATCH 4) with this wording; period label + tooltip folded into R08 |

## 9. PD-2 — `/ventes` and `/achats` Information Architecture Decision

**Current state (verified in source):**
- `/ventes` → `redirect("/documents")` (`ventes/page.tsx:1-7`).
- `/achats` → `redirect("/documents/purchase_request")` (`achats/page.tsx:1-7`).
  > **Correction vs audit:** the audit recorded both stubs as redirecting to `/documents`.
  > `/achats` actually deep-links into the **purchase requests** list. See §18.
- Sidebar (`companyNavGroups`, `nav-config.ts:48-90`): `/ventes` and `/achats` **are omitted**;
  Documents is the single hub entry. The header `mainNav` (**`nav-config.ts:20,22`**) **still
  lists them** (`nav.ventes`→`/ventes` under `ventes.devis.view`, `nav.achats`→`/achats` under
  `achats.bon.view`).
- Command palette strips both entries (`command-palette.tsx:58-60`).
- `nav-config.ts:42-46` comment claims palette keeps them accessible → **comment/code drift**.
- The Documents hub is permission-filtered per document type (`documents/page.tsx:48-49`:
  `visibleTypes` on `${prefix}.view`, `creatableTypes` on `${prefix}.create`), server-rendered,
  `type=` query param — i.e. the hub **already** implements per-side filtering by the type
  selector, just not a `?side=` shortcut.
- Neither `/ventes` nor `/achats` has any child route; the two stubs are the whole module surface.

**Options (A dedicated pages, B workflow hubs, C redirect into `/documents`, D independent,
E other):** current behaviour is option C (with a purchase-request deep-link). Recommendation:

| Decision |
|---|
| **Adopt Option C — formalize the redirect entry-points into the Documents hub, de-duplicated.** |
| Remove `/ventes` and `/achats` from the header `mainNav` (they duplicate the hub; eliminates stub-redirect UX). |
| Keep the two HTTP routes as **documented redirect deep-links** for URL stability: `/ventes` → `/documents`, `/achats` → `/documents/purchase_request`. |
| Do **not** build separate hub pages now. Filtered views (`/documents?side=sales\|purchasing`, palette entries) are a medium-term enhancement (Option E), not required for Phase 7. |
| Confidence | `VERIFIED` (source). Runtime nav rendering `NOT VERIFIED` (auth blocked). |
| Roadmap impact | Folds into QW5 (nav/palette cleanup, BATCH 3) + R07 (keep DEFER). Closes PD-2 with no BATCH-4 dependency. |

## 10. PD-3 — Canonical Permission Model Decision

**Verified architecture — two planes.**
- **Platform plane:** global role `SUPER_ADMIN` via `UserRole`, no company required. Pages gate
  with `requireSuperAdmin` (404 for non-SA); global `admin.*` permissions are merged in
  `getCurrentUser` (`rbac.ts:91-95`, `137-146`).
- **Company plane:** permissions evaluated through the active company context
  (`RoleAssignment`); canonical company role `COMPANY_ADMIN`; legacy `OWNER/MANAGER/READER`
  folded to `COMPANY_ADMIN` (`migrate-rbac-two-roles.ts`).
- `adminGuard` is explicitly **two-profile** (`company-admin/api.ts:44-76`): SUPER_ADMIN
  (activeCompanyId null) vs company actor (resolved context); `superAdminOnly` locks the
  platform endpoints (`api.ts:25-31`); services add `assertGlobalAdmin` / `assertCompanyAccess`
  counters (`service.ts:63-87`), `assertAssignableRole` (global-roles never assignable to a
  company — `GLOBAL_ROLE_FORBIDDEN`; non-SA can only assign a subset), `listCompanies` scopes
  non-global actors to their active company (`service.ts:350-352`), `createCompany` requires
  `assertGlobalAdmin` (`service.ts:572`).

**Endpoint permission map (verified):**

| Guard class | Endpoints | Profile |
|---|---|---|
| `adminGuard` + `superAdminOnly` | `/api/admin/users*`, `/sessions*`, `/settings`, `/audit` | Platform-only |
| `adminGuard(…)` + service `assert…` | `/companies`, `/companies/[id]/*`, `members/*`, `owner/reset`, `status`, `restore`, `statistics`, `activity` | Two-profile (company admin confined to active company) |

**Provisioning drift (verified):**
- `prisma/seed.ts:249-274` grants `COMPANY_ADMIN`: `admin.company.view`, `.update`,
  `admin.company.membership.manage`, **`admin.audit.view`**. The last is **inert** (audit routes
  are `superAdminOnly`); the first three are legitimately company-scoped in the two-profile model.
- `scripts/bootstrap-rh.ts:14` grants near-complete company admin set **including
  `admin.roles.manage` and `admin.users.manage`** — **inert today** (gated endpoints) but in
  violation of the canonical rule and a **forward risk** (future endpoints that omit
  `superAdminOnly` would trust a company-held `admin.*`).
- `superAdminRole` template (seed `:235-247`): all `admin.*` — correct, keep.
- `restore-super-admin.ts`: creates the legacy `OWNER` role (company-plane) for migration
  compatibility only; `OWNER` must not be re-created by `createCompany`.

**Decision — canonical model:**

| Topic | Canonical rule |
|---|---|
| Platform-only keys | `admin.users.manage`, `admin.sessions.*` (consumer of `admin.users.manage`), `admin.settings.manage`, `admin.audit.view`, `admin.roles.manage`, `admin.company.create`, `admin.company.delete`, `admin.company.archive`, `admin.company.restore` — **grantable only on the global SUPER_ADMIN role; never on any company role** |
| Company-scoped keys | `admin.company.view`, `admin.company.update`, `admin.company.membership.manage` — permitted on the COMPANY_ADMIN template; services confine to the active company |
| `parametres.*` | Company-scoped module permissions (`parametres.view` gate, `parametres.manage` writes) — **not** platform; stay in the company template |
| Source of truth | Single canonical const **`COMPANY_ADMIN_DEFAULT_PERMS`** shared by `seed.ts`, `bootstrap-rh.ts`, provisioning/restore flows (one definition, consumed everywhere) |
| Drift to correct | Remove `admin.audit.view` from seed template and `admin.roles.manage` / `admin.users.manage` (and other non-company-scoped `admin.*`) from `bootstrap-rh.ts`; forbid `OWNER` in `createCompany` unless explicitly a legacy migration path |
| Enforcement | **Unchanged** — the verified defense-in-depth (edge `superAdminOnly` + service assert + subset-rule role assignment) stays as-is; the decision is about **grant hygiene**, not about weakening checks |
| `achats.demande` ↔ `achats.besoin` | **Separate concern** (R02, `engine/config.ts:156` → canonical `achats.besoin.*`). Not part of PD-3; per roadmap R02 IMP BATCH 0 |
| Confidence | `VERIFIED` (source architecture + E2E isolation); runtime platform-plane admin flows `NOT VERIFIED` (no SA credentials) |
| Roadmap impact | New IMP item: *canonical permission const + provisioning template alignment* (early batch, next to R02 hygiene) |

## 11. Visual Validation Framework

Condition matrix: Route / Screen / Role (COMPANY_ADMIN, SUPER_ADMIN) / Viewport
(desktop ≥1280, tablet 768, mobile ≤390) / Language (fr, ar, en) / State (with/without data).

Priorities (mandated):
- **Priority A**: `/dashboard`, `/ventes`, `/achats`, `/documents`.
- **Priority B**: `/stock`, `/stock/entrepots`, `/stock/mouvements`, `/comptabilite`, `/finance`.
- **Priority C**: `/parametres` (all tabs), `/admin` (all pages), forms, tables, print/PDF,
  responsive, RTL fr/ar/en, multi-company/branch.

**Outcome:** because of §5, no authenticated screen could be rendered interactively. Every
Priority A/B/C row below is reported with the evidence actually obtainable (source semantics +
unauthenticated HTTP behaviour + harness), and `NOT VERIFIED` where a rendered screen was required.

## 12. Priority A — Dashboard, Ventes, Achats, Documents

| Route | Expected (from spec) | Observed / Evidence | Status |
|---|---|---|---|
| `/dashboard` | 4-KPI Financial Pulse, charts, pending ops, alerts, quick actions | Source-verified metric set & labels (`page.tsx:411-453, 474-706`); responsive grid `sm:2 xl:4` (`financial-pulse.tsx:36`); empty states present; KPI icons `aria-hidden`, no `role="img"` label (R09). Greeting falls back to `dashboard.team` when no **global** role (`page.tsx:443`) | Source `VERIFIED`; runtime `NOT VERIFIED` |
| `/ventes` | Designated landing context (PD-2) | 307 pattern to `/documents` via `redirect()` in page; nav: header only (`nav-config.ts:20`); palette excluded (`command-palette.tsx:58-60`) | `VERIFIED` (source) |
| `/achats` | Designated landing context (PD-2) | 307 pattern to `/documents/purchase_request` via `redirect()` (**audit correction**); header nav only (`nav-config.ts:22`) | `VERIFIED` (source) |
| `/documents` | Hub: types filtered by permission, type tabs, groups | `requirePermission("documents.read")`; per-type `visible`/`creatable` filtering (`page.tsx:48-49`); server-rendered initial list (pageSize 20); `groups` action; `type=` server filter; no `?side=` | `VERIFIED` (source); runtime `NOT VERIFIED` |

**Authenticated API-level behavior of the same surface** (via existing harness, §13): the
documents/PDF routes authenticate correctly and enforce scope.

## 13. Priority B — Stock, Comptabilité, Finance

| Route(s) | Evidence | Status |
|---|---|---|
| `/stock`, `/stock/entrepots`, `/stock/mouvements` | Routes exist (`page.tsx` enumerated); company-plane guards by permission (`product.view`, inventory/warehouse perms); inventory quantity logic per inventory module | Existence `VERIFIED`; runtime rendering `NOT VERIFIED` |
| `/comptabilite` | Route exists; planned module (accounting NOT implemented — see `accounting-expert`), entry gated by `compta.view` | Existence `VERIFIED`; rendering/behaviour `NOT VERIFIED` |
| `/finance` + subsections (`reconciliation`, `fixed-assets`, `report`, `tax-declarations`) | Routes exist; gated by finance perms; tax-declaration UI feeds the tax module | Existence `VERIFIED`; rendering `NOT VERIFIED` |

All rows inherit the §5 status: **authenticated screens not inspectable**.

**Authenticated harness evidence (existing test, 15/15 OK, ~19 s):**
- FR preview → 200, `application/pdf`, `Content-Disposition: inline`, valid PDF (pdf.js), page
  count 1, document number present, company footer present.
- AR preview → Arabic content + **shaped** Arabic in extracted text.
- Auto type resolution (no `?type=`) → 200; download → 200, `attachment`, valid PDF.
- Unauthenticated → **401**; other-company document → **404**; member without permission → **403**.
- This verifies the print/PDF pipeline end-to-end **at API level** (R04 upgrade) and the
  security isolation enforcement (cross-company + no-permission).

## 14. Revalidation Matrices — R01–R18 and QW1–QW10

Notation: Phase 5 verdict → Phase 6 new evidence → updated verdict. Full finding records kept
in §16 format; only deltas shown.

| ID | Phase 5 | Phase 6 evidence | Phase 6 |
|---|---|---|---|
| R01 | VERIFIED (production-relevant; security flag on `admin.*` for COMPANY_ADMIN) | Drift precisely mapped (§10): `admin.audit.view` in seed inert; `admin.roles.manage`/`admin.users.manage` in bootstrap-rh inert but forward-risk; defense-in-depth verified (edge `superAdminOnly` + service asserts) | VERIFIED — **flag reclassified P1 (drift/hygiene), not P0** |
| R02 | VERIFIED (`achats.demande` at `engine/config.ts:156`; no grants exist) | Confirmed unchanged; distinct from PD-3 | VERIFIED, unchanged |
| R03 | VERIFIED (preview dead code; client duplicate preview; CAS numbering) | No new runtime evidence | VERIFIED |
| R04 | PARTIALLY VERIFIED (print format company-setting only; pdf route no format param) | **Harness verified the pipeline FR+AR, footer, number, download, auto type** at API level | PARTIALLY VERIFIED → PDF pipeline **VERIFIED (API)**; visual print layout (A4/A5/THERMAL sync) still `NOT VERIFIED` |
| R05 | VERIFIED (parametres gate) | Confirmed `parametres.view` gate + `parametres.manage` writes (no change this phase) | VERIFIED |
| R06 | PARTIALLY VERIFIED | No new runtime evidence | PARTIALLY VERIFIED |
| R07 | PARTIALLY (stubs; palette-strips correction) | `nav-config.ts:42-46` comment claims palette keeps `/ventes`/`/achats` — **palette strips them** (comment/code drift); `/achats` deep-link correction | PARTIALLY — cleanup strengthened for QW5 |
| R08 | PD (BATCH 4) | PD-1 resolved (§8) → IMP with label/tooltip/period | PD RESOLVED → **IMP BATCH 4** |
| R09 | VERIFIED (charts/KPI lack labelling) | `kpi-card.tsx` confirms no `role="img"`/hidden title | VERIFIED |
| R10 | IAV | No change | IAV |
| R11 | IAV | No change | IAV |
| R12 | IMP | No change | IMP |
| R13 | PD | PD-2 resolved (§9) → redirect deep-links, de-duplicated nav | PD RESOLVED → folds into QW5; hub filtered views deferred |
| R14 | IMP | No change | IMP |
| R15 | DEFER | No change | DEFER |
| R16 | IMP | No change | IMP |
| R17 | DEFER | No change | DEFER |
| R18 | IAV | No change | IAV |

| QW | Phase 5 | Phase 6 note | Phase 6 |
|---|---|---|---|
| QW1 | IMP | Labels/consistency (PD-1 wording included) | IMP |
| QW2 | IMP | — | IMP |
| QW3 | IMP | — | IMP |
| QW4 | IMP | — | IMP |
| QW5 | IMP | **Confirmed expanded**: remove `/ventes`/`/achats` from `mainNav`, palette cleanup, fix `nav-config` comment drift, PD-2 nav de-dup | IMP |
| QW6 | IAV | Print — harness added API-level evidence | IAV |
| QW7 | IMP | — | IMP |
| QW8 | IMP | — | IMP |
| QW9 | IMP | — | IMP |
| QW10 | IMP | — | IMP |

## 15. Priority C and Cross-cutting Evidence — Paramètres, Admin, Forms, Tables, Print, Responsive, RTL, Multi-company

- **`/parametres`** tabs (units, taxes, referentiels, preferences, numbering, currencies,
  branches) all exist; layout gates `parametres.view` (R05); writes `parametres.manage`;
  settings API hides secrets (R05). Runtime `NOT VERIFIED`.
- **`/admin`** (platform plane): pages exist (`admin/*` incl. users, sessions, settings,
  security, maintenance, companies CRUD, audit, analytics, backups); **all gated by
  `requireSuperAdmin`** → 404 for any non-platform user. Runtime `NOT VERIFIED` (no SA login).
- **Forms/tables**: shared UI primitives (`Button`, `Card`, etc.) used consistently;
  hub tables server-rendered. Not rendered at runtime this phase.
- **Print/PDF**: pipeline `VERIFIED` at API level (FR+AR, footer, number, download, auto type);
  A4/A5/THERMAL renderer paths exist (`print/renderer.ts:85-89`); visual sync `NOT VERIFIED`.
- **Responsive**: grid classes observed (e.g. `financial-pulse.tsx:36`, KPI cards); viewport
  matrix not executed (auth blocked).
- **RTL/BiDi fr/ar/en**: trilingual dictionaries present (AR strings in §8 verified); the
  `dzerp.lang` locale cookie exists; runtime RTL layout inspection `NOT VERIFIED`.
- **Multi-company/branch**: `CompanyContext` resolution via `dzerp.company`/`dzerp.branch`;
  company scope enforced at Prisma level + API guards; cross-company refusal `VERIFIED` by
  harness (404). Branch switch UI runtime `NOT VERIFIED`.

## 16. Findings Log

| ID | Finding | Details | Severity | Roadmap |
|---|---|---|---|---|
| F16.1 | Dashboard KPI mislabeled as treasury/cash flow | `dashboard.netCashFlow` = FR `Trésorerie nette`, AR `صافي التدفق النقدي`, EN `Net Cash Flow`; metric is accrual billed trade balance | P1 (clarity) | R08 → PD-1 (§8) |
| F16.2 | KPIs lack period qualifier/tooltip | All four Financial Pulse KPIs show bare values | P2 | R08 (folded) |
| F16.3 | KPI cards/charts not labelled for AT | No `role="img"`/assistive title | P2 | R09 |
| F16.4 | `nav-config` comment vs palette drift | Comment claims palette keeps `/ventes`/`/achats`; `command-palette.tsx:58-60` strips them | P2 (docs) | QW5 |
| F16.5 | `/achats` redirect target misrecorded in audit | Actual: `/documents/purchase_request` (not `/documents`) | P2 (docs) | §18 |
| F16.6 | Company template carries inert/non-company `admin.*` | seed `admin.audit.view`; bootstrap-rh `admin.roles.manage`/`admin.users.manage` — defended but drifting | P1 | PD-3 (§10) |
| F16.7 | `mainNav` retains `/ventes`/`/achats` stubs | Header parity with sidebar/palette missing | P2 (cleanup) | QW5 |
| F16.8 | Platform-plane SA runtime unverified | No credentials; security enforced in source + API-level isolation verified | P3 (process) | Phase 7 pre-flight |
| F16.9 | Demo provisioning vs restore divergence | Seed demos absent where `restore-super-admin` used; dev friction for validation | P3 (process) | Phase 7 pre-flight |
| F16.10 | Greeting fallback when no global role | `user.roles[0]?.role.name ?? "team"` — company-only users see generic label | P3 | QW1 |

All findings carry Confidence `VERIFIED` (source) except where runtime rendering was required
(then `NOT VERIFIED` runtime, as flagged in §12–15).

## 17. Open and Deferred Issues

- Runtime authenticated visual validation (Priority A/B/C) — deferred to Phase 7 after demo
  accounts are provisioned (§23/§27).
- `?side=` filtered hub views (PD-2 Option E) — deferred, non-blocking.
- OWNER legacy-role exit policy for existing single-tenant companies — open under PD-3 hygiene.
- Print A4/A5/THERMAL visual sync — deferred (IAV), needs a device/format test in Phase 7.

## 18. Contradictions and Corrections vs Previous Findings

| Previous finding | New evidence | Resolution | Roadmap impact |
|---|---|---|---|
| Audit: `/achats` redirect stub → `/documents` (both stubs identical) | `/achats` → `/documents/purchase_request` (`achats/page.tsx:6`) | Corrected in §9/§16 F16.5 | PD-2 wording; deep-link kept |
| Phase 5: command palette strips `/ventes`/`/achats` (R07 correction) | `nav-config.ts:42-46` comment still claims palette keeps them | Both true in code; comment must be fixed | QW5 (doc fix) |
| Phase 5: `admin.*` on company template = "security flag" | Endpoint map + service asserts prove **no runtime elevation**; recomputed dry-run: seed `admin.audit.view`, bootstrap-rh `admin.roles.manage`/`admin.users.manage` all inert at gated endpoints | Reclassified **P1 drift/hygiene**, not P0 | PD-3 IMP (template alignment) |
| Phase 5: R04 PARTIALLY VERIFIED | Harness: FR/AR PDF, footer, number, download, auto-type — 15/15 | Pipeline VERIFIED at API level | R04 wording updated |
| Phase 5: roadmap applied `?side=` recommendation for PD-2 | Runtime analysis: `?side=` absent; redirect stubs + hub already provide the function | PD-2 = Option C (deep-links, de-duplicated); `?side=` deferred | R13 → QW5; no BATCH-4 dependency |

No source file was modified in this phase; the roadmap file is intentionally left untouched
(its planned edits are recorded in §24).

## 19. Security Gate

Question-based gate, answer per evidence:

| Question | Answer | Evidence / Confidence |
|---|---|---|
| Can a COMPANY_ADMIN manage platform roles/users? | **No** — `/admin` pages `requireSuperAdmin` (404); users/sessions/settings/audit endpoints return 403 via `superAdminOnly`; `assertGlobalAdmin` in services | `VERIFIED` (source); runtime `NOT VERIFIED` |
| Can a COMPANY_ADMIN access another company? | **No** — `listCompanies` scopes non-global actor to active company (`service.ts:350-352`); `assertCompanyAccess`; companyScope Prisma ext; harness: other-company doc → **404** | `VERIFIED` (source + harness) |
| Can an unauthenticated user reach protected data? | **No** — pages 307→`/login`; APIs **401** (harness) | `VERIFIED` |
| Can a user act without the permission? | **No** — `requirePermission` → 404 (pages), `apiGuard` → 403 (APIs); harness member-without-permission → **403** | `VERIFIED` (source + harness) |
| Role plane segregation respected? | Global roles (`ADMIN`/`SUPER_ADMIN`) never assignable to a company (`GLOBAL_ROLE_FORBIDDEN`); non-SA can only assign a permission subset | `VERIFIED` (source) |
| Session hygiene? | HMAC-signed cookie, 12h TTL, revocation, `mustChangePassword` surfaced, anti-timing dummy hash, rate limit 10/min | `VERIFIED` (source) |

**Gate result: PASS WITH CONDITIONS.** Conditions: (1) apply PD-3 template alignment so
company templates never carry non-company-scoped `admin.*` (forward-risk removal); (2) execute
an interactive SUPER_ADMIN session test when credentials exist (not possible this phase).

## 20. Route and Guard Inventory (authorization enforcement map)

No middleware: every guard is per-route server-side.

- **Public:** landing, `/login`, `/api/auth/login`, `/api/auth/register`.
- **Authenticated, company plane:** dashboard, crm, documents, stock, production, rh,
  parametres, comptabilite, finance, rapports, compte — `requireUser` + `requirePermission(key)`
  on pages; `apiGuardWithContext` + `runScoped` on APIs.
- **Platform plane (`/admin`, `/api/admin`):** `requireSuperAdmin` (pages); `adminGuard` +
  `superAdminOnly` or service `assertGlobalAdmin`/`assertCompanyAccess` (APIs).
- **Stubs:** `/ventes`, `/achats` — redirects inside the page body (no child routes).
- **Full route list** enumerated from filesystem in §12–15 and the API glob (27 admin routes,
  100+ total), consistent with the guard patterns above.

## 21. Change Control and Diff Review

Baseline (`git status --short`):
```
?? docs/ux/admin-dashboard-complete-audit.md
?? docs/ux/admin-dashboard-implementation-roadmap.md
```
`git diff --stat` → empty. The two untracked files are the phase deliverables (audit, roadmap);
no tracked source file is modified or pending.

After this phase, the only new artifact is `docs/ux/phase6-product-decisions-visual-validation.md`
(untracked, as expected). **No source, config, schema or seed diff exists.**
`Implementation performed: NONE` is thereby materially true — verified via `git status`/`git diff`,
not merely asserted.

## 22. Evidence Artifacts and Reproduction

| Artifact | Content | Reproduce |
|---|---|---|
| E2E harness | 15/15 OK — FR/AR PDF, download, auto-type, 401/404/403 | `npx tsx scripts/e2e-http.ts` (self-cleaning; production build required) |
| Login attempts | 401 INVALID_CREDENTIALS ×3 | `curl` POST `/api/auth/login` (JSON body via file) |
| DB probe | Only 3 users; no seed demos; SA `mustChangePassword=true` | read-only `npx tsx -e` with `prismaBase` (no writes) |
| Route enumeration | `page.tsx`/`route.ts` globs (§20) | glob on `src/app` |
| Source reads | All §7 files | in-repo |

DB state check for harness cleanliness: the harness deletes its users/companies on completion
(observed OK, no residue expected).

## 23. Assumptions and Limitations

- No interactive session or browser screenshot tooling was available; authenticated screens
  were **not** render-inspected. All rendering claims are source-based (i18n/values are
  server-rendered, so dict/code corrections translate directly).
- All commands ran under Windows PowerShell 5.1; JSON bodies sent via files to avoid quoting
  mangling in `curl.exe -d` (earlier `400 INVALID_BODY` was tooling, not app).
- `.env` secrets were only checked for presence, never echoed.
- Phase 7 readiness assumes demo accounts will be provisioned (seed or documented runbook) so
  interactive validation can finally execute.

## 24. Recommended Phase 7 Implementation Scope (from PD-1/2/3)

Explicitly **decisions only**; nothing implemented here.

| Decision → Roadmap mapping | Scope |
|---|---|
| PD-1 → R08 (BATCH 4) | i18n FR/AR/EN relabel as §8 + `KpiCard` tooltip + period qualifier on the 4 KPIs |
| PD-2 → QW5 (BATCH 3) + R07 | drop `/ventes`/`/achats` from `mainNav`; fix `nav-config` comment; keep redirects; palette cleanup |
| PD-3 → new IMP item (early batch, next to R02) | canonical `COMPANY_ADMIN_DEFAULT_PERMS` const; align seed/bootstrap-rh; forbid OWNER in `createCompany`; classify admin keys per §10 |
| R02 (unchanged, BATCH 0) | `engine/config.ts:156` fix to `achats.besoin.*` (one-line; no data migration) |
| R04 (unchanged) | IAV print A4/A5/THERMAL visual check in Phase 7 |

## 25. Confirmation and Sign-off Checklist

- [x] Security gate applied (§19) — PASS WITH CONDITIONS.
- [x] PD-1 resolved with FR/AR/EN labels + accounting interpretation (§8).
- [x] PD-2 resolved with evidence-based IA choice (§9).
- [x] PD-3 canonical permission model defined with key classification (§10).
- [x] R01–R18 and QW1–QW10 revalidated with Phases 6 evidence (§14).
- [x] AUTHENTICATION BLOCKED declared with full justification (§5–§6).
- [x] No implementation, no DB/schema/RBAC/nav change (§21, §30).
- [x] All contradictions documented (§18).
- [x] Readiness gate produced (§28).

## 26. Final Report

```
PHASE 6 COMPLETE — RESULT: AUTHENTICATION BLOCKED
Contexte : Phase 6 – product decisions + authenticated visual validation.

Produit (décisions) :
  PD-1  Dashboard KPI : relabel « Trésorerie nette/صافي التدفق النقدي/Net Cash Flow »
        → « Résultat du mois (ventes − achats) / نتيجة الشهر (المبيعات − المشتريات) /
        Month result (sales − purchases) » + tooltip + période (IMP, BATCH 4).
  PD-2  /ventes & /achats : Option C — entrées de redirection dans le hub Documents,
        navigation dé-dupliquée (retrait du mainNav), deep-link achat conservé ; pas de
        nouvelles pages (IMP via QW5, BATCH 3). Correction : /achats → /documents/purchase_request.
  PD-3  Modèle canonique à deux plans : clés platform-only vs company-scoped ; const
        unique COMPANY_ADMIN_DEFAULT_PERMS ; dérive de provisioning reclassée P1 (inert,
        défense en profondeur vérifiée) (nouvel IMP, early batch).

Routes / surface validées :
  HTTP public (200) : landing ; protégées : 307 → /login.
  Harness existant (15/15) : PDF FR+AR (footer, numéro, téléchargement, auto-type),
  401 non-authentifié, 404 inter-société, 403 sans permission.
  /ventes, /achats, /documents, /dashboard, /stock*, /comptabilite, /finance*,
  /parametres*, /admin* : existance rôles + gardes VÉRIFIÉES (source) ;
  rendu interactif NON VÉRIFIÉ (auth bloquée).

Sécurité : GATE PASS — CON DITIONS (alignement provisioning PD-3 ; test SA interactif
en Phase 7). Cross-company 404 / no-permission 403 vérifiés par harness.

Révalidation : R01–R18 + QW1–QW10 (§14). R04 renforcée (PDF pipeline VERIFIED-API) ;
R08/R13 PD résolus ; R01 flag reclassé P1.

Phase 7 readiness : READY WITH CONDITIONS (détail §28).

Implementation performed: NONE (aucune modification de code, schéma, permissions,
navigation, base de données ou seed ; seul document créé : ce rapport).
```

## 27. Phase 7 Pre-flight Checklist

- Provision authoritative demo sessions: document/runbook that guarantees at least one
  interactive COMPANY_ADMIN and one SUPER_ADMIN with known credentials (reconcile seed vs
  restore-super-admin divergence; F16.9).
- Execute the interactive security tests deferred from §19 (SA sessions, cross-company admin
  flows), plus the R06/R10/R11 IAV checks.
- Re-run `npx tsx scripts/e2e-http.ts` after R02/permission changes as regression (cheap).
- Prepare the print format test (A4/A5/THERMAL) for R04 visual IAV (device/format).

## 28. Phase 7 Readiness Gate

```
READY WITH CONDITIONS

Blocage / conditions préalables :
  1. Provisionner des comptes démo interactifs (COMPANY_ADMIN + SUPER_ADMIN) avec
     un runbook documenté (garde Anti-régression : e2e-http doit rester vert).
  2. Aligner le provisioning sur le modèle canonique PD-3 (template COMPANY_ADMIN
     sans admin.* non company-scoped) AVANT tout nouveau déploiement de rôles.
  3. Exécuter le test SA interactif de la §19 (plateforme) en Phase 7.

Décisions requises avant les BATCH : PD-1 (R08 wording, §8) et PD-2 (nav, §9) —
résolues dans ce rapport.
Corrections mineures obligatoires (ne bloquent pas le READY mais à traiter en début
de Phase 7) : R02 achats.besoin (BATCH 0), QW5 nav/comment, R08 labels.

Phase 7 first batch (proposé) : BATCH 0 (R01/R02 + provisioning canonique PD-3) puis
BATCH 1 (R03), BATCH 2 (R04-IAV, R05, R12), BATCH 3 (QW5 incl. PD-2), BATCH 4 (R08/PD-1),
BATCH 5 (R09, R14, R18-IAV), BATCH 6 (R10/R11 IAV), BATCH 7 (R15/R17).

Conditions de sécurité : serveur — aucune baisse de garde ; chaque commit adjoint les
tests §22 ; aucune permission n'est ajoutée à un rôle société sans avis §10.
Conditions de produit : les libellés §8/§9/§10 sont figés avant implémentation UI.
Conditions visuelles : la validation visuelle interactive (Priorités A/B/C) repasse en
tête de Phase 7 dès que les comptes démo existent.
```

## 29. Phase 7 Handoff

```
PHASE 7 SHOULD IMPLEMENT :
  - R02 (achats.besoin.*) — BATCH 0.
  - Provisioning canonique PD-3 (COMPANY_ADMIN_DEFAULT_PERMS + alignement seed/
    bootstrap-rh/restore ; interdiction OWNER à la création via createCompany).
  - R08/PD-1 : labels KPI FR/AR/EN + tooltip + période.
  - QW5/PD-2 : retrait /ventes & /achats du mainNav, fix du commentaire nav-config,
    nettoyage command palette ; redirects conservés.

PHASE 7 SHOULD NOT IMPLEMENT (sans nouvelle décision) :
  - Nouveaux hubs /ventes et /achats dédiés (Option A/B) ; vues ?side= (différées).
  - Reporting trésorerie réel tant que payments trésorerie non couverts (PD-1).
  - Cross-company admin plane pour COMPANY_ADMIN (contraire au modèle canonique §10).

DEPENDENCIES : comptes démo interactifs (runbook) ; décisions §8/§9/§10 figées.

REGRESSION TESTS REQUIRED : e2e-http (15 checks) après R02 et provisioning ;
login/session (401/403/429) ; iso-société (404 cross-company).

VISUAL REGRESSION REQUIRED : dès comptes démo — Priorités A/B/C (viewport desktop/
tablette/mobile, fr/ar/en, RTL), flux login→compte, documents hub, parametres,
admin (SA), impression A4/A5/THERMAL.
```

## 30. Declaration

I declare that during Phase 6: **no code, schema, migration, permission, role, navigation,
database, seed or configuration change was made**; no authentication mechanism was created,
weakened or bypassed; the only artifact produced is this report. The statement
"Implementation performed: NONE" is backed by `git status`/`git diff` (§21). All runtime
authenticated evidence was obtained through the project's own existing self-cleaning test
harness; interactive authenticated visual validation was not possible and is declared
AUTHENTICATION BLOCKED (§5).