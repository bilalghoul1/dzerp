# Phase 7 — P0/P1 Implementation Report

Status: **COMPLETE** — all items mandated as IMPLEMENT (IMP) in Phase 5/6 are
shipped and verified. Items mandated as IAV (implement-after-validation) remain
deferred and are documented in §11 — authentication for interactive visual
validation is still unavailable (see §11.1).

---

## 1. Executive Summary

Phase 7 applied the Phase 5 roadmap (R01–R18, QW1–QW10, PD-1/2/3) and the
Phase 6 product decisions to the DzERP codebase. All IMP items are done; the
RBAC canonical permission model is enforced code-first; no Prisma schema change,
no migration, and no API contract change were introduced.

**Implemented (9 of the P0/P1/P2 IMP items + 8 quick wins):**
PD-3, R01/QW8, R02, R03, R05, R08 (PD-1 label), R09/QW3, R12, R13 (PD-2), R14/QW2,
R16/QW4, QW1, QW5, QW7, QW9, QW10.

**Deferred (validated-only, gated on Phase 6 visual validation):**
R04 (print format param), R06 (detail CTAs — see §10 deviation), R10, R11, R18,
QW6; plus DEF items R07-kernel, R15, R17.

**Verification:** `npx tsc --noEmit` PASS, `npm run lint` PASS (0 errors, 9
pre-existing warnings — baseline unchanged), `npm run build` PASS, canonical
permission model runtime checks PASS (see §3).

---

## 2. Scope & Method

- **Batches** B0 (PD-3/R01/R02), B1 (R03/QW1), B2 (R05/R12/QW10), B3 (PD-2/QW5/QW4/QW7),
  B4 (PD-1/R08), B5 (R09/QW3, R14/QW2), B6+ (remaining IMP).
- **Constraints honored:** no schema/migration, no business-logic change, no API
  contract change, server-side authorization preserved, company isolation
  preserved (`prisma` extended client — company-scope + soft-delete), i18n added
  in all three locales (FR/AR/EN) with RTL-safe markup.
- Every DB read introduced in this phase goes through the `companyScope`
  extension (auto-filtered by the active company context); the new
  `?productId=` filter in the movements page is validated server-side against
  the company's own products (see §10).

---

## 3. RBAC Security Verification

Canonical model (`src/features/auth/permissions.ts`), verified at runtime with
`tsx`:

| Check | Result | Evidence |
|---|---|---|
| Total permission keys in catalog | 125 | `Object.keys(PERMISSIONS).length` → 125 |
| `COMPANY_ADMIN_DEFAULT_PERMS` | 118 | runtime size check → 118 |
| `SUPER_ADMIN_DEFAULT_PERMS` | 10 | runtime size check → 10 |
| `PLATFORM_ONLY_PERMISSIONS` | 7 | `admin.users.manage, admin.roles.manage, admin.audit.view, admin.company.create, admin.company.archive, admin.company.delete, admin.company.restore` |
| Platform keys leaking into company set | 0 | filter → 0 matches |
| Catalog keys missing from both sets | 0 | full coverage |
| `admin.*` kept by COMPANY_ADMIN | 3 (company-scoped) | `admin.company.view, admin.company.update, admin.company.membership.manage` — deliberate SUPER_ADMIN ⇄ COMPANY_ADMIN boundary per PD-3 |

`SUPER_ADMIN_DEFAULT_PERMS` = `admin.users.manage, admin.roles.manage,
admin.audit.view, admin.company.view, admin.company.create, admin.company.update,
admin.company.archive, admin.company.delete, admin.company.restore,
admin.company.membership.manage`.

**Provisioning converge:** `prisma/seed.ts`, `scripts/bootstrap-rh.ts`, and
`scripts/restore-super-admin.ts` now import the same canonical consts — the
divergent hard-coded literal sets (seed 249–274, bootstrap-rh 95-key literal
including dead `rh.employee.document.*` and platform keys) are removed.
`scripts/migrate-rbac-two-roles.ts` and the onboarding path consume DB state /
existing COMPANY_ADMIN grants, so they inherit the canonical set automatically.
Platform keys were stripped from the SUPER_ADMIN-role provisioning path it is
unconditionally required (`restore-super-admin.ts`).

