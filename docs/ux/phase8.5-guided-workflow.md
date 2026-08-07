# Phase 8.5 — Guided Commercial Workflow

**Project:** DzERP
**Date:** 2026-08-06
**Scope:** UX-only. Transform DzERP into a *guided* commercial workflow (answering
"Where am I? / What have I just done? / What is next?"). No business-engine,
workflow-engine, conversion-engine, permission, schema, or API changes.

---

## 0. Method — audit-first, reuse-only (FIRST RULE honored)

Before any edit, every relevant component was re-read. The headline finding:
**most of Phase 8.5 was already built in prior phases.** The work was to (a) *find*
the pre-existing pieces, (b) *wire* the ones that were never rendered, and
(c) *fill the three genuine gaps* by composing existing primitives and existing
APIs — never duplicating logic.

| Requirement | Status before this phase | Action taken |
|---|---|---|
| 1. Success panel after create | `DocumentCreatedBanner` already existed & was wired (`?created=1`) | Reused as-is; added `withHint` to its status |
| 2. Redirect after save to list | Create → detail+banner (not empty editor); save → stays on detail | Already correct; no change needed |
| 3. List exposes next actions per status | `document-list.tsx` already shows status + next-step + row actions | Reused; upgraded status cell to component `withHint` |
| 4. Status explanation + next step | `DocumentStatusBadge` had a `withHint` prop — **never rendered anywhere** | **Wired it** in list + banner |
| 5. Customer Commercial Center | APIs (`getCustomer`, `getCustomerDocuments`) + `crm*` i18n existed — **no page** | **Built** `crm/customers/[id]` reusing the APIs |
| 6. Empty states | `EmptyState` already used on lists | Reused inside the new center |
| 7. Navigation "where did it go?" | `DocumentConvertDialog.onConverted` passed an **empty id** and never navigated | **Wired navigation** to the target list |
| 8. Discoverability of Print/Preview/Convert | `DocumentWorkflowBar` + list already expose these | Already present; no change needed |

**Result:** only 3 gaps addressed (Req 4, 5, 7). Zero new business logic, zero
schema/API changes, zero duplicated components.

---

## 1. Changes applied

### Req 4 — Status comprehension (`withHint` was dead code)
- `src/components/documents/document-list.tsx`
  - Status cell now renders `<DocumentStatusBadge status withHint />` (replacing a
    hand-rolled next-step `<span>`). The component's `withHint` shows the
    `STATUS_EXPLANATION` help + next step.
  - Removed now-unused `STATUS_EXPLANATION` import.
- `src/components/documents/document-created-banner.tsx`
  - Success-panel status cell upgraded to `<DocumentStatusBadge withHint />`.

### Req 7 — Convert navigation ("the document never disappears")
`DocumentConvertDialog` already calls `onConverted?.(target, "")` but callers
ignored `target`. Three callers now route to the **target-type list**:
- `document-workflow-bar.tsx`: `handleConverted(target)` → `router.push('/documents/'+target.toLowerCase())` + success toast.
- `document-list.tsx`: added `useRouter`; convert dialog `onConverted` → `router.push` to target list.
- `document-created-banner.tsx`: `handleConverted(target?)` → `router.push` to target list.

### Req 5 — Customer Commercial Center (the only new page)
- **New:** `src/app/(app)/crm/customers/[id]/page.tsx` (server component)
  - Reuses existing `getCustomer(id)` + `getCustomerDocuments(id)` (no new query).
  - Server-rendered; composes existing `PageHeader`, `Card`, `Badge`,
    `DocumentStatusBadge`, `EmptyState`.
  - Answers the three guided questions:
    - **Where am I?** Breadcrumbs `CRM → Clients → {name}`.
    - **What is the state?** KPI strip: Solde dû (from `customer.balance`),
      Chiffre d'affaires (computed from invoices), and per-type counts
      (Devis / Commande / Bon de livraison / Facture / Avoir).
    - **What next?** Quick actions (Nouveau devis / Nouvelle facture / Nouvelle
      livraison) deep-link to the relevant editor; "Voir tout" links to each list.
  - Conversion chain: documents grouped in workflow order (Quotation → Order →
    Delivery → Invoice), each linking to its detail.
  - Recent activity: latest 8 documents across types, linking to detail.
  - Empty state when the customer has no documents (`crmNoDocuments`).
  - Uses the **pre-existing** `crm*` i18n keys (fr/ar/en) — no new strings invented.
- `src/components/business-partners/business-partners-manager.tsx`
  - Customer name is now a link to `/crm/customers/{id}` (suppliers unchanged).
  - Reuses the existing `kind` prop (only `kind === "customer"` links).

### Dictionary cleanup (pre-existing defect, not a feature)
- `src/i18n/dictionaries.ts` contained a **duplicate `createdBy` key** in all three
  languages (a leftover from an earlier phase). This caused `tsc` TS1117 and would
  have failed the build. Removed the 3 duplicate lines. No keys added/changed.

---

## 2. What was explicitly NOT changed (per Req 9 / constraints)
- Document Engine, Workflow Engine, Conversion Engine — untouched.
- Permissions / RBAC — untouched (`requirePermission("crm.customer.view")` only).
- Database schema (Prisma) — untouched.
- HTTP APIs (`/api/documents/*`, `/api/customers`) — untouched; the new page calls
  the **existing** internal `getCustomer` / `getCustomerDocuments` functions.
- No new UI primitives created — only composed existing ones.

---

## 3. Quality gates
Run from a clean state (`rm -rf .next`):

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errors |
| Lint | `npx eslint <changed files>` | ✅ 0 errors, 0 warnings |
| Build | `npm run build` | ✅ exit 0 (all routes) |

---

## 4. Runtime verification (browser, dev server :3021)
1. **Customer Commercial Center** — opened `/crm/customers/{cuid}`:
   - Breadcrumbs `CRM → Clients → Algérie Télécom`.
   - KPIs: Solde dû 980 000,00 DZD, counts (Devis 1, Commande 1, …).
   - Conversion chain: DEV2026-0002 (Approuvé), BC2026-0001 (Brouillon).
   - Recent activity lists both docs. "Voir tout" renders correctly (was a raw
     key `documentsUI.viewAll` → fixed to `dashboard.viewAll`).
   - Screenshot: `docs/ux/customer-commercial-center.png`
2. **Status `withHint`** — document list status cells show e.g.
   *"Approuvé, prêt à exécuter. → Préparez la livraison ou facturez."* and
   *"Brouillon, Modifiable — en cours de saisie. → Enregistrez ou convertissez
   le document."*
3. **Convert navigation (Req 7)** — converted a quotation to an order:
   - `POST /api/documents/convert → 201`, then `GET /documents/sales_order → 200`.
   - New order **BC2026-0002** appears in the sales-order list; user lands there.
   - Screenshot: `docs/ux/convert-navigation.png`

---

## 5. Files touched
- `src/app/(app)/crm/customers/[id]/page.tsx` — **new** (Customer Commercial Center)
- `src/components/documents/document-list.tsx` — `withHint` + convert navigation
- `src/components/documents/document-created-banner.tsx` — `withHint` + convert navigation
- `src/components/documents/document-workflow-bar.tsx` — convert navigation (added `sonner` import)
- `src/components/business-partners/business-partners-manager.tsx` — customer name link
- `src/i18n/dictionaries.ts` — removed pre-existing duplicate `createdBy` key (3 langs)

---

## 6. Decision needed before commit
Per project convention, **no commit was made**. Review the screenshots and the
above; approve and I will commit.
