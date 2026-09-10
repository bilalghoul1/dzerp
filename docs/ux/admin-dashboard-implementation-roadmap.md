# DzERP — Admin Dashboard Implementation Roadmap

> Date: 2026-09-05 · Source: `docs/ux/admin-dashboard-complete-audit.md` (v1)
> Phase: 5 — POST-AUDIT TECHNICAL VALIDATION & IMPLEMENTATION PLAN
> Method: read-only. No application code, Prisma schema, migration, business logic, RBAC/permission, API, database, or UX code was modified during this phase. All findings below are code-verified via `file:line` evidence.
> Terminology follows the audit: recommendations `R01`–`R18`, quick wins `QW1`–`QW10`, `P0`/`P1`, `NOT VERIFIED`, `REQUIRES PRODUCT DECISION`.

---

## 1. Executive Summary

The complete admin/ERP UX audit identified **2 P0**, **4 P1**, **12 P2–P3** recommendations plus **10 quick wins**. Phase 5 re-validated every critical finding against the source code (no runtime access to authenticated screens — all authenticated routes confirmed to 307-redirect at `localhost:3000`).

**Every P0 and P1 finding was confirmed as real.** Two important nuances were discovered during validation that *reinforce* the audit report:

1. **R01 is production-relevant, not a dev-seed quirk.** `prisma/seed.ts:249-274` ships a restricted COMPANY_ADMIN grant; `bootstrap-rh.ts:14` ships a near-complete grant; `restore-super-admin.ts` ships its own third variant. Because `migrate-rbac-two-roles.ts` grants "the OWNER's set at migration time", **the real permission state of any database depends on which provisioning script ran when**. The canonical permission model must be defined and deduplicated before any grant is extended.
2. **R02 is a one-line engine fix.** Every consumer (permission catalog `permissions.ts:207,212`, `quick-create.tsx:47`, `bootstrap-rh.ts`, `nav-config.ts:22`) already uses `achats.besoin.*`. Only `engine/config.ts:156` uses `achats.demande`. No `achats.demande` grant row exists anywhere, so **no data migration is required** — only the config change plus a safety reconcile check.

**One permission-plane risk was flagged for BATCH 0:** `bootstrap-rh.ts` grants platform-plane keys (`admin.roles.manage`, `admin.users.manage`, `admin.company.*`) to the COMPANY_ADMIN role. The canonical permission model step must decide the correct split between the SUPER_ADMIN (platform) and COMPANY_ADMIN (company) planes.

**One product decision is required before BATCH 4:** the dashboard metric labelled "Net cash flow" is actually `monthly invoiced sales − monthly supplier purchases` (`dashboard/page.tsx:216-229`); it is not cash flow. Three relabel candidates are proposed in §5; the final choice is a product decision.

### Decision summary

| Status | R01–R18 count | QW1–QW10 count |
|---|---|---|
| IMPLEMENT | **8** (R01, R02, R03, R05, R09, R12, R14, R16) | **9** (QW1–QW5, QW7–QW10) |
| IMPLEMENT AFTER VALIDATION | **5** (R04, R06, R10, R11, R18) | **1** (QW6) |
| PRODUCT DECISION | **2** (R08, R13) | **0** |
| DEFER | **3** (R07, R15, R17) | **0** |
| REJECTED | **0** | **0** |
| DOCUMENT ONLY | **0** | **0** |

**No code was implemented in this phase.** This document is the execution plan only.

---

## 2. Validation Results — P0 / P1

### P0 — R01: COMPANY_ADMIN seed grant omits critical modules — **VERIFIED (production-relevant)**

| Check | Result |
|---|---|
| `prisma/seed.ts:249-274` `companyAdminPerms` omits `documents.*`, all `ventes.*`, all `achats.*`, `compta.*`, `rapports.view`, `rh.employee.*`, `rh.contract.*`, `rh.payroll.*` | VERIFIED |
| Alternate provisioning sources exist with **different** grants | VERIFIED — `scripts/bootstrap-rh.ts:14` (near-complete), `scripts/restore-super-admin.ts` (restricted variant) |
| `migrate-rbac-two-roles.ts` collapses legacy roles → COMPANY_ADMIN using "OWNER's set at migration time" | VERIFIED — real DB state is script-dependent |
| Production onboarding assigns COMPANY_ADMIN (`registration/service.ts`, `company-admin/service.ts`) and throws `MISSING_COMPANY_ADMIN_ROLE` if role absent | VERIFIED |
| Fresh-company UX impact: sidebar/quick-create filter by permission → Documents, Sales, Purchasing, Comptabilité, Rapports, HR-employees invisible | VERIFIED — `nav-config.ts:48-90`, `sidebar.tsx:32-34`, `documents/page.tsx:48-49` |
| **Security flag:** `bootstrap-rh.ts:14` grants platform keys (`admin.roles.manage`, `admin.users.manage`, `admin.company.*`) on the COMPANY_ADMIN role; `seed.ts:259-261` grants a smaller `admin.company.*` subset | VERIFIED — must be resolved in the canonical permission model before grant extension |