---

## 4. R01 / QW8 — COMPANY_ADMIN grant alignment

| Source | Before | After |
|---|---|---|
| `prisma/seed.ts` | literal `companyAdminPerms` (omitted `documents.*`, `ventes.*`, `achats.*`, `compta.*`, `rapports.view`, `rh.employee.*`, `rh.contract.*`, `rh.payroll.*`) | filter of `COMPANY_ADMIN_DEFAULT_PERMS` |
| `scripts/bootstrap-rh.ts` | 95-key literal incl. platform keys + dead `rh.employee.document.*` | `[...COMPANY_ADMIN_DEFAULT_PERMS]` |
| `scripts/restore-super-admin.ts` | `startsWith("admin.")` implicit set | explicit `SUPER_ADMIN_DEFAULT_PERMS` filter; OWNER grants = `COMPANY_ADMIN_DEFAULT_PERMS` |

Runtime check: 118 company keys, 10 super keys, 0 leaks, 0 missing (see §3 table).

---

## 5. R02 — Purchase Request prefix

`src/features/documents/engine/config.ts:156` `PURCHASE_REQUEST.permissionPrefix`
changed `achats.demande` → `achats.besoin`. Every engine prefix now maps to a
real catalog key (verified: `achats.bon`, `achats.besoin`, `achats.reception`,
`achats.facture`, `ventes.bcclient`, `ventes.devis`, `ventes.proforma`,
`ventes.commande`, `ventes.livraison`, `ventes.facture`, `ventes.avoir`,
`crm.*`, `inventory.*`, `parametres.*`).

---

## 6. R03 / QW1 — Numbering preview (settings + create forms)

**Settings (`/parametres/numbering`):**
- The "next number" preview is now **server-driven** — `numbering/page.tsx`
  computes `next: formatSeriesNumber(s, s.nextValue)`; the client `preview()`
  guess is removed; `series-manager.tsx` shows `row.next` with the
  `parametres.seriesIndicative` note.
- `/api/series` GET had a latent BigInt serialization bug (could 500 when data
  existed); fixed with `nextValue: Number(s.nextValue)` so `SeriesManager`
  `refresh()` after save works.

**Create forms (QW1):** `previewNextDocumentNumber(type)` added in
`src/features/documents/series.ts` — **read-only, never reserves** (the CAS
`nextDocumentNumber` remains the only allocator). `document-editor-page.tsx`
computes it server-side (create mode only) and `document-header.tsx` renders an
indicative hint under the number field (`documentsUI.nextNumberIndicative`).
Route `/documents/[type]/nouveau` is now `force-dynamic` to keep the preview
fresh.

**Security note:** the preview read uses the extended `prisma` client
(company-scoped). It filters by active series + doc type; it never increments.

---

## 7. PD-1 / R08 — Dashboard financial label

`dashboard.netCashFlow` relabeled to the PD-1-approved semantics,
computation unchanged:
- FR "Résultat du mois (ventes − achats)", AR "نتيجة الشهر (المبيعات − المشتريات)",
  EN "Month result (sales − purchases)".
- Added `netCashFlowHint` (tooltip explaining composition) + `thisMonth`
  period sublabel, satisfying the "explicit period label" non-negotiable.
- `kpi-card.tsx` gained a `hint` prop (info icon, `title` + `aria-label`, no
  `role="img"`); `financial-pulse.tsx` and `dashboard/page.tsx` wired labels +
  `sublabel`.

---

## 8. PD-2 / QW5 / QW7 / R13 — Navigation

