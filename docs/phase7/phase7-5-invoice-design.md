# Phase 7.5A — Invoice Design Gate

**Status:** READ-ONLY ARCHITECTURAL AUDIT — NO IMPLEMENTATION
**Date:** 2026-08-12
**Mode:** AUDIT → VERIFY → DESIGN → REPORT (no code, no migration, no data change, no commit)
**Author:** Hermes (DzERP audit pass)

---

## 1. Executive Summary

This gate audits the **Invoice** lifecycle in DzERP against the existing, protected
Document Engine and the operational Quotation → Sales Order → Delivery Note chain.

The audit **confirms** that the Invoice model and the generic Document Engine exist and
are wired into the UI, PDF and numbering. However, it **confirms multiple structural
gaps** in the invoice-specific behavior:

- **F1 CONFIRMED** — No invoice-specific business logic exists. Invoice is handled 100%
  by the generic engine (`createDocument` / `convertGeneric`). No service validates
  `dueDate`, `paidAmount`, `paymentStatus`, or `invoiceId`.
- **F2 CONFIRMED** — `paidAmount` and `paymentStatus` are **read** (PDF, dashboard) but
  **never written** by any server path. Production: 3 invoices, all `UNPAID`,
  all `paidAmount = 0`.
- **F3 CONFIRMED** — `dueDate` is persisted as nullable and **never set** by the engine
  on create, update, or conversion. Production: 3/3 invoices have `dueDate = NULL`.
- **F4 CONFIRMED (code path)** — `CreditNote.invoiceId` is nullable and the generic
  conversion (`convertGeneric`) does **not** populate `invoiceId` when INVOICE →
  CREDIT_NOTE. No production credit notes exist yet (0), so this is a code-path defect,
  not yet a data defect.
- **F5 CONFIRMED** — Two parallel, inconsistent permission systems:
  - Engine API guards use generic `documents.*` (`documents.create`, `documents.read`,
    `documents.update`, `documents.delete`, `documents.approve`, `documents.convert`,
    `documents.print`).
  - UI quick-actions / customer page use domain keys `ventes.facture.create`,
    `ventes.avoir.create`, `achats.facture.create`.
  - The engine `DocumentTypeConfig.permissionPrefix` field is **dead config** — never
    wired into any guard. So the server is authoritative but the two planes are not
    unified, and `ventes.facture.manage` is defined but unused.
- **F6 NOT CONFIRMED / NOT A BLOCKER** — Invoice uses the generic `SALES_TRANSITIONS`
  set. This is semantically imperfect for an invoice (invoices do not "process" like
  delivery notes) but it is **not a data-integrity risk** and the existing enums do not
  need to change for a safe first implementation. Reported as a design recommendation,
  not a STOP condition.
- **F7 CONFIRMED (code path)** — `Customer.balance` is **never maintained** by any
  transactional server code (no `update({ balance })` anywhere in `src`). It is only
  read (dashboard, customer page) and seeded. Production `customerBalanceSum = 29,090,000`
  (demo seed values only).
- **F8 PARTIAL** — `issuedAt` is set via DB default `now()`. `validUntil` does **not
  exist** on the Invoice model (only on Quotation). There is no invoice "valid until"
  / "échéance" propagation. `dueDate` (the real invoice due date) is the missing field
  (see F3).
- **F9 NUANCE / NOT A BLOCKER** — The canonical Invoice number in production comes from
  `DocumentSeries.prefix = "FA"` (DB truth, confirmed: 2 INVOICE series both `FA`).
  The engine `numberPrefix = "FAC"` is **dead config** (only used for the PDF filename,
  which is cosmetic). There is **no mismatch in production data**; the "FAC vs FA"
  discrepancy is cosmetic only. Recommended cleanup: align `numberPrefix` to `FA` for
  consistency, but this is not a numbering-rule change.
- **F10 NOT A BLOCKER** — Invoice discovery/navigation works through the generic
  `/documents/invoice(/nouveau|/id)` routes and the quick-create menu. No dedicated
  invoice feature folder exists, but the generic engine covers list/detail/create/edit/
  print. Invoice-specific columns (due date, payment status, paid/remaining, source doc,
  credit notes) are **absent from UI** (see §13) — a completeness gap, not a navigation
  failure.

**No STOP condition from §18 is triggered by the schema as it stands** for a *design*
phase. However, the design below shows that a **correct Payment model is required** to
implement payments (§7). That model is **out of scope for this gate** and must be
introduced in a dedicated, separate phase with its own migration audit (§17, §18).

---

## 2. Current Architecture

### 2.1 Document Engine (protected — DO NOT REDESIGN)
- `src/features/documents/engine/{config,service,conversion,workflow,validation,calculation,status,resolve,types}.ts`
- `src/features/documents/framework/{api,normalize,ui-config,status-meta,ui-types}.ts`
- `src/features/documents/series.ts` — atomic numbering via `DocumentSeries.nextValue`
  (compare-and-swap).
- Conversion: `convertDocument` → `convertToDeliveryNote` (specialized, partial/multiple)
  or `convertGeneric` (everything else, full copy, idempotent by one relation per
  source→target pair).
- Status: `transitionStatus` / `approveDocument` through `assertTransition` in
  `status.ts`. Direct Prisma status writes are forbidden.
- Totals: `calculation.ts` computes `totalHt/totalTva/totalTtc` from lines; client totals
  ignored.