**Decision: IMPLEMENT** (BATCH 0) — but only after the canonical permission model step (§8, BATCH 0 step 0).

### P0 — R02: `achats.demande` vs `achats.besoin.*` — **VERIFIED**

| Check | Result |
|---|---|
| `engine/config.ts:156` → `permissionPrefix: "achats.demande"` | VERIFIED |
| Permission catalog defines only `achats.besoin.view` / `achats.besoin.create` (`permissions.ts:207,212`) | VERIFIED — `achats.demande.*` does not exist |
| Quick Create, bootstrap, and nav all use `achats.besoin.*` | VERIFIED — `quick-create.tsx:47`, `bootstrap-rh.ts:14`, decision evidence |
| Hub filters on `${prefix}.view`/`.create` (`documents/page.tsx:48-49`) → Purchase Request unreachable for every user | VERIFIED |
| Any existing `achats.demande` grant row in code/seed? | **NONE** → no data migration required |

**Decision: IMPLEMENT** (BATCH 0). Canonical key = `achats.besoin.*`. Change `engine/config.ts:156` to `achats.besoin` and add a reconcile script that (a) verifies no `achats.demande` grant rows exist, (b) reports drift between provisioning sources.

### P1 — R03: no document-number preview before save — **VERIFIED (with nuance)**

| Check | Result |
|---|---|
| `previewNextNumber` (`series.ts:46-53`) has **zero callers** | VERIFIED — grep: only definition + audit/roadmap docs reference it |
| `/api/series` GET (`series/route.ts:25-45`) already returns `next: formatSeriesNumber(s, s.nextValue)` server-side | VERIFIED |
| Its only consumer `series-manager.tsx` ignores the server `next` and re-implements `preview()` client-side (`series-manager.tsx:43-47`) | VERIFIED — preview exists in *series settings*, is absent in *document create forms* |
| Atomic allocation is independent (`nextDocumentNumber`, `series.ts:60-88`, CAS) and used by all document paths | VERIFIED — preview must remain informational only |

**Concurrency note (Phase 5 requirement):** a naive preview can mislead under concurrent allocation, because `nextDocumentNumber` is an atomic compare-and-swap while a preview is read-only. Mitigation: label the chip "Prochain N° (indicatif)" and never let the UX imply a reserved number.

**Decision: IMPLEMENT** (BATCH 1) — server-driven preview (wire `previewNextNumber` / reuse `/api/series`), not the duplicated client formatter.

### P1 — R04: print format is setting-only — **VERIFIED**

| Check | Result |
|---|---|
| `print/service.ts:63,84` reads `doc.company.printFormat` (A4/A5/THERMAL) | VERIFIED |
| Renderer branches correctly per format (`renderer.ts:85-89` PAGE_SIZES, THermAL 80mm) | VERIFIED |
| PDF endpoint `/api/documents/[id]/pdf` accepts `type` + `locale` but **no `format` param**; no per-action override | VERIFIED — `pdf/handle.ts:33-53` |
| THERMAL output on a real 80mm device still unverified | NOT VERIFIED → Phase 6 (visual validation plan §11) |

Architecture to preserve: single render pipeline `printDocument` → `PdfEngine.create`; Preview/Print/Download share `handle.ts` (only `Content-Disposition` differs).

**Decision: IMPLEMENT AFTER VALIDATION** (BATCH 2). Add optional validated `format` query param (A4/A5/THERMAL) threaded through `printDocument` → `PdfEngine.create`; default = company setting. Device validation gates shipping.

### P1 — R05: settings visible but inert without `parametres.manage` — **VERIFIED**

| Check | Result |
|---|---|
| Layout gate is `parametres.view` only (`parametres/layout.tsx:9`) | VERIFIED |
| All write APIs require `parametres.manage` (`company/profile` PATCH, `branches` L77/134/189, `settings` POST, `series` PATCH, `lookups` ×3) | VERIFIED |
| `settings` GET reveals secrets only when `includeSecrets: ...includes("parametres.manage")` (`settings/route.ts:24`) | VERIFIED — server-side correct |
| UI shows editable controls to a view-only user → save returns 403 with no explanation | VERIFIED — looks broken, not restricted |

**Decision: IMPLEMENT** (BATCH 2). Server-driven `readOnly` flag passed to the settings UI (derived from permissions); disabled controls + visible "Lecture seule" notice. No change to server enforcement.

### P1 — R06: detail pages lack "next action" CTAs — **PARTIALLY VERIFIED**

Detail-page structure and absence of prominent next-action CTAs are confirmed by audit §9 (customer, supplier, product, document detail). Because these pages were **NOT VERIFIED at runtime**, CTA *placement* must be validated visually in Phase 6 before final layout.