- **PD-2 (Option implemented):** `/ventes` and `/achats` removed from `mainNav`
  at source (`nav-config.ts`); `/achats` deep-link kept as
  `/documents/purchase_request` in the Command Palette's explicit filter
  (`command-palette.tsx:58-60`). Sidebar now uses the 6 `companyNavGroups`
  (11 entries), reduced from the flat 13. Drift comment updated.
- **QW7:** `min-w-0` + wrapper `<span className="min-w-0 flex-1 truncate">` on
  sidebar labels (Arabic overflow fix), both company and admin blocks.
- **QW4/R16:** `[...module]/page.tsx` now `notFound()` except `aide` (kept as
  ComingSoon placeholder); new `src/app/(app)/not-found.tsx` with suggested
  links (`notFound.*` i18n in 3 locales).

---

## 9. R05 — Settings read-only for non-managers

Server enforcement is unchanged (write APIs keep 403 without
`parametres.manage`). The UI layer now matches:

- `parametres/layout.tsx` computes `canManage` from the authenticated session
  (`session.permissions.includes("parametres.manage")`) and wraps children in
  `SettingsReadOnlyProvider` + `SettingsReadOnlyBanner`
  (`settings-readonly-provider.tsx`, new).
- 8 write-capable settings components consume `useSettingsReadOnly()` and
  disable mutating controls: `company-settings-center` (via `SaveBar` in
  `tabs/shared.tsx`), `branches-manager`, `currencies-form`, `preferences-form`,
  `lookups-manager` (add/edit/toggle/save), `taxes-form`, `units-form`,
  `series-manager` (inputs + switches + save).
- i18n `parametres.readOnlyTitle`/`readOnlyDescription` (3 locales).
- Fail-closed: because the banner + disabled controls are UI conveniences, the
  server (not the context) remains the authority.

---

## 10. R12 / QW10 — Document editor party quick-create + movements CTA

**R12 (inline quick-create):** `quick-create-party-dialog.tsx` (new) — a "+"
button next to the customer/supplier select in `document-header.tsx` opens a
dialog (name / type COMPANY|INDIVIDUAL / phone / email). It POSTs to
`/api/customers` or `/api/suppliers` (server-side `crm.customer.create` /
`crm.supplier.create` permission + company scoping + audit + activity), then
`editor.addParty()` appends the new party to local lookups **and selects it**
(`document-editor-context.tsx`). The "+" is only rendered when the user holds
the matching create permission (`EditorPermissions.partyCreate`). All created
entities go through the existing validated schemas — no trust boundary is
lowered.

**QW10 (detail CTAs):**
- Customer detail: the roadmap's "Create Invoice" CTA already exists on
  `crm/customers/[id]/page.tsx` (PageHeader actions, gated per quick-create
  permission, `?customerId=` prefill) — no change needed; verified present.
- Product detail: **no product detail page exists** (products manager is a
  table + modal; no `[id]` route under `stock`/`production`). Per §16 analysis,
  the CTA was implemented at the product row: "Movements" ghost button →
  `/stock/mouvements?productId=…`. The movements page now honors `?productId=`
  **server-side**: `listInventoryMovements(productId?)` /
  `getStockOnHand(productId?)` filter, and the id is validated against the
  company's own product list (`options.products.find`) before use — an
  arbitrary id is ignored. `InventoryManager` shows a "Filtered by / Clear
  filter" banner.

**A11y:** filter banner + CTA use labeled buttons; the quick-create dialog uses
native form controls; charts/alerts got `aria-label`/`sr-only` text (R09/QW3,
R14/QW2). Severity chips in `alerts-feed.tsx` now carry visible text
(`dashboard.alertCritical/alertWarning/alertInfo`).

---

## 11. Deferred Items (validated-only, IAV) — NOT IMPLEMENTED

### 11.1 Blocker
Interactive authenticated visual validation remains **unavailable** (no known
credentials for real DB users; seed demo accounts do not exist on this DB; all
authenticated routes 307 at runtime). Consequently every Phase-6-gated item
stays deferred, by design, until an authenticated COMPANY_ADMIN session can be
opened.