### 2.2 Invoice currently lives ONLY inside the generic engine
- Schema models: `Invoice`, `InvoiceLine`, `CreditNote`, `CreditNoteLine`.
- No `src/features/invoice/` service. No `src/features/credit-note/` service.
- API: only the generic `src/app/api/documents/**` routes + `convert`.
- UI: generic `src/app/(app)/documents/[type]/(page|nouveau|[id])/page.tsx` +
  `src/components/documents/pages/*`.

### 2.3 Source-link architecture
- Invoice has **no** `salesOrderId` / `deliveryNoteId` / `quotationId` foreign key column.
- Source documents are linked **only** via the generic `DocumentRelation`
  (`relationType: CONVERSION`, `sourceDocType`/`sourceDocId` → `targetDocType`/`targetDocId`).
- `ALLOWED_CONVERSIONS` (engine `config.ts`):
  - `QUOTATION → [SALES_ORDER, INVOICE]`
  - `SALES_ORDER → [DELIVERY_NOTE, INVOICE]`
  - `DELIVERY_NOTE → [INVOICE]`
  - `INVOICE → [CREDIT_NOTE]`
  - `CREDIT_NOTE → []`

### 2.4 Verified production snapshot (read-only query, `prismaBase`)
```
invoiceCount: 3
creditNoteCount: 0
paymentStatusDist: [{ paymentStatus: "UNPAID", _count: 3 }]
dueDateNull: 3   (dueDatePopulated: 0)
paidAmountSum: "0"   paidNonZero: 0
cnWithInvoice: 0
invoiceSeries: [
  { key: "INVOICE", prefix: "FA", withYear: true, year: null, nextValue: "1", isActive: true, companyId: 7f62… },
  { key: "INVOICE", prefix: "FA", withYear: true, year: null, nextValue: "6", isActive: true, companyId: c976… }
]
invoiceRelations: [{ sourceDocType: "QUOTATION", targetDocType: "INVOICE", _count: 3 }]
customerBalanceSum: "29090000"  (demo seed only; never maintained by code)
```
Interpretation: In production, all 3 invoices were created by **QUOTATION → INVOICE**
conversion. **No invoice was ever produced from a Delivery Note** in the current data.
This confirms the engine permits converting straight from Quotation, bypassing the
Delivery Note — a behavior the design below must constrain (§5).

---

## 3. Verified Findings

| ID | Claim | Verdict | Evidence |
|----|-------|---------|----------|
| F1 | Invoice-specific business logic missing | **CONFIRMED** | No `src/features/invoice`; `createDocument`/`convertGeneric` are type-generic and never touch `dueDate`/`paidAmount`/`paymentStatus`/`invoiceId`. |
| F2 | `paidAmount`/`paymentStatus` read but never written | **CONFIRMED** | grep: only reads in `print/*`, `app/page.tsx`. No `update({paidAmount})` / `paymentStatus` write anywhere. DB: all UNPAID, 0 paid. |
| F3 | `dueDate` not persisted | **CONFIRMED** | Schema nullable; engine never sets it. DB: 3/3 NULL. |
| F4 | `CreditNote.invoiceId` not populated on conversion | **CONFIRMED (code)** | `convertGeneric` creates target via generic delegate, never sets `invoiceId`. No production CN yet (0). |
| F5 | `documents.*` vs `ventes.facture.*` inconsistent | **CONFIRMED** | API uses `documents.*`; UI uses `ventes.facture.create`/`ventes.avoir.create`; `permissionPrefix` is dead config. |
| F6 | Invoice uses delivery-oriented statuses | **NOT A BLOCKER** | Uses generic `SALES_TRANSITIONS`. Imperfect semantically, no data risk, no enum change needed now. |
| F7 | `Customer.balance` not maintained | **CONFIRMED (code)** | No transactional `balance` write in `src`. Only read + seed. |
| F8 | `issuedAt`/`validUntil` not propagated correctly | **PARTIAL** | `issuedAt` OK (DB default). `validUntil` absent on Invoice. `dueDate` (real field) missing — see F3. |
| F9 | Invoice numbering prefix mismatch | **NUANCE — NOT A BLOCKER** | DB `DocumentSeries.prefix = "FA"` is the real source. Engine `numberPrefix="FAC"` only affects PDF filename. Cosmetic only. |
| F10 | Invoice discovery/navigation incomplete | **NOT A BLOCKER** | Generic routes work; invoice-specific UI columns missing (completeness, not navigation). |

Finds **rejected as blockers**: F6, F9 (cosmetic), F10 (navigation works). All remaining
are confirmed defects in *behavior*, not in the protected architecture.

---

## 4. Invoice Lifecycle (DESIGN)

The invoice is the **billing obligation** at the end of the sales chain. It is a
commercial document; it is NOT an accounting entry and MUST NOT create one (§16).

### 4.1 Permitted source documents
| Source | Allowed? | Conditions |
|--------|----------|-----------|
| Quotation | ⚠️ DISCOURAGED | Only if no Sales Order exists. Direct quote→invoice should be restricted to cash/immediate-sale scenarios. |
| Sales Order | ✅ Primary | Standard path. |
| Delivery Note | ✅ Preferred | The **canonical** billing source — invoice the delivered goods. |
| Multiple Delivery Notes | ✅ | One order may ship in parts; each Delivery Note may become its own invoice. |
| Credit Note | ❌ | Terminal; cannot be invoiced. |

### 4.2 Invariant (the correct rule)
> **An Invoice line quantity for a given source delivery line MUST NOT exceed the
> remaining invoicable quantity of that delivery line, and the sum of all invoices
> derived from a Delivery Note MUST NOT exceed the delivered quantity.**