**Decision: IMPLEMENT AFTER VALIDATION** (BATCH 2) — workflow-aware CTAs: customer → "Créer une facture", product → "Voir les mouvements", document → "Convertir en…", plus duplicate action.

---

## 3. Recommendations Matrix R01–R18

Legend — Decision: **IMP** = IMPLEMENT, **IAV** = IMPLEMENT AFTER VALIDATION, **PD** = PRODUCT DECISION, **DEF** = DEFER.
Scores 1–5 (higher = more Impact / more Effort / more Risk / more Confidence).

| ID | Pri | Decision | Batch | Validation | Impact | Effort | Risk | Conf. | Key evidence |
|---|---|---|---|---|---|---|---|---|---|
| R01 | P0 | IMP | 0 | VERIFIED | 5 | 2 | 2* | 5 | `seed.ts:249-274`; `bootstrap-rh.ts:14` (divergent references) |
| R02 | P0 | IMP | 0 | VERIFIED | 5 | 1 | 1 | 5 | `engine/config.ts:156` vs `permissions.ts:207,212`; no `achats.demande` rows |
| R03 | P1 | IMP | 1 | VERIFIED | 4 | 2 | 1 | 5 | `series.ts:46-53` zero callers; `/api/series` already returns `next` |
| R04 | P1 | IAV | 2 | VERIFIED | 3 | 3 | 2 | 4 | `print/service.ts:63,84`; `pdf/handle.ts:33-53` (no format param); THERMAL unverified on device |
| R05 | P1 | IMP | 2 | VERIFIED | 3 | 3 | 1 | 5 | `parametres/layout.tsx:9` vs `parametres.manage` write APIs |
| R06 | P1 | IAV | 2 | PARTIALLY | 3 | 3 | 1 | 3 | Audit §9; pages not runtime-verified |
| R07 | P2 | DEF | 3 (subset) / 7 (kernel) | PARTIALLY | 3 | 4 | 3 | 3 | `nav-config.ts` `companyNavGroups` (sidebar) vs `mainNav` (palette); **correction**: palette *does* strip `/ventes` `/achats` (`command-palette.tsx:58-60`) |
| R08 | P2 | PD | 4 | VERIFIED | 4 | 1 | 1 | 5 | `dashboard/page.tsx:216-229` — `cashFlow = invoice − supplierInvoice` |
| R09 | P2 | IMP | 5 | VERIFIED | 3 | 1 | 1 | 5 | `revenue-chart.tsx`, `top-products-chart.tsx`, `kpi-card.tsx` lack `role="img"` |
| R10 | P2 | IAV | 6 | VERIFIED (code) | 4 | 5 | 3 | 3 | `products-manager.tsx:455-996` (~540-line form) |
| R11 | P2 | IAV | 6 | PARTIALLY | 4 | 4 | 3 | 3 | `branch-selector.tsx` client-only; branchId coverage `NOT VERIFIED` |
| R12 | P2 | IMP | 2 | VERIFIED (gap) | 3 | 3 | 2 | 3 | `quick-create.tsx:56,57` (separate flow) vs inline need |
| R13 | P2 | PD | 3 | VERIFIED | 3 | 3 | 3 | 3 | `ventes/page.tsx`, `achats/page.tsx` redirect stubs |
| R14 | P3 | IMP | 5 | VERIFIED | 2 | 1 | 1 | 5 | `alerts-feed.tsx` color-only severity |
| R15 | P3 | DEF | 7 | VERIFIED | 2 | 4 | 3 | 4 | single 5518-line `dictionaries.ts` |
| R16 | P3 | IMP | 3 | VERIFIED | 2 | 2 | 1 | 5 | `[...module]/page.tsx` catch-all → ComingSoon instead of 404 |
| R17 | P3 | DEF | 7 | VERIFIED | 2 | 4 | 2 | 3 | `activity/service.ts` exists but no per-record panel |
| R18 | P3 | IAV | 5 | NOT VERIFIED | 2 | 2 | 1 | 3 | `/compte` change-password runtime unavailable |

\* R01 risk 2/5 assumes the canonical permission model step removes platform keys from the company role first; the drift between provisioning sources is the primary risk.

---

## 4. Quick Wins Matrix QW1–QW10

All are ≤1 day, server-safe, no schema change (audit §20).

| # | Decision | Batch | Depends on | Note |
|---|---|---|---|---|
| QW1 | IMP | 1 | — | Wire number preview into create forms as hint chip (R03) |
| QW2 | IMP | 5 | — | Visible alert severity text (R14) |
| QW3 | IMP | 5 | — | Chart `role="img"` + aria labels (R09) |
| QW4 | IMP | 3 | — | Catch-all → 404 + suggested links (R16) |
| QW5 | IMP | 3 | — | Remove `/ventes` `/achats` from `mainNav` **at source** (palette already filters at render) |
| QW6 | IAV | 6 | Phase 6 form review | `required` markers + inline validation on product/CRM forms |
| QW7 | IMP | 3 | — | `truncate` on sidebar links (Arabic overflow) |
| QW8 | IMP | 0 | R01 step 0 | Extend COMPANY_ADMIN grant (part of R01) |
| QW9 | IMP | 0 | R01 step 0 | Permission explainer for hidden modules |
| QW10 | IMP | 2 | — | "View Movements" on product detail; "Create Invoice" on customer detail (R06 subset) |

