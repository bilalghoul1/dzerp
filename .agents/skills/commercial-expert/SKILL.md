---
name: commercial-expert
description: Expert on the DzERP commercial cycle: Quotation, Sales Order, Delivery Note, Invoice, Credit Note, Purchase Request, Purchase Order, Goods Receipt, Supplier Invoice, customer/supplier records, status transitions, partial delivery, and the conversion rules between document types. Use when implementing or reviewing any commercial document, its statuses, conversions, or pricing/currency rules.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Commercial Expert (Expert Commercial)

## Purpose

Provide the commercial-domain rules that DzERP enforces or must enforce, so any
agent can implement or review a commercial feature correctly: document types,
statuses, transitions, conversions, pricing, currency and partial deliveries.

This skill covers the 9 commercial document types of the Document Engine plus
customer/supplier data. It does NOT cover accounting entries (accounting-expert),
stock mechanics (inventory-expert) or tax computation (algerian-tax-expert).

## Scope

- Document types: Quotation, Sales Order, Delivery Note, Invoice, Credit Note,
  Purchase Request, Purchase Order, Goods Receipt, Supplier Invoice.
- Document statuses and their legal transitions.
- Conversions between documents (quote→order→delivery, etc.).
- Pricing, discounts, currency/exchange rate, totals.
- Partial delivery mechanics (Sales Order → multiple Delivery Notes).
- Customer / Supplier / Client records.

Out of scope: journal entries, TVA declaration, stock value, RBAC, numbering
(see document-engine-expert).

## Sales Documents and their roles (CONFIRMED schema)

| Document | Role | Inventory effect | Accounting event |
| --- | --- | --- | --- |
| Quotation | Offer to customer, no commitment | none | none |
| Sales Order | Customer commitment to buy | reservation only if implemented (see below) | none |
| Delivery Note | Physical delivery | stock decreases (per line) | none until invoiced |
| Invoice | Billing obligation | depends on design (audit required) | YES (future) |
| Credit Note | Reversal/correction of Invoice | none | YES (future) |

The flow is: Quotation → Sales Order → Delivery Note(s) → Invoice.

## Purchasing Documents and their roles (CONFIRMED schema)

| Document | Role | Inventory effect |
| --- | --- | --- |
| Purchase Request | Internal demand | none |
| Purchase Order | Order sent to supplier | none |
| Goods Receipt | Reception of goods | stock increases (per line) |
| Supplier Invoice | Supplier's bill | none until posted (future) |

The flow is: Purchase Request → Purchase Order → Goods Receipt → Supplier Invoice.

## Partial Delivery Rule (CONFIRMED — `SalesOrderLine.remainingQty`)

- `SalesOrderLine.remainingQty` is a `Decimal @default(0)` column. It tracks
  how much of a line still needs to be delivered.
- One Sales Order may produce **multiple** Delivery Notes.
- Over-delivery is prevented atomically: delivery line quantity cannot exceed
  `remainingQty` (enforced in the delivery creation service — see
  `src/features/delivery-note/` and `src/features/documents/engine/service.ts`).
- When a Delivery Note is created from a Sales Order, each delivered line
  decrements `remainingQty`; full delivery of a line sets it to 0.
- Any new delivery code MUST re-check `remainingQty` inside a transaction; a
  client-side check is not enough (concurrent deliveries race).

## Order Status Rules (CONFIRMED — engine transitions)

Sales and purchasing statuses follow the engine transition maps in
`src/features/documents/engine/config.ts`:

- Sales chain: `DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED →
  PARTIALLY_PROCESSED / PROCESSED → CLOSED`.
- Rejection and cancellation are allowed from non-terminal states
  (`REJECTED`, `CANCELLED` are terminal).
- `VALIDATED` and `ARCHIVED` exist in the enum; check `engine/status.ts`
  (`assertTransition`) before assuming a specific transition is legal.

Do NOT add or change a transition without touching `config.ts` AND
`engine/status.ts` AND the regression tests. See document-engine-expert.

## Conversion Rules (CONFIRMED file `src/features/documents/engine/conversion.ts`)

- Quotation → Sales Order: copies customer, lines, prices, totals. Quotation
  becomes `PROCESSED`/`CONVERTED`; the Order references it.
- Sales Order → Delivery Note: enforces partial delivery and `remainingQty`.
- Purchase Request → Purchase Order: same pattern as the sales side.
- Purchase Order → Goods Receipt: enforces remaining quantities (deliveries
  increase stock; see inventory-expert).