This mirrors the Delivery-Note over-delivery guard (`remainingQty` on `SalesOrderLine`).
**Current schema gap:** there is **no `remainingInvoicableQty`** equivalent on
`DeliveryNoteLine`. The design requires either:
- (a) a new `DeliveryNoteLine.invoicedQty Decimal @default(0)` column (ADDITIVE-safe), or
- (b) derive remaining invoicable = `quantity - sum(InvoiceLine.qty where sourceLineId)`
  via the `DocumentRelation` + a new `sourceLineId` on `InvoiceLine`.

Option (b) is preferred to avoid a new column, but requires adding `sourceLineId` /
`sourceDocLineRef` to `InvoiceLine` (ADDITIVE) so remaining quantity can be computed
atomically (compare-and-set, like `remainingQty`).

### 4.3 Conversion matrix
| Source → Invoice | Full | Partial | Multiple | Duplicate guard | Over-invoice guard |
|------------------|------|---------|----------|-----------------|--------------------|
| Quotation → Invoice | copy all lines | per-line qty ≤ quote line | multiple quotes → multiple invoices (allowed) | `ALREADY_CONVERTED` relation guard exists | new `invoicedQty` guard required |
| Sales Order → Invoice | copy all lines | per-line qty ≤ order line remaining | order→many invoices allowed | relation guard | remaining guard required |
| Delivery Note → Invoice | copy delivered lines | per-line qty ≤ delivered | DN→many invoices allowed | relation guard | **invoicedQty guard REQUIRED** |

### 4.4 Idempotency / concurrency
- `convertGeneric` already blocks a second conversion of the same source→target pair
  (`ALREADY_CONVERTED`, 409). This must be retained.
- Partial/multiple invoices from a Delivery Note require an **atomic remaining-quantity
  check** (compare-and-set on `invoicedQty` or derived sum) to prevent concurrent
  over-invoicing — same pattern as `SalesOrderLine.remainingQty`.

---

## 5. Source → Invoice Conversion Matrix (detailed)

| Dimension | Quotation | Sales Order | Delivery Note |
|-----------|-----------|-------------|---------------|
| Can generate invoice? | Yes (restricted) | Yes | Yes (canonical) |
| Mandatory intermediate? | No (discouraged) | Recommended | Preferred |
| Full conversion | ✅ | ✅ | ✅ |
| Partial conversion | ✅ per line | ✅ per line | ✅ per delivered line |
| Multiple invoices | ✅ (multiple quotes) | ✅ (many from one order) | ✅ (many from one DN) |
| Duplicate conversion | ❌ blocked (relation guard) | ❌ blocked | ❌ blocked |
| Remaining quantity tracked? | No (quote not a fulfillment doc) | Yes (`SalesOrderLine.remainingQty`) | **NO — needs `invoicedQty`/derived** |
| Over-invoicing risk | Medium | Low (remaining guard exists) | **High until invoicedQty added** |
| Concurrency | Low | Handled (CAS) | **Needs CAS on invoicedQty** |
| DocumentRelation | `CONVERSION` | `CONVERSION` | `CONVERSION` |

**Design decision:** Make **Delivery Note the recommended billing source** and add the
remaining-invoicable guard. Keep Quotation→Invoice allowed but flag it as
"immediate/cash sale" only.

---

## 6. Invoice Status Model

### 6.1 Document Status (lifecycle) — KEEP generic
Use existing `DocumentStatus` transitions. Recommended mapping for invoices:
`DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED → (PARTIALLY_PROCESSED?) → PROCESSED → CLOSED`.
- `CONFIRMED` = invoice issued/sent to customer.
- `CLOSED` = fully paid OR fully credited (terminal).
- `CANCELLED` = terminal reversal (only from non-terminal; prefer Credit Note for posted
  invoices).

**No enum change required.** Do NOT invent `ISSUED`/`PAID` statuses — payment is a
separate axis (§7).

### 6.2 Payment Status — SEPARATE AXIS (existing enum, currently unused in writes)
`PaymentStatus { UNPAID, PARTIAL, PAID, OVERDUE }` already exists on `Invoice` and
`SupplierInvoice`. This is the **second, independent axis**. It MUST be derived
server-side from payments (§7), never client-set.

### 6.3 Accounting Status — NOT IN THIS PHASE
No accounting tables exist. Invoice prepares data (totals, customer, dates) but creates
no journal entry. Accounting is a future, separate domain (accounting-expert).

### 6.4 Three axes, clearly separated
1. **DOCUMENT STATUS** — workflow lifecycle (engine `DocumentStatus`).
2. **PAYMENT STATUS** — settlement state (`PaymentStatus`, derived).
3. **ACCOUNTING STATUS** — future GL posting (out of scope).

---

## 7. Payment Architecture (DESIGN ONLY — NO IMPLEMENTATION)

### 7.1 What the schema supports TODAY
- `Invoice.paidAmount Decimal @default(0)`, `Invoice.paymentStatus PaymentStatus @default(UNPAID)`.
- `PaymentStatus` enum (UNPAID/PARTIAL/PAID/OVERDUE).
- `PaymentMethod` model exists (lookup table) but is **not referenced** by any document.
- `Customer.balance Decimal` (never maintained).