---

## 5. Products Decisions Required

### PD-1 — Dashboard metric label (BATCH 4, gates R08)

**Verified computation** (`dashboard/page.tsx:216-222`):

```
monthlyRevenue  = Σ invoice.totalTtc        ← issued this month, not CANCELLED (accrual, invoice date)
lastMonthRevenue= Σ invoice.totalTtc        ← issued last month, not CANCELLED → delta %
receivables     = Σ invoice.totalDue        ← paymentStatus in UNPAID/PARTIAL/OVERDUE (cumulative)
monthlyExpenses = Σ supplierInvoice.totalTtc← issued this month, not CANCELLED
cashFlow        = monthlyRevenue − monthlyExpenses
```

**Why "Net cash flow" is wrong:** it ignores customer cash receipts, supplier cash outflows, payroll, and all non-supplier operating expenses. It is a monthly *accrual-basis trade balance* (billed sales minus billed purchases).

**Proposed label candidates (product owner must pick):**

1. **"Solde facturé du mois (ventes − achats)"** — accurate, period-scoped, neutral. Recommended.
2. **"Résultat commercial du mois"** — business-semantic, period-scoped.
3. **"Marge brute du mois (approximation)"** — only acceptable if COGS-by-invoice is deemed an acceptable proxy (note the approximation in a tooltip).
4. Keep "Net cash flow" **only if** the metric is re-built on real payment movements (`registerPayment` / payment allocations exist in `finance/service.ts`) — a larger feature, would move R08 to a new feature.

**Non-negotiable with any choice:** every Financial Pulse KPI must carry an explicit period label ("ce mois" vs "cumulé") and the card must show a tooltip explaining the composition (`dashboard/page.tsx` KPI grid). This also satisfies audit §5 "mixes periods" finding.

### PD-2 — `/ventes` and `/achats` treatment (BATCH 3, gates R13)

