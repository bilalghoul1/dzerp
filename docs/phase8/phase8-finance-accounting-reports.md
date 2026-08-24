# Phase 8 — Finance, Comptabilité & Rapports (Autonomous Build)

**Status:** ✅ Complete — code, migration, seed, e2e API verification, quality gates green.
**Date:** 2026-08-12
**Scope:** Completes the Invoice lifecycle (flagged incomplete in the master prompt §12/§28),
adds a real double-entry Accounting foundation, and fills the previously-broken
`/comptabilite`, `/rapports`, `/production`, `/rh` nav links with real (non-fake) pages.

---

## 1. Root cause of the flagged Invoice-lifecycle gap

The `Invoice` / `SupplierInvoice` models already had `dueDate`, `paidAmount`,
`paymentStatus` (enum UNPAID/PARTIAL/PAID/OVERDUE) fields — but **nothing ever
wrote to them**. `paidAmount`/`paymentStatus` were display-only. There was no
`Payment` model, no `PaymentMethod` link usage, and no accounting layer. This made
the sales flow end at "facture émise" with no way to record settlement or reflect
it in the books.

## 2. What was built

### Schema (additive migration `20260812030000_phase80_payments_accounting`)
- `Payment` — encaissement/décaissement: number (atomic `DocumentSeries` `PAYMENT`),
  company/branch scoping, `direction` (RECEIVED/PAID), `partyKind`, `customerId`/
  `supplierId`, `methodId`, `reference`, `paidAt`, `amount`, `currency`,
  `exchangeRate`, `status`, `createdById`.
- `PaymentAllocation` — distributes a payment across invoices (`invoiceId` /
  `supplierInvoiceId`) + `amount`. This is the source of truth for recompute.
- `Account` — chart of accounts: `code`, `name`, `nameAr`, `type`
  (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE), `parentId`, `isSystem`, `isActive`.
- `JournalEntry` — `number` (`EC-YYYY-NNNNN`), `entryDate`, `reference`,
  `description`, `sourceDocType`, `sourceDocId`, `status`, `fiscalPeriodId`.
- `JournalLine` — `accountId`, `debit`, `credit`, `description`, `sourceDocType/-Id`;
  `@@index` on account + source document for traceability.
- `FiscalPeriod` — `label`, `startDate`, `endDate`, `status` (OPEN/CLOSED).
- Added `PAYMENT` to the `DocType` enum (reuses `DocumentSeries` numbering, per §31).
- Back-relation fields added to `Company`, `Branch`, `Customer`, `Supplier`,
  `PaymentMethod`, `User`, `Invoice`, `SupplierInvoice`, `Account`, `FiscalPeriod`.
- Migration verified **additive only** (enum APPEND VALUE, CREATE TABLE, CREATE INDEX,
  AddForeignKey; no DROP/rename/reorder) before `prisma migrate deploy`.