### 7.2 What is MISSING (requires a NEW model)
To support the full payment lifecycle, a **`Payment` model is REQUIRED**:
- `id`, `companyId`, `branchId?`, `customerId`, `invoiceId` (FK, nullable for advances),
  `paymentMethodId` → `PaymentMethod`, `amount Decimal`, `currency`, `exchangeRate`,
  `paidAt DateTime`, `reference String?` (cheque no. / transfer ref / CCP-CIB ref),
  `status` (e.g. `PENDING`/`CONFIRMED`/`CANCELLED`/`REVERSED`), `createdById`,
  timestamps, `meta Json?`.
- A **`PaymentAllocation`** model is RECOMMENDED (not mandatory for v1) to support:
  partial allocation, overpayment, customer advances (unallocated), and reversals.

### 7.3 Lifecycle coverage (design target)
| Requirement | Supported by schema today? | Needs |
|-------------|----------------------------|-------|
| Unpaid invoice | ✅ | — |
| Partial payment | ⚠️ fields exist, no logic | `Payment` + recompute `paidAmount`/`paymentStatus` |
| Fully paid | ⚠️ | `Payment` + `PAID` derivation |
| Multiple payments | ❌ | `Payment` (many per invoice) |
| Overpayment | ❌ | `Payment` + `Customer.balance` (credit) or `PaymentAllocation` |
| Payment cancellation | ❌ | `Payment.status` + reversal ledger |
| Payment reversal | ❌ | reversal `Payment` row (negative) |
| Payment allocation | ❌ | `PaymentAllocation` |
| Payment methods (cash/bank/cheque/CCP-CIB) | ⚠️ `PaymentMethod` exists, not wired | reference `Payment.paymentMethodId` |
| Customer advances (unallocated) | ❌ | `Payment.invoiceId` nullable + `PaymentAllocation` |
| Overdue detection | ❌ | batch job / computed from `dueDate` vs `paidAmount` |

### 7.4 STOP CONDITION (per §18)
> **A `Payment` (and optionally `PaymentAllocation`) Prisma model is required to
> implement payments.** This gate is READ-ONLY and MUST NOT create migrations.
> **Report as required design; implement in a dedicated Phase 7.5B (Payments) with its
> own migration audit.** Do not bolt payments onto the Invoice row client-side.

### 7.5 `paymentStatus` derivation rule (server-only)
```
remaining = totalTtc - paidAmount
if paidAmount == 0            → UNPAID
else if remaining > 0         → PARTIAL
else if remaining == 0        → PAID
OVERDUE = (paymentStatus != PAID) AND dueDate < now()   // computed, not stored-authoritative
```
`paidAmount` is the **sum of confirmed Payments** allocated to the invoice
(Decimal, atomic increment inside the payment transaction). Client never sends
`paidAmount`/`paymentStatus`.

---

## 8. Credit Note Design (DESIGN ONLY)

### 8.1 Invoice → Credit Note
- `ALLOWED_CONVERSIONS.INVOICE = [CREDIT_NOTE]` — already configured.
- **FIX (F4):** `convertGeneric` MUST set `CreditNote.invoiceId = source.id` when
  `targetDocType === CREDIT_NOTE`. This is a one-line engine fix (not a schema change).
- Relation: `DocumentRelationType.CREDIT` (already exists in enum) should be used
  instead of/in addition to `CONVERSION` for invoice→credit linkage, for clearer
  semantics.

### 8.2 Limits
- **Maximum creditable amount** per invoice = `totalTtc − sum(creditedTtc of non-cancelled
  credit notes linked to that invoice)`.
- **Maximum creditable quantity** per source line = delivered qty − sum(credited qty).
- Multiple credit notes allowed until the capped amount is exhausted.
- Remaining creditable amount MUST be computed atomically and rejected if exceeded
  (422 `OVER_CREDIT`).

### 8.3 Implications
- **Payment:** a credit note reduces the customer's receivable. If the invoice was
  partially/fully paid, the credit becomes a **customer credit balance** (refund or
  offset) — handled via `Customer.balance` + (future) `PaymentAllocation`.
- **Customer balance:** credit note decreases receivable; net effect flows to
  `Customer.balance` (§9).
- **Status:** credit note follows generic transitions; when it fully offsets an invoice,
  the invoice's `paymentStatus`/`DocumentStatus` may move to `CLOSED` (server-derived).
- **Accounting:** out of scope (§16). Credit note prepares reversal data only.

---

## 9. Customer Balance Design

### 9.1 Current state
`Customer.balance Decimal @default(0)` exists; **never maintained transactionally**
(confirmed: zero writes in `src`). Currently only seeded demo values.

### 9.2 Recommended model
**C. Derived from invoices/payments, maintained transactionally (cached/denormalized).**
- `balance` is a **denormalized cache** kept consistent inside the same DB transaction
  that records the commercial event:
  - Invoice `CONFIRMED` → `balance += totalTtc` (customer receivable up).
  - Payment confirmed → `balance -= allocatedAmount` (receivable down).
  - Credit note confirmed → `balance -= creditedTtc` (receivable down).
  - Cancellation/reversal → inverse adjustment in the same transaction.
- **Source of truth = signed sum of `(Invoice.totalTtc − paidAmount)` + unallocated
  credits/advances**; `balance` is the cached materialization, recomputable via a
  reconciliation script.
- **Never** let the client set `balance`. Never trust a stored `balance` without
  periodic reconciliation (a read-only verification script is recommended for Phase 7.5B).

### 9.3 Risk if ignored
Leaving `balance` unmaintained means the dashboard "outstanding receivables" and
customer-center figures are wrong — a real commercial risk, but **not** a blocker for
this design gate. Must be implemented together with Payments (§7).

---

## 10. Permission Model