Audit §24 Issue 1 recommends making them **filtered views of the Documents hub** (`/documents?side=sales|purchasing`) rendered by the same hub component with a pre-applied type filter. Alternative = remove both from `nav-config` entirely (simplest, matches the palette's current behavior).

**Recommended:** implement filtered hub views (no duplicated logic, honest IA, keeps direct URLs meaningful). Product owner to confirm before BATCH 3.

### PD-3 — Canonical permission model (BATCH 0 step 0; **REQUIRED before R01/R02 are applied**)

First determine, then record in `docs/rbac/matrix.md` (MT1):

- The full COMPANY_ADMIN permission set (reference: the intersection of the *intended* operational modules minus any platform keys).
- Whether COMPANY_ADMIN keeps any `admin.company.*` key (current seed grants `admin.company.view/update/membership.manage`; `bootstrap-rh` additionally grants `admin.roles.manage`, `admin.users.manage`) — **explicitly decide the SUPER_ADMIN-platform / COMPANY_ADMIN-company boundary**.
- A single source of truth (one TypeScript const, e.g. `COMPANY_ADMIN_DEFAULT_PERMS`) consumed by `seed.ts`, `bootstrap-rh.ts`, `restore-super-admin.ts`, and onboarding, so provisioning can no longer drift.

> Phase 5 instruction honored: **no permission is renamed** here. §3 marks R02 as a one-line engine config change to the already-canonical `achats.besoin.*`; nothing else is re-keyed until PD-3 is approved.

---

## 6. Dependency Graph

```
PD-3 (canonical model) ──► BATCH 0 (R01, R02, QW8, QW9) ──► BATCH 1 (R03, QW1)
                                   │                            │
                                   ▼                            ▼
                           BATCH 2 (R04, R05, R06, R12, QW10) ◄──┘ (needs documents reachable)
                                   │
       ┌───────────────────────────┤
       ▼                           ▼
BATCH 3 (PD-2 → R13, QW5, QW4, QW7; R07 subset)     BATCH 4 (PD-1 → R08)
       │                                              (label choice gates code)
       ▼
BATCH 5 (R09/QW3, R14/QW2, R18, aria-live, contrast)
       ▼
BATCH 6 (R10, R11, QW6 — depends on MT2 shared DataTable scaffold, Phase 6 form review)
       ▼
BATCH 7 (DEFER: R07 full kernel/LT1, R15/MT8, R17/MT7, LT2–LT6)
```

Hard dependencies: **BATCH 0 → 1 → 2** (documents must be reachable before document UX work is meaningful). **BATCH 4** is gated on PD-1. **BATCH 3** startup (QW5/QW4/QW7) is independent and can proceed in parallel with BATCH 1–2.

---

## 7. Implementation Batches

### BATCH 0 — Critical correctness & access (P0)

**Step 0 (no code):** canonical permission model (PD-3) decided and documented (`docs/rbac/matrix.md`).

| Item | Action | Files |
|---|---|---|
| R01 / QW8 | Align COMPANY_ADMIN grants across **all** provisioning sources to the canonical set (`documents.*`, `ventes.*`, `achats.*`, `compta.*`, `rapports.view`, `rh.employee.*`, `rh.contract.*`, `rh.payroll.*`); converge `seed.ts` ↔ `bootstrap-rh.ts` ↔ `restore-super-admin.ts` to one const | `prisma/seed.ts`, `scripts/bootstrap-rh.ts`, `scripts/restore-super-admin.ts`, `scripts/ensure-demo-super-admin.ts`, `scripts/migrate-rbac-two-roles.ts` |
| R02 | Change `PURCHASE_REQUEST.permissionPrefix` → `achats.besoin` | `src/features/documents/engine/config.ts:156` |
| R02 (safe) | Reconcile script: assert zero `achats.demande` grant rows; report cross-source drift | `scripts/` (new, read-only/diagnostic) |
| QW9 | Permission explainer for hidden modules (muted row + tooltip "masqué par permission") when a nav group is filtered empty | `sidebar.tsx`, shell |
| — | Remove platform keys (`admin.roles.manage`, `admin.users.manage`, …) from COMPANY_ADMIN reference per PD-3 decision | provisioning scripts |

**Risk:** grant extension is additive; the security-cleanup direction is reductive. **Exit:** a fresh-seeded COMPANY_ADMIN sees Documents, Sales, Purchasing, Comptabilité, Rapports, HR employees; Purchase Requests are reachable; platform keys absent from company role.

### BATCH 1 — Document create UX (P1)

| Item | Action | Files |
|---|---|---|
| R03 / QW1 | Number preview chip "Prochain N° (indicatif)" in document create forms via server-driven preview (reuse `/api/series` or wire `previewNextNumber`); do **not** ship the duplicated client `preview()` | document create forms (9 types), `series.ts`/`series/route.ts` |

**Risk:** minimal — allocation path (`nextDocumentNumber`, CAS) untouched; preview stays informational. **Exit:** users see the next number before save; concurrency caveat documented in the chip label.

### BATCH 2 — Documents detail, print & party UX (P1/P2)

| Item | Action | Files |
|---|---|---|
| R04 | Optional `format=A4|A5|THERMAL` query param on `/api/documents/[id]/pdf` → `printDocument` → `PdfEngine.create`; UI picker at print action defaulting to company setting | `pdf/handle.ts`, `print/service.ts`, document detail print UI |
| R05 | Server-driven readOnly flag → disabled controls + "Lecture seule" notice on settings screens | `parametres/layout.tsx`, `CompanySettingsCenter`, settings components |
| R06 / QW10 | Workflow-aware CTAs: customer → "Créer une facture"; product → "Voir les mouvements"; document → "Convertir en…" + duplicate action | customer/product/document detail pages (layout confirmed in Phase 6) |
| R12 | Inline party quick-create dialog within document forms (pattern: branches manager) | document forms, business-partner components |

**Risk:** low — additive. **Exit:** one-click print with format choice; inert settings are clearly read-only; detail pages guide next steps; no leaving the form to create a party.

### BATCH 3 — Navigation & IA (P2/P3)

| Item | Action | Files |
|---|---|---|
| QW5 | Remove `/ventes`, `/achats` from `mainNav` **at source** (stop relying on palette render-filter) | `nav-config.ts:20,22` |
| PD-2 → R13 | Implement `/ventes`, `/achats` as filtered hub views (`?side=sales\|purchasing`) **or** remove from nav entirely (per decision) | `ventes/page.tsx`, `achats/page.tsx`, hub component |
| QW4 / R16 | Catch-all `[...module]` → proper 404 + suggested module links (keep ComingSoon for deliberate placeholder modules) | `[...module]/page.tsx` |
| QW7 | `truncate` on sidebar link labels (Arabic overflow protection) | `sidebar.tsx:101-103` |
| R07 (subset) | Reconcile palette consumption with the grouped model; full unified `ModuleDescriptor[]` kernel deferred to BATCH 7/LT1 | `command-palette.tsx`, `nav-config.ts` |

**Risk:** medium — nav model change affects muscle memory; keep URL redirects for moved routes. **Exit:** no redirect stubs in nav; sidebar and palette consistent; unknown routes 404.

### BATCH 4 — Dashboard (P2)

| Item | Action | Files |
|---|---|---|
| PD-1 → R08 | Apply the approved label for the metric; add explicit period labels to all Financial Pulse KPIs ("ce mois" vs "cumulé"); add composition tooltip | `dashboard/page.tsx` KPI grid, KPI card component, i18n (fr/ar/en — 3 dictionaries) |

**Exit:** honest metric labels; no period mixing; translations invariant preserved.

### BATCH 5 — Accessibility & polish (P2/P3, audit Phase D subset)

| Item | Action | Files |
|---|---|---|
| R09/QW3 | Chart summaries: `role="img"`, `aria-label`, textual data fallback | `revenue-chart.tsx`, `top-products-chart.tsx`, `kpi-card.tsx` |
| R14/QW2 | Visible severity text next to alert icons | `alerts-feed.tsx` |
| R18 | Password-strength meter + minimum requirements on `/compte` (validate page in Phase 6 first) | `/compte` change-password form |
| — | `aria-live` on async saves; color-contrast audit of shells | sonner/toast wiring, design tokens |

**Exit:** automated a11y checks pass on core screens; no color-only states.

### BATCH 6 — Forms & tables (P2)

| Item | Action | Files |
|---|---|---|
| MT2 | Shared `DataTable` (columns, sort, pagination, cards-on-mobile, density) harvested from documents hub + products + branches | `components/ui/` |
| R10 | Split product/CRM forms into guided tabs/steppers (Phase 4 patterns) | `products-manager.tsx:455-996`, `business-partners/*` |
| QW6 | `required` markers + inline fast-fail validation (branches pattern) | product/CRM forms |
| R11 | Branch-scoped filtering: persist branch selection, add "Toutes les succursales" filter on branch-aware lists | `branch-selector.tsx`, list pages |

**Exit:** consistent, guided forms; branch filter honest and server-persisted.

### BATCH 7 — Structural / long-term (deferred items)

| Item | Action | Files |
|---|---|---|
| R07 (full) / LT1 | Unified `ModuleDescriptor[]` nav kernel consumed by sidebar + palette + quick-create | shell |
| R17 / MT7 | Per-record activity panels (reuse `listActivity`) | documents/products/customers detail |
| R15 / MT8 | i18n split by feature namespace, keeping the strict trilingual invariant | `src/i18n/` |
| LT2–LT6 | Federated print pipeline, guided creation wizard, accessibility programme, performance hardening, analytics funnel | cross-cutting |

---

## 8. Regression Matrix

| Batch | Primary files touched | Regression surface | Tests |
|---|---|---|---|
| 0 | `seed.ts`, provisioning scripts, `engine/config.ts`, `sidebar.tsx` | fresh seed; existing DB reconcile; SUPER_ADMIN plane; doc hub reachability; purchase request visibility | Fresh DB seed → COMPANY_ADMIN sees all modules; purchase request card in hub; SUPER_ADMIN unaffected; zero `achats.demande` rows; no platform keys on company role |
| 1 | document create forms, `series.ts`, `/api/series` | allocation idempotency; number hint staleness; all 9 doc types | Parallel create (CAS still unique); preview chip appears on all types; settings numbering screen still works |
| 2 | `pdf/handle.ts`, `print/service.ts`, settings UI, detail pages, document forms | print output; settings read-only mode; CTAs; inline party create | PDF renders A4/A5/THERMAL (+`?format=`); view-only settings disabled; CTAs navigate; party created inline |
| 3 | `nav-config.ts`, `command-palette.tsx`, `sidebar.tsx`, `/ventes`,`/achats`,`[...module]` | nav render (fr/ar), palette, redirects, 404, mobile drawer | sidebar=palette module sets; `/ventes` no longer a redirect; unknown URL → 404; Arabic long-label no overflow |
| 4 | `dashboard/page.tsx`, kpi card, i18n | KPI truth; period labels; translations | metric label + tooltip correct; fr/ar/en keys all present (strict type); query counts unchanged |
| 5 | charts, alerts-feed, `/compte` | a11y; screen-reader reading order; text labels | axe/lint passes; severity text visible; contrast AA |
| 6 | DataTable, product/CRM forms, branch filter | form validation; branch-scoped lists; drift across tables | inline validation; fast-fail before submit; branch filter persisted; other tables unchanged |
| 7 | shell, i18n, activity panels | full app; translation invariant; nav | full regression suite; all i18n keys in 3 locales; nav consistent |

---

## 9. NOT VERIFIED Areas — Phase 6 Validation Plan

The audit marked these areas **NOT VERIFIED — runtime access unavailable** (all authenticated routes confirmed 307 at `localhost:3000`). None are disproven; all must be validated in Phase 6 with an authenticated COMPANY_ADMIN session.

| # | Area (audit ref) | Batch that interacts | Phase 6 check |
|---|---|---|---|
| 1 | Dashboard perf at scale (~30 `Promise.all`, §5) | 7 (LT5) | synthetic load on 10× data |
| 2 | Dashboard `PendingOperations` "approve" button runtime (§5) | — | click-through test |
| 3 | Password-strength / `/compte` (§7, R18) | 5 | screen + interaction |
| 4 | Arabic sidebar overflow visual (§6, QW7) | 3 | screenshot fr/ar |
| 5 | RTL Arabic layout (§14) | 3/5 | screenshot ar (mirroring, dialog direction) |
| 6 | Arabic table-cell overflow (§14) | 6 | screenshot ar |
| 7 | Mixed-direction data rendering (§14) | 4/6 | screenshot ar data |
| 8 | Print output on real printer A4/A5/THERMAL (§15, R04) | 2 | device test |
| 9 | THERMAL 80mm header/footer trimming (§15) | 2 | device test |
| 10 | Invoice hash / DGI fields in print output (§15, §10) | 2 | PDF inspection |
| 11 | PDF download workflow beyond `window.print()` (§15) | 2 | download test |
| 12 | RTL print layout (§15) | 2 | ar PDF |
| 13 | Runtime a11y (tab order, focus traps, contrast, `aria-live`, `lang`/`dir`) (§16) | 5 | WCAG automated + manual pass |
| 14 | Search result ranking/weighting (§11) | — | query tests on loaded data |
| 15 | `branchId` coverage on business models (§13, R11) | 6 | schema + query review |
| 16 | `CompanySetupJourney` dismiss + start state (§4.6) | — | interaction test |

### Phase 6 — authenticated visual validation (session checklist)

12 screens, in fr/ar/en, with a seeded COMPANY_ADMIN:

1. Dashboard (financial pulse, alerts, charts)
2. Documents hub + create forms (all 9 types) — includes BATCH 1 preview chip
3. Document detail + print preview (A4/A5/THERMAL) — BATCH 2 format picker
4. CRM: customer / supplier list + detail — BATCH 2 CTAs
5. Stock: products / warehouses / movements
6. Production: hub + orders (+ BOMs, work centers, machines)
7. Comptabilité + finance sub-pages (payments, reconciliation, tax declarations, fixed assets, report)
8. RH: hub + employees + contracts + payroll
9. Rapports
10. Paramètres: 8 tabs + branches — BATCH 2 read-only mode
11. Shell: sidebar (fr/ar), command palette, quick-create, mobile drawer, catch-all 404 — BATCH 3
12. `/compte` + `/aide` — BATCH 5 strength meter

Each screen: screenshot + interaction notes + a11y spot-check. Findings feed BATCH 2/3/5/6 items classified IMPLEMENT AFTER VALIDATION.

---

## 10. Execution Order

1. **PD-3** — canonical permission model (decision, no code) → unblocks BATCH 0.
2. **PD-1** — dashboard metric label (product owner) → unblocks BATCH 4 (can be decided in parallel with BATCH 0–3 work).
3. **PD-2** — `/ventes` `/achats` treatment → unblocks BATCH 3 R13.
4. **BATCH 0** → 1 → 2 strictly sequential (reachability → document UX).
5. **BATCH 3** (QW5/QW4/QW7) can run in parallel with BATCH 1–2.
6. **BATCH 4** after PD-1; **BATCH 5** anytime after 3; **BATCH 6** after DataTable scaffold + Phase 6 form review; **BATCH 7** last.
7. **Phase 6 visual validation** continuously alongside BATCH 2/3/5/6.

---

## 11. Deferred / Rejected Items

| Item | Status | Rationale / reopen criteria |
|---|---|---|
| R07 full unified nav kernel → LT1 | DEFER | Architectural; BATCH 3 runs the safe subset (QW5 + palette alignment). Reopen when nav drift recurs or quick-create needs sub-hubs |
| R15 i18n split → MT8 | DEFER | Maintainability; low user impact. Reopen on first merge conflict in `dictionaries.ts` |
| R17 activity panels → MT7 | DEFER | New-feature scope; depends on stable detail pages (BATCH 2) |
| R08 "real cash flow" rebuild (PD-1 option 4) | DEFER unless PD-1 chooses it | Requires modeling payment movements as a feature; only if product wants true cash-flow metric |
| Any wholesale RTL/visual rewrite | REJECTED | Preserve §23 strengths; Phase 6 validates, does not rewrite |
| Any permission re-key beyond R02 engine prefix | REJECTED in this phase | Await PD-3 canonical model; then a single coordinated change |

---

## 12. Protected — Do Not Touch

From audit §23, enforced across all batches:

| Element | Rule |
|---|---|
| Server-side-only authorization (`requirePermission`, `apiGuardWithContext`, `runScoped`) | Never weakened; UI filtering remains presentational |
| Strict company scoping (scoped `prisma`, `runScoped`, `prismaBase` admin-only) | Never widened |
| 9-type document engine + transition maps | Evolve via config only; never bypass |
| Double-entry accounting engine (`registerPayment`, `postJournalEntry`) | Never mocked/simplified |
| Phase 4 settings tabs + branches manager (reference UX) | Reuse, don't rewrite |
| SUPER_ADMIN platform plane (`isPlatform`, no `CompanyProvider`) | Keep separation |
| Strict trilingual i18n typing | Any new key must exist in fr/ar/en (kept even when splitting) |
| ComingSoon for intentional placeholder modules | Only the truly-unknown catch-all becomes 404 |

---

## 13. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Provisioning-source drift resurfaces after R01 if sources aren't converged to one const | High | High | BATCH 0 step 0 (PD-3) + reconcile script + `docs/rbac/matrix.md` |
| 2 | Platform keys leaking onto COMPANY_ADMIN (bootstrap-rh current behavior) | Medium | Critical | PD-3 explicitly splits SUPER_ADMIN vs company plane; remove platform keys |
| 3 | Number preview misleads under concurrency | Low | Medium | Informational chip label; CAS allocation untouched |
| 4 | THERMAL / A4 / A5 print regression after format param | Medium | Medium | BATCH 2 gated on Phase 6 device test; renderer untouched otherwise |
| 5 | i18n invariant broken by BATCH 4 label change | Low | Medium | Update all 3 dictionaries in same PR; type-check enforced |
| 6 | Nav model change (BATCH 3) confuses existing users | Medium | Low | Keep URL redirects; palette/sidebar consistency test |
| 7 | Authenticated screens remain unverifiable during batches | Medium | Medium | Phase 6 visual plan explicitly schedules every NOT VERIFIED area; BATCH 2/3/5/6 items are IAV and gated on it |

---

## 14. Success Criteria

- **P0/P1 out:** fresh-seeded COMPANY_ADMIN reaches Documents, Sales, Purchasing, Comptabilité, Rapports, and HR employees; Purchase Requests list in the hub (BATCH 0). Subsequent audit shows **0 P0 / 0 P1**.
- **Canonical model:** one COMPANY_ADMIN permission const exists and is the **only** source for seed + all provisioning scripts + onboarding; `docs/rbac/matrix.md` published.
- **Document UX:** number preview before save (indicative, concurrency-safe); one-click print with A4/A5/THERMAL picker defaulting to company setting; detail pages guide the next action.
- **Settings UX:** `parametres.view`-only users see a coherent read-only state.
- **Dashboard:** metric label approved (PD-1); all KPIs period-labeled; no color-only states; charts accessible.
- **Navigation:** sidebar and palette show the identical module set; no redirect stubs; unknown routes → 404.
- **Quality:** i18n strict invariant holds across every change; a11y checks pass on core screens; regression matrix (§8) green.
- **No private data:** no secrets or credentials introduced in any documentation.

---

## Appendix — Phase 5 Validation Evidence

| R | Status | File:line evidence gathered |
|---|---|---|
| R01 | VERIFIED | `prisma/seed.ts:249-274` (restricted `companyAdminPerms`); `scripts/bootstrap-rh.ts:14` (complete reference, incl. `admin.roles.manage` flag); `scripts/migrate-rbac-two-roles.ts` (OWNER-set at migration); `registration/service.ts`, `company-admin/service.ts` (COMPANY_ADMIN assignment paths) |
| R02 | VERIFIED | `engine/config.ts:156` (`achats.demande`); `permissions.ts:207,212` (`achats.besoin.*` only); `quick-create.tsx:47`; `bootstrap-rh.ts:14`; `documents/page.tsx:48-49` (hub filter) |
| R03 | VERIFIED | `series.ts:46-53` (zero-caller `previewNextNumber`); `series.ts:60-88` (CAS allocator); `api/series/route.ts:25-45` (server `next` preview); `series-manager.tsx:43-47` (client duplicate, ignores `next`) |
| R04 | VERIFIED | `print/service.ts:63,84`; `print/renderer.ts:85-89`; `api/documents/[id]/pdf/handle.ts:33-53` (no format param) |
| R05 | VERIFIED | `parametres/layout.tsx:9`; `apiGuardWithContext("parametres.manage")` at branches/company-profile/settings/series/lookups routes; `settings/route.ts:24` (secrets flag) |
| R06 | PARTIALLY VERIFIED | audit §9 detail-page survey; runtime CTA placement pending Phase 6 |
| R07 | PARTIALLY VERIFIED | `nav-config.ts:16-30` (`mainNav`) vs `48-90` (`companyNavGroups`); `command-palette.tsx:58-60` (palette **does** strip `/ventes` `/achats` — correction to audit text) |
| R08 | VERIFIED | `dashboard/page.tsx:216-222` (`cashFlow = monthlyRevenue − monthlyExpenses`, expenses = Σ supplier invoices only) |
| R09–R18 | VERIFIED / code-level | audit §16, §18, §19 + files cited in §8–§9 of this document |

> Runtime access: `localhost:3000` returns 200 (landing, `lang="fr"`); every authenticated route returns 307 to login. All authenticated-screen claims remain `NOT VERIFIED` by design; Phase 6 (§9) resolves them.