### Domain service `src/features/finance/service.ts`
- `registerPayment(input)` — wrapped in `prisma.$transaction`. Creates Payment +
  allocations, **recomputes each linked invoice's derived `paidAmount`/`paymentStatus`
  inside the same transaction** (fixed a real bug where the recompute used the global
  client and couldn't see uncommitted allocations → passed `tx`), then posts a balanced
  double-entry journal entry (Trésorerie 512/530 vs Tiers 411/401). Lazily seeds the
  chart of accounts + fiscal period if absent, so the accounting chain never silently
  no-ops.
- `recomputeInvoicePayment` / `recomputeSupplierInvoicePayment` — derive status
  (UNPAID/PARTIAL/PAID; OVERDUE preserved when unpaid & overdue).
- `postJournalEntry` — manual entry with **strict double-entry validation**
  (Σ débit === Σ crédit, each line single-sided, ≥2 lines).
- `seedChartOfAccounts(companyId)` — idempotent Algerian-style nomenclature
  (411 Clients, 401 Fournisseurs, 512 Banque, 530 Caisse, 701 Ventes, 601 Achats…).
- `ensureFiscalPeriod(companyId)` — opens current-year period if none open.

### RBAC (`src/features/auth/permissions.ts` + `prisma/seed.ts`)
- New permissions: `finance.payment.view`, `finance.payment.create`,
  `accounting.view`, `accounting.journal.create` (+ already-existing `compta.view`,
  `rapports.view`).
- **Bug found & fixed:** the new finance/accounting perms were missing from the
  `companyAdminPerms` / `managerPerms` / `readerPerms` role lists in `seed.ts`,
  so the demo MANAGER (`directeur.oran`) got 403 on `/api/finance/payments`. Added
  them (reader = view-only; others = create+view). Re-seeded.

### API routes (all company-scoped via `apiGuardWithContext` + `runScoped`)
- `POST/GET /api/finance/payments` — RBAC `finance.payment.{create,view}`.
- `GET/POST /api/finance/accounts` — list + seed COA / ensure fiscal period.
- `GET/POST /api/finance/journal` — list + post balanced entries (RBAC
  `accounting.journal.create`).

### UI (real pages — no fake buttons)
- `/comptabilite` — KPIs (facturé / encaissé / restant), live payment-registration
  form (client component → API), recent payments, chart of accounts, journal entries.
  Seeds COA + fiscal period on first load.
- `/rapports` — sales-by-status, top customers (balance), purchases total, treasury
  received, stock-value, low-stock tables — all real `prisma` aggregates.
- `/production` & `/rh` — honest module-landing pages (i18n FR/AR/EN, links to
  working features, **no fake buttons**). These modules have no domain models yet;
  building full MRP/HR is a separate large effort tracked as the next roadmap phase.

## 3. Verification

- **tsc --noEmit:** clean.
- **npm run lint:** 0 errors (15 pre-existing warnings).
- **npm run build:** ✓ Compiled successfully.
- **Migration:** `prisma migrate deploy` applied; verified additive-only SQL preview
  (no destructive statements) before applying. DB autonomy per master-prompt §19.
- **Regression scripts:**
  - `scripts/verify-phase76b-customer-order.ts` → **20/20** (no regression).
  - `scripts/verify-phase8-finance.ts` → **7/7** (COA seed, invoice PARTIAL→PAID
    recompute, balanced payment journal, rejected unbalanced entry).
- **Live e2e (dev server, demo MANAGER `directeur.oran`):**
  - `POST /api/finance/payments` → 201, number `ENC2026-00002`.
  - Auto-posted `EC-2026-00001` journal entry with balanced lines
    (Débit Banque 75000 / Crédit Client 411 75000).
  - `GET /api/finance/journal` → 200, entry present.
  - Pages `/comptabilite`, `/rapports`, `/production`, `/rh`,
    `/documents/customer_order`, `/documents/proforma` → **all 200**.

## 6. Suite du travail (même session)

### 6.1 Correction critique du seed (cause racine du 401)
Le `prisma/seed.ts` contenait un `deleteMany` destructif qui supprimait `User` puis
tentait de supprimer `Company` **sans vider les tables comptables** (Payment,
PaymentAllocation, JournalLine, JournalEntry, Account, FiscalPeriod). En présence
de données financières, les FK RESTRICT bloquaient `company.deleteMany` → le seed
**échouait APRÈS avoir supprimé les utilisateurs** → 401 permanent au login.
Corrigé en vidant PaymentAllocation/Payment (avant Branch) puis
JournalLine/JournalEntry/Account/FiscalPeriod (avant Company), dans le bon ordre
des dépendances. Le seed est désormais idempotent et termine toujours.

### 6.2 Complétion de l'UI comptable (Phase 8.2)
- `src/components/finance/payment-form.tsx` : désormais bidirectionnel
  (Encaissement client **et** Décaissement fournisseur) avec sélecteur de
  contrepartie et facture liée (client/fournisseur).
- `src/components/finance/journal-entry-form.tsx` (nouveau) : saisie manuelle
  d'écriture multi-lignes avec validation d'équilibre côté client.
- `src/app/(app)/comptabilite/page.tsx` : passe fournisseurs + factures
  fournisseur à `PaymentForm`, ajoute la carte « Saisie manuelle d'écriture »,
  et affiche fournisseur + client dans les mouvements récents.
- **Bug RBAC trouvé et corrigé** : `accounting.journal.create` manquait dans
  `managerPerms` (seed) → le MANAGER démo avait 403 sur la saisie manuelle.
  Ajouté à `managerPerms`. Re-seed effectué.

### 6.3 Vérifications (Phase 8.2)
- `prisma validate` ✅ · `prisma generate` ✅ · `migrate status` ✅
- `tsc --noEmit` ✅ · `eslint` 0 erreur ✅ · `next build` ✅
- E2E API (manager démo) :
  - POST décaissement fournisseur → 201 (écriture Dr 401 / Cr 512 postée)
  - POST saisie manuelle équilibrée → 201
  - POST saisie déséquilibrée → refusée (validation double implication)
- Régressions : Phase 7.6B 20/20 · Phase 8 7/7 · Phase 8.1 7/7

## 7. Prochaines phases autonomes (non démarrées)
- **Module Production (MRP)** : aucun modèle de domaine (pas de `WorkOrder`,
  `BOM`, `Machine`…). Construction complète requise — phase autonome dédiée.
- **Module RH** : aucun modèle (`Employee`, `Payroll`, `Leave`…). Phase dédiée.
- Les pages `/production` et `/rh` sont des pages d'atterrissage honnêtes
  (liens vers fonctionnalités existantes, **aucun bouton factice**).


- `production` and `rh` are scaffolding pages (no domain models yet) — their full
  MRP/HR builds remain as the next autonomous phases.
- Manual journal entries require `accounting.journal.create`; revenue recognition on
  invoice finalization (Dr Client / Cr Sales 701) is **not yet auto-posted** — only
  payments post. Auto-posting invoice → journal is the natural next accounting step.
- No git commit performed (per standing safety boundary: commit/push only on explicit
  user approval).

## 5. Files touched (this phase)
- `prisma/schema.prisma` (models + enum + back-relations)
- `prisma/seed.ts` (finance/accounting perms in role lists; PAYMENT series)
- `src/features/finance/service.ts` (new)
- `src/app/api/finance/payments/route.ts` (new)
- `src/app/api/finance/accounts/route.ts` (new)
- `src/app/api/finance/journal/route.ts` (new)
- `src/components/finance/payment-form.tsx` (new)
- `src/app/(app)/comptabilite/page.tsx` (new)
- `src/app/(app)/rapports/page.tsx` (new)
- `src/app/(app)/production/page.tsx` (new)
- `src/app/(app)/rh/page.tsx` (new)
- `src/features/auth/permissions.ts` (new perms)
- `scripts/verify-phase8-finance.ts` (new)