### 10.1 Current inconsistency (F5)
- **Engine API plane:** `documents.{create,read,update,delete,approve,convert,print}`.
- **UI plane:** `ventes.facture.{view,create,manage}`, `ventes.avoir.{view,create}`,
  `achats.facture.{view,create}`.
- **Dead config:** `DocumentTypeConfig.permissionPrefix` (e.g. `"ventes.facture"`) is
  never read by any guard.

### 10.2 Correct architecture (design)
- **Server remains authoritative** (it already is — guards run server-side).
- Two safe options; pick ONE for Phase 7.5B:
  - **Option A (recommended, lowest risk):** Keep the generic `documents.*` plane as the
    engine's enforcement layer, and have the **UI permission checks also resolve to
    `documents.*`** for document actions, while `ventes.facture.*` continues to gate
    *navigation/quick-create visibility* only. Document this split explicitly.
  - **Option B (cleaner, more work):** Make the engine read `permissionPrefix` per
    docType and map each document action to `<prefix>.create` / `<prefix>.view` /
    `<prefix>.manage`, deprecating the generic `documents.*` keys for typed documents.
- **Do NOT create a third permission system.** Unify on one of the above.
- `ventes.facture.manage` is defined but unused — either wire it (e.g. cancel/approve
  invoices) or drop it.

### 10.3 Report (no implementation)
This is a **design recommendation + cleanup**, not a STOP condition. The engine already
enforces *some* permission; the gap is consistency between server plane and UI plane.

---

## 11. Numbering Model

- **Canonical prefix = `FA`** (from `DocumentSeries`, DB truth; confirmed 2/2 INVOICE
  series use `FA`). Real numbers are generated atomically by `nextDocumentNumber`
  (`series.ts`, compare-and-swap on `nextValue`) — **never client-sent**.
- Engine `numberPrefix = "FAC"` (`config.ts`) affects **only the PDF filename**
  (`service.ts:75`) — cosmetic, harmless, but should be aligned to `"FA"` to avoid
  confusion. **No production numbering change, no migration.**
- `withYear: true`, `year: null` in seed → numbers render as `FA<year>-0001`. The seed
  leaves `year=null`; the engine falls back to `new Date().getFullYear()` in
  `formatSeriesNumber`. **Recommend setting `year` explicitly in seed** (data hygiene,
  not a schema change).
- **Do NOT** reformat historical invoice numbers.
- **F9 verdict:** NOT a blocker; cosmetic cleanup only.

---

## 12. PDF / Print Model

### 12.1 What already works (verified in `templates.ts` / `map-document.ts`)
- Company legal block: `legalName`, `rc`, `taxId`(NIF), `nis`, `ai`, `vatNumber` ✅
- Customer legal block: same identifiers ✅
- Lines, HT/TVA/TTC totals ✅
- `hasPayment` block: paid amount + net payable (when `paidAmount>0`) ✅
- `paymentStatusLabel` ✅
- Amount in words (`amountInWords`) ✅
- Multi-page, RTL Arabic, logo, footer (`invoiceFooter` company setting) ✅

### 12.2 Gaps (require implementation in 7.5B, not this gate)
| Field | Status | Fix |
|-------|--------|-----|
| **Due date (`dueDate`)** | ❌ Not rendered | `ui-config` `INVOICE.showDueDate` is never defined (only `showValidUntil` exists); PDF line `ctx.config.showDueDate ? … : null` → always null. Add `showDueDate: true` to INVOICE/CREDIT_NOTE UI config + propagate `dueDate` into the mapped doc. |
| **Payment terms** | ❌ | New field (terms text) or derive from `Customer.paymentTerms` + `dueDate`. |
| **Remaining amount** | ⚠️ | Only shown if `paidAmount>0`; should always show `netPayable = totalTtc − paidAmount` when `hasPayment`. |
| **Payment status badge** | ✅ | Works once `paymentStatus` is actually written. |
| **Source document** | ⚠️ | `DocumentRelation` exists; PDF does not currently print "Facture issue de BL-000X". Add source ref. |
| **Credit notes list** | ❌ | No credit-note section on the invoice PDF. |
| **QR code** | ❌ (optional) | Not present; algerian-tax-expert says REQUIRES_VERIFICATION before adding a legal QR. |
| **Multi-currency** | ⚠️ | `currency`/`exchangeRate` captured; TVA-in-currency reporting REQUIRES_VERIFICATION. |

**Verdict:** PDF infrastructure is solid and reusable. The main invoice gaps are
**due date not rendered** (config flag missing) and **payment/remaining fields only
meaningful once payments are implemented**.

---

## 13. UI Model

Invoice currently uses the **generic document UI** (`DocumentListPage`,
`DocumentEditorPage`). Missing invoice-specific fields:

| Field | List | Detail/Editor | Notes |
|-------|------|---------------|-------|
| Invoice date (`issuedAt`) | ✅ (generic) | ✅ | |
| Due date (`dueDate`) | ❌ | ❌ not editable | Add editor field + list column |
| Payment terms | ❌ | ❌ | New field |
| Payment status | ❌ (list) | ⚠️ (badge in PDF only) | Add list badge + detail |
| Paid amount | ❌ | ❌ | Add (read-only, server-derived) |
| Remaining amount | ❌ | ❌ | Add (read-only) |
| Source document | ⚠️ (relations tab) | ⚠️ | Surface on detail header |
| Conversion history | ✅ (relations) | ✅ | Works |
| Credit notes | ❌ | ❌ | Surface linked credit notes |
| "New payment" action | ❌ | ❌ | Requires Payment model (§7) |
| "New credit note" action | ✅ (convert toolbar) | ✅ | Works via generic convert |