| Item | Rationale |
|---|---|
| R04 | THERMAL print format param — device verification required |
| R06 | Detail-page CTA layout — runtime-verification needed (§10 shows a scoped implementation of the product/customer subset inside QW10) |
| R10 | Product form split (~540-line modal) — Phase 6 form review |
| R11 | Branch selector / branchId coverage — coverage NOT VERIFIED |
| R18 | `/compte` change-password runtime check |
| QW6 | `required` markers + inline validation on product/CRM forms |

DEF items unchanged: R07 full kernel (LT1) / R15 (dictionary split 5518 lines) /
R17 (per-record activity panel).

---

## 12. Test Results

| Test | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** | clean after every batch, incl. final state |
| `npm run lint` | **PASS** | 0 errors, 9 warnings — identical to baseline (pre-existing, incl. `print/renderer.ts:215` and TanStack Table `react-hooks/incompatible-library` in `companies-table.tsx`) |
| `npm run build` | **PASS** | full production build completes |
| Canonical model runtime invariants (tsx) | **PASS** | 125 total / 118 company / 10 super / 7 platform-only / 0 leaks / 0 missing / exactly 3 `admin.*` in company set |
| Permission-key spot check | **PASS** | `ventes.facture.create`, `ventes.devis.create`, `ventes.commande.create`, `ventes.livraison.create`, `ventes.proforma.create`, `ventes.bcclient.create`, `crm.customer.create`, `crm.supplier.create`, `inventory.create/adjust/transfer`, `parametres.view/manage` all present in catalog |
| Interactive visual validation | **NOT RUN (BLOCKED)** | see §11.1 |

No `test` script exists in this project; lint/tsc/build + runtime module checks
are the project's verification gates (per AGENTS.md / package.json).

---

## 13. Security Assessment

- **Server-side authorization unchanged and authoritative.** Every mutation
  (documents, settings, parties, series) still enforces its permission key in
  the API layer; the UI read-only state and muted nav rows are presentation
  only and add no bypass surface.
- **No new trust boundary lowered.** The quick-create dialog inserts customers
  through the existing `customerCreateSchema`/`supplierCreateSchema` and API
  guards (`apiGuardWithContext`), with audit + activity records.
- **Company isolation preserved.** All new reads (number preview, movements
  filter, quick-create) flow through the `companyScope` client. The movement
  `?productId=` filter is validated against the active company's own products;
  a foreign id is ignored (server returns the unfiltered journal instead of a
  cross-company leak).
- **Numbering integrity preserved.** QW1 preview is non-reserving; the CAS
  allocator remains the single writer of `DocumentSeries.nextValue`.
- **Canonical provisioning eliminates drift risk** between seed / bootstrap-rh /
  restore-super-admin / onboarding (single const in `permissions.ts`).

---

## 14. Diff Scope

37 files modified + 3 new (all batch-scoped): canonical consts + 3 provisioning
scripts; engine config prefix; series preview + API BigInt fix; settings
read-only (layout + 8 components + banner); dashboard PD-1/R09/R14; nav
PD-2/QW4/QW7/QW9; document editor QW1/R12/party dialog; inventory QW10 filter;
i18n (all keys × 3 locales). No schema, no migration, no lockfile change.

---

## 15. Phase 8 Recommendation

1. **Unblock Phase 6 visual validation** (provision a seeded demo company +
   COMPANY_ADMIN/SUPER_ADMIN credentials on the dev DB, or document the
   production credentials) — this is the single gating dependency for
   R04/R06-remaining/R10/R11/R18/QW6.
2. **Run the inclusive `?productId=` movements entry** against a seeded company
   with stock data (movement journal + stock-on-hand filter) to confirm UX.
3. **Then** build R04 (print format A4/A5/THERMAL with device validation),
   the product form split (R10), branch-selector coverage (R11), and QW6
   inline validation during the Phase 6 form review.
4. Background architecture (no user impact): dictionary split (R15) and
   per-record activity panel (R17) remain DEFered to a dedicated refactor phase.