- Invoices (sales and supplier) convert from Delivery Note / Goods Receipt.
  **AUDIT REQUIRED** before implementing: the schema and rules for invoices are
  not yet fully settled.

## Invoice Domain Rules (REQUIRES_VERIFICATION)

- The `Invoice` and `SupplierInvoice` models exist, but the full invoicing
  workflow (what converts to an invoice, whether stock moves at invoice time,
  credit-note reversal mechanics) is **not** fully implemented or documented.
- Any work on invoices MUST first open an impact audit covering:
  - Which document converts to an Invoice and under which status.
  - Whether the Delivery Note and the Invoice are both mandatory.
  - How Credit Note reversal is linked (ref invoice line, quantities, TVA).
  - How the invoice affects inventory and future accounting.
- Do NOT invent invoice numbering, invoice reversal, or "avoir" rules. They
  belong to the accounting/tax domain — ask algerian-tax-expert and
  accounting-expert.

## Pricing and Currency Rules (CONFIRMED schema + engine)

- Every commercial line carries: `price` (Decimal), `quantity` (Decimal),
  `taxPct` (Decimal), `discountPct` (Decimal, default 0), and computed amounts.
- Document-level totals: `totalHt`, `totalTva`, `totalTtc` (Decimal) are stored
  on the document and computed by the engine (`engine/calculation.ts`).
  The server is the source of truth; client totals are ignored/recomputed.
- `currency` + `exchangeRate` exist on documents; amounts are stored in the
  document currency. Rounding and multi-currency conversion is a domain rule —
  AUDIT before implementing multi-currency settlement.
- Prices and quantities are `Decimal` in Prisma — use `Decimal.js`/Prisma
  decimal arithmetic, never JS floats (see database-auditor).

## Customers / Suppliers (CONFIRMED schema)

- `Customer`, `Supplier`, and legacy `Client` models exist. `Customer` and
  `Supplier` are soft-deletable (`deletedAt`) and company-scoped.
- A customer/supplier record carries identifiers (NIF/NIS/RC/AI) — those are
  tax identifiers, see algerian-tax-expert for validation rules.
- Deleting a customer/supplier is a soft delete; historical documents must keep
  working (no hard deletes, no foreign-key breakage).

## Existing DzERP Commercial Rules (CONFIRMED by source)

- All documents are company- and branch-scoped and server-validated.
- Numbering is generated server-side from `DocumentSeries`
  (`src/features/documents/series.ts`) — never accept a client-sent number.
- A document's status may only change through the engine's `transitionStatus`
  (`src/features/documents/engine/workflow.ts`), which enforces `assertTransition`
  and records audit + activity.
- Documents are created by `engine/service.ts` which validates lines
  (`engine/validation.ts`) and computes totals.

## Forbidden Assumptions

- Do NOT assume an invoice is auto-created after delivery.
- Do NOT assume payments are modeled (there is no Payment model yet).
- Do NOT assume credit notes are implemented end-to-end.
- Do NOT assume the status set is small or that "DRAFT is always the start" —
  check `engine/status.ts` `getDefaultStatus()`.
- Do NOT store commercial amounts as floats.
- Do NOT let the client send `totalHt`/`totalTtc` — recompute server-side.

## STOP Conditions

- STOP before implementing Invoice/Credit Note workflows.
- STOP before changing a transition map.
- STOP before touching `SalesOrderLine.remainingQty` semantics.
- STOP before changing pricing or currency rules.
- STOP if an accounting entry would be created without accounting-expert review.
- STOP if you need a new status not in the enum.

## Examples

1. "Add partial delivery for line X" → check `remainingQty`, use engine
   conversion, keep totals consistent, add audit.
2. "Cancel a validated Sales Order" → verify the transition is in
   `config.ts`, call `transitionStatus`, record audit; check no Delivery Note
   references the Order (or define the cancellation rule).
3. "Add a new discount field to Sales Order" → schema + engine calculation +
   validation + UI + i18n + audit; keep `totalHt/TVA/TTC` consistent.

## Interaction With Other Skills

- `document-engine-expert`: statuses, conversions, numbering, framework.
- `inventory-expert`: Delivery Note → stock decrease; Goods Receipt → increase.
- `accounting-expert`: invoices become accounting events; reconcile totals.
- `algerian-tax-expert`: TVA lines, tax identifiers, legal document rules.
- `database-auditor`: Decimal columns, indexes, migration safety.
- `security-rbac-expert`: who may create/validate/cancel a document.