Navigation itself is complete (F10 not a blocker); the gaps are **field completeness**
and the **payment/credit sub-actions**, all of which depend on §7/§8 implementation.

---

## 14. API Model

All invoice operations already route through the generic engine API:
- `POST /api/documents?type=INVOICE` → `createDocument`
- `GET /api/documents?type=INVOICE` → `listDocuments`
- `PATCH/DELETE /api/documents/[id]?type=INVOICE` → update/delete (DRAFT only)
- `POST /api/documents/convert` → `convertDocument` (source→INVOICE, INVOICE→CREDIT_NOTE)
- `PATCH /api/documents/[id]/status?type=INVOICE` → `transitionStatus`/`approveDocument`
- `GET /api/documents/[id]/(relations|activity|pdf|preview)`

**Required API additions (Phase 7.5B, design only):**
- `POST /api/invoices/[id]/payments` (requires `Payment` model) — server computes
  `paidAmount`/`paymentStatus`, adjusts `Customer.balance` in one transaction.
- `POST /api/documents/convert` INVOICE→CREDIT_NOTE must set `invoiceId` (F4 fix).
- A read-only `GET /api/invoices/[id]/statement` (remaining, allocations) — optional.

**Security note:** all existing guards run server-side; the engine recomputes totals and
rejects cross-company references (§14, §15). No API redesign needed for isolation.

---

## 15. Company Isolation

- `Invoice`, `CreditNote`, `DocumentRelation`, `DocumentSeries` are all in
  `COMPANY_SCOPED_MODELS` (strict). The `companyScope` extension fails-closed outside a
  company context (verified: my read-only script had to use `prismaBase` because the
  scoped client threw outside ALS context).
- Engine services validate references via `assertCompanyReference` (branch/customer/
  supplier) and product membership — all fail-closed.
- `convertGeneric` checks `source.companyId === input.companyId` (403 else).
- **All future invoice operations (payments, credit notes, balance) MUST run inside the
  company context and MUST validate `companyId`/`branchId`/`customerId`/`productId`/
  `sourceDocId`/`invoiceId` belong to the active company.** No cross-company reference
  may ever be accepted.
- `prismaBase` is reserved for SUPER_ADMIN global analytics only — never for company
  invoice flows.

---

## 16. Security Threat Model

| Threat | Mitigated? | Mechanism |
|--------|-----------|-----------|
| IDOR (guess invoice id) | ✅ | `companyId` check on every read/write; scoped client. |
| Cross-company access | ✅ | `companyScope` + explicit `companyId` equality checks. |
| Cross-branch access | ⚠️ | `branchId` validated on create (must belong to company) but there is **no branch-isolation enforcement** beyond company scope (branch is contextual, not a hard boundary per `dz-erp-domain`). Acceptable per architecture. |
| Forged `companyId`/`customerId`/`productId` | ✅ | `assertCompanyReference` rejects foreign references. |
| Forged invoice number | ✅ | Number generated server-side from `DocumentSeries`; client number ignored. |
| Forged totals / TVA | ✅ | `calculation.ts` recomputes from lines; client totals ignored. |
| Forged `paidAmount`/`paymentStatus` | ✅ (once implemented) | Must be derived server-side from `Payment` rows; client values ignored. **Currently moot because nothing writes them.** |
| Forged `dueDate` | ⚠️ | Currently never written; when added, validate server-side (default = issueDate + terms). Do not trust client `dueDate` for status logic. |
| Forged status | ✅ | Only `transitionStatus`/`approveDocument` via `assertTransition`. |
| Duplicate conversion | ✅ | `ALREADY_CONVERTED` relation guard (409). |
| Concurrent conversion (over-invoice) | ⚠️→❌ | **Needs the `invoicedQty`/remaining guard (CAS)** for Delivery-Note→Invoice, mirroring `remainingQty`. Not present today → HIGH risk once DN→Invoice is used at volume. |
| Concurrent payment | ❌ (no Payment model) | Will need atomic `paidAmount` increment + `Customer.balance` CAS in 7.5B. |
| Unauthorized credit note | ✅ (guarded by `documents.convert`) | Must additionally enforce `invoiceId` ownership + creditable-amount cap. |
| Unauthorized approval | ✅ | `documents.approve` guard + `canApprove`. |

**Highest-priority security gap:** concurrent/over-invoicing from Delivery Notes
(missing remaining-quantity guard) and the unmaintained `Customer.balance`.

---

## 17. Database Changes Required

| Change | Class | Risk |
|--------|-------|------|
| `Payment` model (new table) | ADDITIVE (new table only) | MEDIUM (new feature; needs migration audit in 7.5B) |
| `PaymentAllocation` model (optional) | ADDITIVE | LOW–MEDIUM |
| `DeliveryNoteLine.invoicedQty Decimal @default(0)` (or derived) | ADDITIVE (new column) | LOW (nullable default) |
| `InvoiceLine.sourceLineId` / source-doc line ref | ADDITIVE (new column) | LOW |
| `DocumentSeries.year` set in seed | DATA (backfill-free) | LOW |
| `Customer.balance` maintenance logic | NONE (column exists) | — (logic only) |
| `Invoice.dueDate` already exists | NONE | — (just needs writes) |
| `CreditNote.invoiceId` already exists | NONE | — (just needs writes in conversion) |

**No existing production table is altered. No enum is changed. No destructive
migration is required for the schema as-audited.** The only *new* models
(`Payment`, optionally `PaymentAllocation`) are ADDITIVE and must be introduced in a
dedicated phase with their own migration safety review (database-auditor).

---

## 18. Migration Risk

- **SAFE** — no schema change: F2/F3/F4 fixes (write existing columns), F5 permission
  unification (code only), F7 balance logic (column exists), F8 `dueDate` writes,
  F9 cosmetic `numberPrefix` alignment, §12 PDF `showDueDate` config.
- **ADDITIVE** — `Payment` (and `PaymentAllocation`) new tables; `invoicedQty` /
  `sourceLineId` new columns.
- **DATA MIGRATION** — none required for existing production data; `balance` can be
  recomputed by a read-only reconciliation script before it is trusted.
- **ENUM CHANGE** — NONE. `DocumentStatus` and `PaymentStatus` are sufficient.
- **FOREIGN KEY CHANGE** — NONE (new FKs are additive, all `onDelete` Cascade/Restrict
  per existing pattern).
- **HIGH RISK** — only if payments were bolted onto the Invoice row client-side or if
  `balance` were trusted without reconciliation. Both are explicitly avoided by §7/§9.

**STOP CONDITIONS (§18) evaluation:**
- New Prisma model (`Payment`) → REQUIRED, but **reported, not created** (this gate is
  read-only). → TRIGGERS a *planned* STOP for *implementation*; the design continues.
- No enum modification, no alteration of existing production tables, no data migration
  of existing rows, no permission-architecture *redesign* (only unification), no
  Document Engine redesign, no company-isolation redesign, no accounting integration,
  no breaking changes to Quotation/Sales Order/Delivery Note.

> **Conclusion:** This gate produces a DESIGN. Implementation of payments/balance/credit
> writes is deferred to **Phase 7.5B** which owns the `Payment` migration audit.

---

## 19. i18n Requirements

All invoice strings must exist in FR (default), AR (RTL), EN key dictionaries
(`src/i18n/dictionaries.ts`). Verified existing keys: `paidAmount`, `paymentStatus`,
`balance`, `PARTIAL`, `OVERDUE`, `PAID`, `UNPAID`, `amountInWords`, `dueDate`, `netPayable`.
**New keys needed (Phase 7.5B):** `dueDate` (list/detail), `paymentTerms`,
`remainingAmount`, `sourceDocument`, `creditNotes`, `newPayment`, `overdue`,
`creditNoteFromInvoice`, `creditedAmount`, `invoicedQty`, payment-method labels
(cash/bank/cheque/CCP/CIB). No hardcoded FR/AR strings in components.

---

## 20. Test Strategy (for Phase 7.5B)

1. **Service tests** — `createInvoice` writes `dueDate` from terms; `convertDocument`
   QUOTATION/ORDER/DN→INVOICE copies lines and sets relation; INVOICE→CREDIT_NOTE sets
   `invoiceId` (F4 regression).
2. **Over-invoice guard** — concurrent DN→Invoice conversions cannot exceed delivered
   qty (CAS on `invoicedQty`); 409/422 on over-invoice.
3. **Payment derivation** — `paidAmount`/`paymentStatus` recomputed from `Payment` rows;
   partial/paid/overdue transitions; client `paidAmount` ignored.
4. **Credit-note cap** — multiple credit notes bounded by invoiced total; 422 on
   over-credit.
5. **Balance** — `Customer.balance` adjusted atomically on invoice-confirm / payment /
   credit; reconciliation script matches derived sum.
6. **Isolation** — cross-company invoice id, forged customerId/productId, cross-company
   Payment rejected (403/422).
7. **Permission** — both `documents.*` and `ventes.facture.*` planes enforced; UI gating
   matches server.
8. **PDF** — due date, payment status, remaining amount, source doc, credit notes render
   in FR/AR/RTL.
9. **Regression** — re-run `verify:phase75` (Super Admin) + new `verify:phase75b-*`
   suites; ensure Quotation/Sales Order/Delivery Note behavior unchanged.

---

## 21. Regression Strategy

- The Invoice/CreditNote additions are **additive and isolated** to the sales chain; they
  must NOT alter Quotation, Sales Order, or Delivery Note behavior.
- Protect `convertToDeliveryNote` (the specialized, battle-tested partial-delivery path)
  with a dedicated regression test — any change to `conversion.ts` must keep its
  `remainingQty` CAS intact.
- Keep all status transitions via `transitionStatus`/`approveDocument`; add a lint/assert
  test that no direct Prisma status update exists in invoice code.
- Run `npx prisma validate`, `npm run lint`, `npm run build` after every change.
- Read-only reconciliation script (balance, payment totals) as a permanent health check.

---

## 22. Implementation Plan (proposed Phase 7.5B — NOT executed here)

1. **Engine fixes (SAFE, no migration):**
   - `convertGeneric`: set `CreditNote.invoiceId` when target is CREDIT_NOTE (F4).
   - Add `dueDate` to `InputDocument`/`UpdateDocument` + write it in
     `createDocument`/`updateDocument` (default = issuedAt + company payment terms).
   - `ui-config`: `INVOICE.showDueDate = true`; PDF propagate `dueDate`.
   - Align engine `numberPrefix` INVOICE → `"FA"` (cosmetic).
2. **Permission unification (SAFE):** pick Option A or B (§10.2); document the split.
3. **ADDITIVE schema (migration audit required):**
   - `Payment` model + `PaymentAllocation` (optional).
   - `DeliveryNoteLine.invoicedQty` + `InvoiceLine.sourceLineId`.
   - Migration + `prisma generate` + regression.
4. **Payment service:** record payment, atomically recompute `paidAmount`/
   `paymentStatus`, adjust `Customer.balance`, handle cancellation/reversal/overpayment.
5. **Credit-note cap service:** enforce creditable amount/quantity.
6. **UI:** due-date editor, payment-status badge, paid/remaining read-only fields,
   "New payment" + "New credit note" actions, linked credit notes section.
7. **PDF:** due date, remaining, source doc, credit notes.
8. **i18n:** add §19 keys (FR/AR/EN).
9. **Audit/Activity:** payments & credit notes recorded (AuditLog + ActivityEvent).
10. **Tests:** §20 + §21 regression.

---

## 23. STOP Conditions

Per §18, this gate **stops without implementation**. The following were identified as
required but **deferred** (not violated destructively):

- **NEW PRISMA MODEL (`Payment`)** — required for payments; reported, not created.
  → Safe next phase owns its migration audit.
- **NO enum modification** — `DocumentStatus`/`PaymentStatus` sufficient.
- **NO alteration of existing production tables** — only additive columns/models.
- **NO data migration** of existing rows.
- **NO permission-architecture redesign** — only unification of two existing planes.
- **NO Document Engine redesign** — only additive engine fixes.
- **NO company-isolation redesign** — existing `companyScope` retained.
- **NO accounting integration** — invoice prepares data only.
- **NO breaking changes** to Quotation / Sales Order / Delivery Note.

If, during 7.5B, the `Payment` model required altering an *existing* table or enum, that
would re-trigger a STOP and require a fresh audit.

---

## 24. Final Recommendation

**Proceed to Phase 7.5B (Invoice + Payment implementation) with the following gates:**

1. Keep the generic Document Engine as the backbone — apply only the SAFE engine fixes
   (F4 `invoiceId`, F3 `dueDate` writes, F9 cosmetic prefix, PDF `showDueDate`).
2. Introduce `Payment` (ADDITIVE) in its own migration-audited step; derive
   `paidAmount`/`paymentStatus` server-side; never trust client values.
3. Add the remaining-invoicable guard (`invoicedQty` CAS) before enabling high-volume
   Delivery-Note→Invoice conversion — this is the single highest-risk correctness gap.
4. Maintain `Customer.balance` transactionally; ship a read-only reconciliation script.
5. Unify the two permission planes (server stays authoritative).
6. Do NOT touch accounting; invoice only prepares data.

No STOP condition blocks the *design*. The only structural addition (`Payment`) is
ADDITIVE and must be implemented in 7.5B with its own database-auditor review.

---

### Verification Appendix

**Files inspected (read-only):**
- `prisma/schema.prisma` (Invoice, InvoiceLine, CreditNote, CreditNoteLine,
  DocumentRelation, DocumentSeries, Customer, PaymentMethod, DocType/DocumentStatus/
  PaymentStatus/DocumentRelationType enums)
- `prisma/seed.ts` (INVOICE/CREDIT_NOTE series, prefixes)
- `src/features/documents/engine/{config,service,conversion,workflow,validation,calculation,status,series,types}.ts`
- `src/features/documents/framework/{api,normalize,ui-config,status-meta,ui-types}.ts`
- `src/features/auth/permissions.ts`, `src/features/company/api.ts`
- `src/features/print/{templates,map-document,service,types,company-branding,registry}.ts`
- `src/app/api/documents/{route,convert,[id]/route,[id]/status/route}.ts`
- `src/app/(app)/documents/[type]/{page,nouveau,[id]/page}.tsx`
- `src/components/shell/quick-create.tsx`, `src/components/documents/pages/*`
- `src/features/customers/config.ts`, `src/app/(app)/crm/customers/[id]/page.tsx`
- `src/app/(app)/page.tsx` (dashboard invoice/payment queries)
- Repo skills: `document-engine-expert`, `commercial-expert`, `erp-architecture`,
  `database-auditor`, `dz-erp-domain`, `algerian-tax-expert`
- Existing scripts: `scripts/verify-phase75.ts` (Super Admin only; does NOT cover
  invoices)

**Database objects inspected (read-only, via `prismaBase`):**
- `Invoice` (count, paymentStatus distribution, dueDate nullability, paidAmount sum)
- `CreditNote` (count, invoiceId population)
- `DocumentSeries` (INVOICE rows: prefix/year/nextValue)
- `DocumentRelation` (invoice source conversions)
- `Customer` (balance sum)

**Migrations inspected:** schema is valid (`npx prisma validate` → valid). 20 migrations
per database-auditor note; no new migration authored in this gate.

**READ-ONLY queries executed:** one inspection script
(`scripts/_phase75-readonly-inspect.ts`, uses `prismaBase`, no writes) — output captured
in §2.4. Script is non-destructive and may be deleted; it is NOT a committed change.

**Findings confirmed:** F1, F2, F3, F4 (code), F5, F7, F8 (partial).
**Findings rejected as blockers:** F6, F9 (cosmetic), F10 (navigation works).
**Blockers:** NONE that block the design. One required ADDITIVE model (`Payment`) is
deferred to Phase 7.5B with its own migration audit.
**Recommended next phase:** **Phase 7.5B — Invoice + Payment implementation** (engine
SAFE fixes + ADDITIVE `Payment`/`PaymentAllocation` + balance maintenance + permission
unification + PDF/UI/i18n), preceded by a `database-auditor` migration review for the new
models.

---

*End of Phase 7.5A Invoice Design Gate — no code modified, no migration created, no data
changed, no commit made.*
