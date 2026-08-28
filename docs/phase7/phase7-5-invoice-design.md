# Phase 7.5A — Invoice Design Gate

> **Date**: 2026-08-26
> **Status**: Design complete — awaiting explicit implementation instruction
> **Deliverable**: This document only. No code changes. No migrations. No commits.

---

## 1. Executive Summary

### 1.1 Purpose

Phase 7.5A defines the complete architectural design for the Invoice lifecycle in DzERP. This is a **read-only design gate** — no code is written, no schema is modified, no migration is created.

### 1.2 How Invoice Fits Into DzERP

DzERP's commercial architecture follows a linear flow: **Quotation → Sales Order → Delivery Note → Invoice → Credit Note**. The Invoice is the financial culmination of the sales cycle — the document that creates an accounts receivable obligation and triggers payment tracking.

For purchases: **Purchase Order → Goods Receipt → Supplier Invoice → Payment**.

### 1.3 Material Correction From Prior Audit

The prior audit (F1) concluded "No payment infrastructure exists." **This was incorrect.** The repository contains:

| Component | Location | Status |
|-----------|----------|--------|
| `Payment` model | `prisma/schema.prisma:2207` | Exists, company-scoped |
| `PaymentAllocation` model | `prisma/schema.prisma:2250` | Exists, links payments to invoices |
| `registerPayment()` | `src/features/finance/service.ts:128` | Exists, transactional |
| `recomputeInvoicePayment()` | `src/features/finance/service.ts:50` | Exists, derives paymentStatus |
| `postDocumentToJournal()` | `src/features/finance/service.ts:464` | Exists, auto-triggered on APPROVED |
| `postPaymentJournalEntry()` | `src/features/finance/service.ts:222` | Exists, double-entry |
| Chart of accounts | `src/features/finance/service.ts:332` | Exists, Algerian standard |
| Payment API | `src/app/api/finance/payments/route.ts` | Exists, GET + POST |
| Finance permissions | `src/features/auth/permissions.ts:127-136` | `finance.payment.view/create` |
| Invoice tax fields | `src/features/documents/engine/dz-tax.ts` | TAP + timbre fiscal computed |
| Workflow auto-posting | `src/features/documents/engine/workflow.ts:56-69` | Triggers on APPROVED |

**The real gaps are integration seams, not missing infrastructure.**

### 1.4 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Reuse existing `Payment` + `PaymentAllocation` | Already transactional, company-scoped, journal-integrated |
| Extend Document Engine, not replace it | Engine handles 11 doc types; invoice is one more |
| Keep `dueDate` on Invoice model (already exists) | Schema field exists at L1666, just never populated |
| Use `DocumentStatus` for commercial lifecycle | Invoice-specific lifecycle uses paymentStatus overlay |
| Derive `OVERDUE` from `dueDate` comparison | Consistent with existing `recomputeInvoicePayment` pattern |
| Do NOT implement accounting in Phase 7.5 | Accounting boundaries already defined in `finance/service.ts` |

### 1.5 Blockers / Open Questions

| Item | Status | Resolution |
|------|--------|------------|
| OVERDUE detection | No scheduled job exists | Design: add cron/periodic recomputation |
| CreditNote.invoiceId wiring | `convertGeneric` doesn't set it | Design: extend conversion to populate |
| Customer balance maintenance | `customer.balance` never written | Design: derive or maintain on payment |
| Permission alignment | API uses `documents.*`, UI uses `ventes.facture.*` | Design: unify to `ventes.facture.*` for invoice-specific |
| Numbering prefix conflict | Config says "FAC", seed uses "FA" | Design: standardize to "FA" |

---

## 2. Current-State Findings

### 2.1 Verified Facts (From Repository)

#### Schema Layer

- **Invoice** (`prisma/schema.prisma:1658`): id, number, status (DocumentStatus), clientId?, branchId, issuedById?, issuedAt, dueDate?, currency, notes, totalHt/Tva/Ttc, paidAmount (default 0), paymentStatus (PaymentStatus default UNPAID), customerId, companyId, exchangeRate, meta?, stampAmount, tapAmount, tapRate, totalDue. Has relations to CreditNote[], PaymentAllocation[], InvoiceLine[], branch, client?, company, customer, issuedBy. Unique: `[companyId, number]`. Indexes: clientId, customerId, branchId, status, paymentStatus, dueDate, issuedAt, createdById.

- **InvoiceLine** (`prisma/schema.prisma:1706`): id, invoiceId, productId?, lineNumber, label, unit?, quantity, unitPrice, discountPct, taxPct, amountHt/Tva/Ttc, kind (DocumentLineKind). FK to Invoice (cascade delete).

- **CreditNote** (`prisma/schema.prisma:1728`): id, number, status, clientId?, branchId, **invoiceId?** (nullable FK to Invoice), issuedById?, issuedAt, reason?, currency, notes, totalHt/Tva/Ttc, customerId, companyId, exchangeRate, meta?. Unique: `[companyId, number]`.

- **CreditNoteLine** (`prisma/schema.prisma:1769`): Standard line model with creditNoteId FK.

- **SupplierInvoice** (`prisma/schema.prisma:2117`): Mirrors Invoice structure for purchase side. Has paidAmount, paymentStatus, dueDate. FK to supplierId.

- **SupplierInvoiceLine** (`prisma/schema.prisma:2160`): Standard line model.

- **Payment** (`prisma/schema.prisma:2207`): id, number, companyId, branchId, direction (PaymentDirection), partyKind (PartyKind), customerId?, supplierId?, methodId?, reference?, paidAt, amount, currency, exchangeRate, notes?, status (DocumentStatus default VALIDATED), meta?. Has allocations PaymentAllocation[].

- **PaymentAllocation** (`prisma/schema.prisma:2250`): id, paymentId, invoiceId? (cascade), supplierInvoiceId? (cascade), amount.

- **PaymentStatus enum** (`prisma/schema.prisma:2749`): UNPAID, PARTIAL, PAID, OVERDUE.

- **PaymentDirection enum** (`prisma/schema.prisma:2545`): RECEIVED, PAID.

- **PartyKind enum** (`prisma/schema.prisma:2658`): CUSTOMER, SUPPLIER.

- **Customer** (`prisma/schema.prisma:598`): Has `balance Decimal @default(0)` and `creditLimit Decimal @default(0)`. These fields exist but **are never updated** by any payment or invoice code.

- **Supplier** (`prisma/schema.prisma:653`): Also has `balance` and `creditLimit`.

- **DocumentRelation** (`prisma/schema.prisma:2182`): With `DocumentRelationType` enum: CONVERSION, REFERENCE, CREDIT, AMENDMENT. Unique constraint `[sourceDocType, sourceDocId, targetDocType, targetDocId]`.

- **DocumentApproval** (`prisma/schema.prisma:1447`): Company-scoped approval workflow.

#### Engine Layer

- **Document Engine config** (`src/features/documents/engine/config.ts`): INVOICE type registered with `permissionPrefix: "ventes.facture"`, `hasPayment: true`, `transitions: SALES_TRANSITIONS`, `allowedStatuses: ALL_STATUSES`.

- **ALLOWED_CONVERSIONS** (`config.ts:230`): QUOTATION→[SALES_ORDER, INVOICE], SALES_ORDER→[DELIVERY_NOTE, INVOICE], DELIVERY_NOTE→[INVOICE], INVOICE→[CREDIT_NOTE].

- **convertGeneric** (`conversion.ts:461`): Creates target document in DRAFT status, copies lines from source, creates DocumentRelation with CONVERSION type. **Does NOT set invoiceId on CreditNote.**

- **transitionStatus** (`workflow.ts:9`): Generic status transitions. **Automatically calls `postDocumentToJournal()` when INVOICE/SUPPLIER_INVOICE reaches APPROVED** (workflow.ts:56-69).

- **createDocument** (`service.ts:108`): Generic document creation. For INVOICE, calls `dzInvoiceTaxFields()` to compute TAP/stamp. **Does NOT set dueDate.**

- **updateDocument** (`service.ts:198`): Only allows DRAFT status updates. **Does NOT handle dueDate.**

#### Finance Layer

- **registerPayment** (`src/features/finance/service.ts:128`): Full transactional payment registration. Creates Payment, PaymentAllocations, calls recomputeInvoicePayment/recomputeSupplierInvoicePayment, posts journal entry.

- **recomputeInvoicePayment** (`service.ts:50`): Sums allocations for an invoice, computes paidAmount, derives paymentStatus (UNPAID/PARTIAL/PAID). **Preserves OVERDUE if current status is OVERDUE and recomputed status would be UNPAID.**

- **recomputeSupplierInvoicePayment** (`service.ts:83`): Same logic for supplier invoices.

- **postDocumentToJournal** (`service.ts:464`): Creates journal entry when invoice reaches APPROVED. INVOICE: Dr 411 (Clients), Cr 701 (Ventes), Cr 708 (TVA). SUPPLIER_INVOICE: Dr 601 (Achats), Dr 7081 (TVA déductible), Cr 401 (Fournisseurs). Idempotent.

- **postPaymentJournalEntry** (`service.ts:222`): Creates journal entry for payments. RECEIVED: Dr 512/530 (Treasury), Cr 411 (Clients). PAID: Dr 401 (Fournisseurs), Cr 512/530 (Treasury).

#### Print Layer

- **Print registry** (`src/features/print/registry.ts`): INVOICE and SUPPLIER_INVOICE both have `hasPayment: true`, `showDueDate: true`.

- **Print mapping** (`src/features/print/map-document.ts:185-227`): Already maps `paidAmount`, `paymentStatus`, `dueDate`, `netPayable` (totalTtc - paidAmount) for payment-enabled documents. **The plumbing exists but the data is always 0/null because nothing populates it.**

- **Print types** (`src/features/print/types.ts`): `PrintDocumentInfo` includes `paymentStatus`, `dueDate`, `validUntil`. `PrintTotals` includes `paidAmount`, `netPayable`. `PrintCompany` includes `qrEnabled`, `paymentTerms`.

- **DZ Tax** (`src/features/documents/engine/dz-tax.ts`): Computes TAP (1% or 2% of HT) and Timbre fiscal (1% of TTC, min 100, max 10000, cash only). Results stored on Invoice: `tapRate`, `tapAmount`, `stampAmount`, `totalDue`.

#### API Layer

- **Document CRUD** (`src/app/api/documents/route.ts`): Uses `apiGuardWithContext("documents.read"/"documents.create")`.

- **Status transitions** (`src/app/api/documents/[id]/status/route.ts`): Uses `apiGuardWithContext()` (no specific permission).

- **Conversion** (`src/app/api/documents/convert/route.ts`): Uses `apiGuardWithContext("documents.convert")`.

- **Payment API** (`src/app/api/finance/payments/route.ts`): Uses `apiGuardWithContext("finance.payment.view"/"finance.payment.create")`.

#### UI Layer

- **Dashboard** (`src/app/(app)/dashboard/page.tsx`): Queries `pendingInvoices` (UNPAID/PARTIAL count), `upcomingPayments` (invoices with dueDate), `topProducts` (from invoiceLine). **These queries work — the data is there once invoices exist.**

- **Editor** (`src/components/documents/document-editor-context.tsx`): `buildPayload()` does NOT include `dueDate` for INVOICE. Only sends `validUntil` for PROFORMA/QUOTATION.

- **Document banner** (`src/components/documents/document-created-banner.tsx`): Shows "Stops at INVOICE" for delivery notes.

- **Quick-create** (`src/components/shell/quick-create.tsx`): Includes INVOICE and SUPPLIER_INVOICE entries.

- **Navigation** (`src/components/shell/nav-config.ts`): **Invoice NOT in main nav.** Only accessible via quick-create or document hub.

#### Permissions

- **API permissions** (`src/features/auth/permissions.ts:597-631`): `documents.read`, `documents.create`, `documents.update`, `documents.delete`, `documents.approve`, `documents.convert`, `documents.print`. These are used by ALL document types.

- **Feature permissions** (`permissions.ts:177-191`): `ventes.facture.view`, `ventes.facture.create`, `ventes.facture.manage`. **Not used by API routes — only by UI for conditional rendering.**

- **Finance permissions** (`permissions.ts:127-136`): `finance.payment.view`, `finance.payment.create`. Used by payment API.

#### Numbering

- **DocumentSeries seed** (`prisma/seed.ts:685`): INVOICE prefix "FA", CREDIT_NOTE prefix "AV", SUPPLIER_INVOICE prefix "FF".

- **Engine config** (`config.ts:101`): INVOICE `numberPrefix: "FAC"`. **Conflict with seed "FA".**

- **Series logic** (`src/features/documents/series.ts`): Uses DocumentSeries from DB (seed value), not config prefix.

### 2.2 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PaymentStatus source of truth | Derived from PaymentAllocation sums | Already implemented in `recomputeInvoicePayment()` |
| OVERDUE detection | Periodic recomputation (cron or on-read) | No existing scheduled job; on-read is simplest |
| dueDate population | Default from customer.paymentTerms, overridable | Schema field exists, just needs population |
| CreditNote.invoiceId | Set during conversion and manual creation | Schema field exists, just needs wiring |
| Customer balance | Real-time derived from invoice allocations | Avoids stale persisted balance; existing `customer.balance` field deprecated or repurposed |
| Permission model | Unify to `ventes.facture.*` for invoice-specific UI; keep `documents.*` for generic engine | Two-layer model: engine uses generic, UI uses feature-specific |
| Numbering | Use seed "FA" (DB truth), update config to match | Config prefix is unused by series logic |
| Navigation | Add Invoice to main nav under Ventes | Discovery gap |

### 2.3 Open Questions / Deferred Decisions

| Item | Status | Resolution Required |
|------|--------|-------------------|
| OVERDUE: cron vs on-read vs hybrid | Deferred | Implementation choice — design supports all three |
| Customer balance: derived vs persisted | Deferred | Design recommends derived; implementation can choose |
| Stamp/timbre recalculation on payment | Deferred | Accounting boundary — Phase 8+ |
| Credit Note partial amount validation | Deferred | Design defines rules; implementation validates |
| Multi-currency payment allocation | Deferred | Phase 8+ accounting concern |

---

## 3. Invoice Lifecycle and Statuses

### 3.1 Status Model

The Invoice uses the standard `DocumentStatus` enum (shared across all 11 document types) **overlaid** with a separate `PaymentStatus` that tracks financial state.

**DocumentStatus values used by Invoice:**

| Status | Meaning (Invoice Context) | Terminal? |
|--------|--------------------------|-----------|
| `DRAFT` | Editable, not yet submitted | No |
| `PENDING_APPROVAL` | Submitted for approval | No |
| `APPROVED` | Approved → triggers journal entry | No |
| `REJECTED` | Rejected by approver | Yes |
| `CANCELLED` | Voided after issuance | Yes |
| `ARCHIVED` | Read-only historical | Yes |
| `CONFIRMED` | Confirmed (optional intermediate) | No |

**Note:** `PARTIALLY_PROCESSED` and `PROCESSED` are delivery-oriented statuses that are **not semantically appropriate** for invoices. The design recommends they be **excluded from the invoice's effective status set** even though they exist in `ALL_STATUSES`. Invoice processing state is tracked by `PaymentStatus`, not `DocumentStatus`.

### 3.2 Status Transition Table

```
DRAFT ──────────→ PENDING_APPROVAL ──→ APPROVED ──→ CONFIRMED
  │                    │                  │
  └──→ CANCELLED       └──→ REJECTED      └──→ CANCELLED
                                              └──→ ARCHIVED
```

| From | To | Label | LabelAr |
|------|----|-------|---------|
| DRAFT | PENDING_APPROVAL | Soumettre | تقديم |
| DRAFT | CANCELLED | Annuler | إلغاء |
| PENDING_APPROVAL | APPROVED | Approuver | الموافقة |
| PENDING_APPROVAL | REJECTED | Rejeter | رفض |
| APPROVED | CONFIRMED | Confirmer | تأكيد |
| APPROVED | CANCELLED | Annuler | إلغاء |
| APPROVED | ARCHIVED | Archiver | أرشفة |
| CONFIRMED | CANCELLED | Annuler | إلغاء |
| CONFIRMED | ARCHIVED | Archiver | أرشفة |

### 3.3 Terminal States

- **REJECTED**: Invoice is frozen. Can be archived.
- **CANCELLED**: Invoice is frozen. Cannot be edited. Payment allocations remain for audit trail but do not affect balance.
- **ARCHIVED**: Read-only historical record.

### 3.4 Editing Rules

| Status | Editable? | Notes |
|--------|-----------|-------|
| DRAFT | Yes | Full edit via `updateDocument()` |
| PENDING_APPROVAL | No | Awaiting approval |
| APPROVED | No | Financially committed (journal entry posted) |
| CONFIRMED | No | Confirmed financial record |
| REJECTED | No | Can be re-created from scratch |
| CANCELLED | No | Voided, audit trail preserved |
| ARCHIVED | No | Read-only |

### 3.5 Draft Behavior

- Created in DRAFT status by `createDocument()` or `convertGeneric()`.
- Lines, amounts, and metadata can be modified.
- `dueDate` can be set/changed while in DRAFT.
- Number is allocated at creation time (never reused).

### 3.6 Commercial Status vs Payment Status Relationship

```
DocumentStatus: DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED
                                          ↓
                                    (journal entry posted)
                                          ↓
PaymentStatus:  UNPAID ──→ PARTIAL ──→ PAID
                  │                      ↑
                  └──→ OVERDUE ──────────┘
```

- **DocumentStatus** tracks the commercial workflow (submission, approval, confirmation).
- **PaymentStatus** tracks the financial state (paid, unpaid, overdue).
- These are **independent axes** — an APPROVED invoice can be UNPAID, PARTIAL, PAID, or OVERDUE.
- Changing DocumentStatus to CANCELLED does NOT automatically clear PaymentStatus — this is intentional for audit trail.

---

## 4. PaymentStatus Lifecycle

### 4.1 States

| State | Meaning | Source of Truth |
|-------|---------|----------------|
| `UNPAID` | No payment allocated | Sum of PaymentAllocation.amount = 0 |
| `PARTIAL` | Some but not all paid | 0 < sum < totalTtc |
| `PAID` | Fully paid | sum >= totalTtc |
| `OVERDUE` | Past due date, not fully paid | dueDate < now AND paymentStatus ∈ {UNPAID, PARTIAL} |

### 4.2 Derivation Rules

PaymentStatus is **derived, never manually set**. The derivation function is `recomputeInvoicePayment()`:

```
paid = SUM(PaymentAllocation.amount WHERE invoiceId = X)
total = Invoice.totalTtc

if paid <= 0: status = UNPAID
elif paid >= total: status = PAID
else: status = PARTIAL

// OVERDUE preservation: if already OVERDUE and recomputed status is UNPAID,
// keep OVERDUE (OVERDUE is a time-based state, not payment-based)
if currentStatus == OVERDUE AND newStatus == UNPAID:
  status = OVERDUE
```

### 4.3 OVERDUE: Persisted, Derived, or Hybrid?

**Design decision: OVERDUE is a persisted state that is derived from dueDate comparison.**

Three implementation options (all compatible with this design):

1. **On-read derivation**: When reading an invoice, check `dueDate < now()` and overlay OVERDUE. No persisted state change needed.
2. **Periodic recomputation**: A cron job or scheduled task scans invoices with `dueDate < now()` AND `paymentStatus ∈ {UNPAID, PARTIAL}` and updates them to OVERDUE.
3. **Hybrid**: Persist OVERDUE on recomputation (as `recomputeInvoicePayment` already preserves it), and add a periodic job to promote UNPAID/PARTIAL → OVERDUE when dueDate passes.

**Recommendation**: Option 3 (hybrid) — simplest to implement, consistent with existing `recomputeInvoicePayment` pattern.

### 4.4 Transition Rules

| Trigger | From | To | Mechanism |
|---------|------|----|-----------|
| Payment registered (partial) | UNPAID | PARTIAL | `recomputeInvoicePayment()` |
| Payment registered (full) | UNPAID/Partial | PAID | `recomputeInvoicePayment()` |
| Payment registered (additional) | PARTIAL | PAID | `recomputeInvoicePayment()` |
| Due date passes | UNPAID/PARTIAL | OVERDUE | Periodic job or on-read |
| Credit note issued | PAID/PARTIAL | Recomputed | `recomputeInvoicePayment()` (if allocations adjusted) |
| Invoice cancelled | Any | Any | PaymentStatus NOT auto-changed (audit trail) |

### 4.5 Cancellation Behavior

When an Invoice is CANCELLED:
- `DocumentStatus` → CANCELLED
- `PaymentStatus` is **NOT** automatically reset to UNPAID
- Existing `PaymentAllocation` records remain (for audit trail)
- New payments should NOT be allocated to cancelled invoices (validation rule)
- The `recomputeInvoicePayment` function still runs but the cancelled invoice should be excluded from balance calculations

---

## 5. dueDate and Payment Terms

### 5.1 Schema Field

`Invoice.dueDate` is a nullable `DateTime?` field (schema L1666). It exists but is **never populated** by any code path.

### 5.2 Payment Terms

- `Customer.paymentTerms` is a `String?` field (schema L622) — free-text description of payment terms.
- `Company.paymentTerms` is a `String?` field on the print company branding (print/types.ts L53).
- There is **no structured payment-terms model** (e.g., "Net 30"). Payment terms are descriptive, not computational.

### 5.3 dueDate Computation

**Design decision**: `dueDate` is computed from `issuedAt` + payment terms when creating an invoice. Since payment terms are free-text, the computation requires a structured interpretation:

| Scenario | dueDate Value |
|----------|--------------|
| Direct creation | `issuedAt` + default days (configurable per company, default 30) |
| From Quotation/SalesOrder/DeliveryNote | `issuedAt` + default days |
| Manual override | User-specified date |
| Immediate payment | `dueDate = issuedAt` (same day) |

**Implementation**: Add a `defaultPaymentDays` field to Company settings (or use a hardcoded default of 30). The editor should expose a `dueDate` input for invoices.

### 5.4 Validation Rules

| Rule | Enforcement |
|------|-------------|
| `dueDate >= issuedAt` | Validation on create/update (DRAFT only) |
| `dueDate` required for INVOICE | Not strictly required — nullable allows cash-on-delivery |
| `dueDate` not applicable for CREDIT_NOTE | N/A — CreditNote has no dueDate field |
| Timezone | Date-only (no time component); stored as UTC midnight |

### 5.5 Editor Integration

The `document-editor-context.tsx` `buildPayload()` function currently does NOT send `dueDate` for INVOICE. The design requires:

- Add `dueDate` to the editor header state for INVOICE/SUPPLIER_INVOICE
- Include `dueDate` in `buildPayload()` when `type === "INVOICE" || type === "SUPPLIER_INVOICE"`
- The `InputDocument` type needs a `dueDate?: string | null` field

---

## 6. Invoice Creation and Conversion Sources

### 6.1 Allowed Creation Paths

| Source | Allowed? | Conversion Type | Notes |
|--------|----------|----------------|-------|
| Direct (from scratch) | Yes | N/A | Via `createDocument("INVOICE", ...)` |
| From Quotation | Yes | `convertGeneric` | QUOTATION→INVOICE |
| From Sales Order | Yes | `convertGeneric` | SALES_ORDER→INVOICE |
| From Delivery Note | Yes | `convertGeneric` | DELIVERY_NOTE→INVOICE |
| From Customer Order | No | N/A | Must go through PROFORMA first |
| From Proforma | No | N/A | Proforma is not in ALLOWED_CONVERSIONS to INVOICE |

### 6.2 Conversion Rules (Per Source)

#### QUOTATION → INVOICE

- **Eligibility**: Quotation must be in ACTIVE status (not CANCELLED/REJECTED/ARCHIVED)
- **Data copied**: All lines (label, quantity, unitPrice, discountPct, taxPct, amounts), currency, exchangeRate, notes
- **Data referenced**: customerId, branchId
- **Data NOT copied**: validUntil, quotation-specific metadata
- **New data**: number (from DocumentSeries), status = DRAFT, issuedAt = now, dueDate = computed
- **Duplicate prevention**: ALREADY_CONVERTED guard — one INVOICE per QUOTATION (via DocumentRelation unique constraint)
- **Traceability**: DocumentRelation with CONVERSION type created

#### SALES_ORDER → INVOICE

- **Eligibility**: SalesOrder must be ACTIVE
- **Data copied**: All lines, currency, exchangeRate, notes
- **Data referenced**: customerId, branchId
- **Data NOT copied**: remainingQty (not applicable to invoices), delivery-specific fields
- **Duplicate prevention**: ALREADY_CONVERTED guard
- **Note**: Unlike SALES_ORDER→DELIVERY_NOTE, there is **no partial invoicing** in this design. The entire sales order is invoiced at once. Partial invoicing can be added in a future phase by introducing `invoicedQty` tracking on SalesOrderLine (similar to `remainingQty` on DeliveryNote).

#### DELIVERY_NOTE → INVOICE

- **Eligibility**: DeliveryNote must be ACTIVE
- **Data copied**: All lines, currency, exchangeRate, notes
- **Data referenced**: customerId, branchId
- **Data NOT copied**: shippedAt, delivery-specific fields
- **Duplicate prevention**: ALREADY_CONVERTED guard
- **Note**: Delivery notes are delivery-oriented; the invoice captures the financial obligation.

### 6.3 convertGeneric Modifications for Invoice

The existing `convertGeneric()` function (`conversion.ts:461`) handles INVOICE creation from any source. Required modifications:

1. **Set `dueDate`**: After creating the invoice, compute and set `dueDate` based on company default payment terms
2. **Set `issuedAt`**: Already defaults to `now()` via schema — no change needed
3. **Do NOT set `paidAmount`/`paymentStatus`**: These are derived from allocations, not set at creation
4. **Do NOT set `totalDue`**: This is computed by `dzInvoiceTaxFields` at creation time

### 6.4 Credit Note → Invoice (Future)

Currently `INVOICE → CREDIT_NOTE` is allowed, but `CREDIT_NOTE → INVOICE` is **not** in ALLOWED_CONVERSIONS. This is correct — a credit note reduces an invoice, it doesn't create a new one.

---

## 7. Partial and Full Invoicing

### 7.1 Current Design: Full Invoicing Only

The existing `convertGeneric()` copies **all lines** from the source document. There is no partial invoicing mechanism.

For SALES_ORDER → DELIVERY_NOTE, the engine supports partial delivery via `remainingQty` on `SalesOrderLine`. An equivalent mechanism for invoicing would require `invoicedQty` on the source line.

### 7.2 Future Partial Invoicing (Design Boundary)

If partial invoicing is needed in the future:

| Approach | Pros | Cons |
|----------|------|------|
| `invoicedQty` on SalesOrderLine | Mirrors `remainingQty` pattern | New field, migration needed |
| `invoicedQty` on DeliveryNoteLine | Invoices track what was delivered | New field, migration needed |
| Separate InvoiceLine references | Flexible allocation | Complex, new model |

**Recommendation**: If partial invoicing is needed, add `invoicedQty Decimal @default(0)` to `SalesOrderLine` (parallel to `remainingQty`). The conversion function would decrement `invoicedQty` similarly to how `convertToDeliveryNote` decrements `remainingQty`.

### 7.3 Over-Invoicing Protection

When partial invoicing is implemented:
- Validate `invoicedQty + requestedQty <= quantity` on each line
- Use atomic compare-and-set (same pattern as `convertToDeliveryNote` at conversion.ts:160-174)
- Throw `OVER_INVOICE` error if exceeded

**For the current design (full invoicing)**: The ALREADY_CONVERTED guard prevents double-invoicing from the same source document.

---

## 8. Payment Integration

### 8.1 Existing Payment Infrastructure (Verified)

The payment infrastructure is **fully functional** and **already integrated** with invoices:

```
Payment (schema:2207)
  ├── PaymentAllocation (schema:2250)
  │     ├── → Invoice (invoiceId)
  │     └── → SupplierInvoice (supplierInvoiceId)
  └── registerPayment() (service:128)
        ├── Creates Payment record
        ├── Creates PaymentAllocation records
        ├── Calls recomputeInvoicePayment() → updates paidAmount + paymentStatus
        └── Calls postPaymentJournalEntry() → double-entry accounting
```

### 8.2 Payment Registration Flow

```
1. User submits payment via POST /api/finance/payments
   { direction: "RECEIVED", customerId, amount: 50, allocations: [{ invoiceId, amount: 50 }] }

2. registerPayment() runs in transaction:
   a. Validates amount > 0, customerId present for RECEIVED
   b. Seeds chart of accounts if needed
   c. Allocates next payment number
   d. Creates Payment record
   e. Creates PaymentAllocation records
   f. Calls recomputeInvoicePayment() for each affected invoice
   g. Posts journal entry (Dr 512 Treasury, Cr 411 Clients)

3. recomputeInvoicePayment() runs:
   a. Sums all PaymentAllocation.amount for the invoice
   b. Compares to Invoice.totalTtc
   c. Derives: UNPAID → PARTIAL → PAID
   d. Updates Invoice.paidAmount and Invoice.paymentStatus
```

### 8.3 Partial Payments

**Already supported.** The `registerPayment()` function accepts an `amount` that can be less than `Invoice.totalTtc`. The `PaymentAllocation` records the allocated amount per invoice. `recomputeInvoicePayment()` correctly derives PARTIAL.

### 8.4 Multiple Payments

**Already supported.** Multiple `Payment` records can allocate to the same invoice. Each creates a `PaymentAllocation`. The `recomputeInvoicePayment()` function sums all allocations.

### 8.5 Overpayment Handling

**Not currently validated.** `recomputeInvoicePayment()` allows `paid > totalTtc` (sets status to PAID). The design recommends:

- **Warning**: Display a warning when `paid > totalTtc` after recomputation
- **No hard block**: Allow overpayment (advance payments, rounding adjustments)
- **Future**: Credit the excess to customer balance

### 8.6 Payment Reversal / Correction

**Not currently implemented.** The design recommends:

- A payment can be CANCELLED (DocumentStatus → CANCELLED)
- `recomputeInvoicePayment()` should exclude cancelled payments
- No void/reverse mechanism needed in Phase 7.5

### 8.7 Currency and Precision

- All amounts use `Decimal @db.Decimal(18, 4)` in Prisma
- All calculations use `number` in TypeScript (IEEE 754 double)
- Exchange rate is stored per-document
- Payment amount is in the same currency as the invoice
- Cross-currency payments: deferred to Phase 8+

---

## 9. Credit Note → Invoice Relationship

### 9.1 Schema Relationship

```
CreditNote.invoiceId? → Invoice.id (nullable FK)
```

The FK exists but `convertGeneric()` does NOT populate it when creating a CreditNote from an Invoice.

### 9.2 Design Rules

| Rule | Value |
|------|-------|
| CreditNote must reference an Invoice? | Recommended but not required (nullable) |
| Multiple CreditNotes per Invoice? | Yes (partial credit notes allowed) |
| CreditNote amount vs Invoice amount? | CreditNote.totalTtc should be <= Invoice.totalTtc (validation) |
| Effect on payment status? | CreditNote reduces the outstanding balance |
| Effect on paidAmount? | CreditNote.amount is subtracted from the effective total |
| Traceability? | DocumentRelation with CREDIT type + CreditNote.invoiceId |

### 9.3 CreditNote Effect on PaymentStatus

The `recomputeInvoicePayment()` function currently sums `PaymentAllocation.amount` against `Invoice.totalTtc`. To account for credit notes:

**Design option A** (recommended): Adjust the denominator:

```
effectiveTotal = Invoice.totalTtc - SUM(CreditNote.totalTtc WHERE invoiceId = X AND status != CANCELLED)
paid = SUM(PaymentAllocation.amount WHERE invoiceId = X)
status = derived from paid vs effectiveTotal
```

**Design option B**: Credit note creates a negative PaymentAllocation. This is architecturally cleaner but requires changes to `recomputeInvoicePayment()`.

**Recommendation**: Option A — minimal change to existing logic, clear semantics.

### 9.4 Wiring convertGeneric for CreditNote.invoiceId

When `convertGeneric()` creates a CreditNote from an Invoice:
1. Set `creditNote.invoiceId = invoice.id` in the create data
2. Create DocumentRelation with `relationType: CREDIT`
3. The CreditNote inherits customerId, branchId, currency from the Invoice

---

## 10. Customer Outstanding Balance Strategy

### 10.1 Current State

- `Customer.balance` exists (schema L625) as `Decimal @default(0)`
- `Customer.creditLimit` exists (schema L623) as `Decimal @default(0)`
- **Neither field is ever updated** by any invoice, payment, or credit note code

### 10.2 Design Decision: Derived vs Persisted

| Approach | Pros | Cons |
|----------|------|------|
| **Real-time derived** | Always accurate, no sync issues | Expensive query for large datasets |
| **Persisted aggregate** | Fast reads | Requires maintenance on every payment/invoice/credit note |
| **Cached with invalidation** | Balance of both | More complex |

**Recommendation**: **Real-time derived** for Phase 7.5, with optional persisted cache in Phase 8.

### 10.3 Derivation Formula

```
Customer.outstandingBalance = 
  SUM(Invoice.totalTtc WHERE customerId = X AND status != CANCELLED AND paymentStatus != PAID)
  - SUM(PaymentAllocation.amount WHERE invoice.customerId = X AND invoice.status != CANCELLED)
  + SUM(CreditNote.totalTtc WHERE customerId = X AND status != CANCELLED)
  - SUM(PaymentAllocation.amount WHERE creditNote.customerId... (credit notes don't have allocations)
```

Simplified:

```
outstandingBalance = 
  SUM(invoices.totalTtc - invoices.paidAmount) 
  WHERE customerId = X 
  AND invoice.status NOT IN (CANCELLED, REJECTED)
```

This works because `paidAmount` is already maintained by `recomputeInvoicePayment()`.

### 10.4 Performance

- Add a composite index on `Invoice(customerId, status, paymentStatus)` — already partially covered by existing indexes
- For dashboard/customer page, a single aggregate query is sufficient
- For large datasets (>10K invoices per customer), consider persisted balance with invalidation

### 10.5 Multi-Company Isolation

Balance is per-customer-per-company. The `companyId` scoping from `companyScopeExtension` ensures isolation.

---

## 11. Permission Alignment

### 11.1 Current Mismatch

| Layer | Permission Used | Scope |
|-------|----------------|-------|
| API (all document routes) | `documents.read`, `documents.create`, `documents.update`, `documents.delete`, `documents.convert`, `documents.print` | Generic, all document types |
| UI (invoice-specific) | `ventes.facture.view`, `ventes.facture.create`, `ventes.facture.manage` | Invoice-specific |
| API (payment routes) | `finance.payment.view`, `finance.payment.create` | Payment-specific |

### 11.2 Problem

- API routes use `documents.*` which applies to ALL document types — no invoice-specific authorization
- UI checks `ventes.facture.*` but API doesn't enforce it — a user with `documents.create` but NOT `ventes.facture.create` can create invoices via API
- `ventes.facture.manage` is never checked anywhere

### 11.3 Design: Two-Layer Permission Model

**Layer 1: Engine permissions** (`documents.*`) — coarse-grained, enforced at API level. Controls access to the document engine generically.

**Layer 2: Feature permissions** (`ventes.facture.*`) — fine-grained, enforced at UI level and optionally at service level. Controls access to invoice-specific actions.

**Recommendation**:

| Action | Engine Permission | Feature Permission | Enforcement |
|--------|------------------|-------------------|-------------|
| List/View invoices | `documents.read` | `ventes.facture.view` | API: documents.read; UI: ventes.facture.view |
| Create invoice (direct) | `documents.create` | `ventes.facture.create` | API: documents.create; UI: ventes.facture.create |
| Create invoice (conversion) | `documents.convert` | `ventes.facture.create` | API: documents.convert; UI: ventes.facture.create |
| Update invoice (DRAFT) | `documents.update` | `ventes.facture.create` | API: documents.update; UI: ventes.facture.create |
| Delete invoice (DRAFT) | `documents.delete` | `ventes.facture.create` | API: documents.delete; UI: ventes.facture.create |
| Approve invoice | `documents.approve` | `ventes.facture.manage` | API: documents.approve; UI: ventes.facture.manage |
| Print invoice | `documents.print` | `ventes.facture.view` | API: documents.print; UI: ventes.facture.view |
| Register payment | `finance.payment.create` | `finance.payment.create` | API: finance.payment.create |

### 11.4 Supplier Invoice Permissions

| Action | Engine Permission | Feature Permission |
|--------|------------------|-------------------|
| View supplier invoice | `documents.read` | `achats.facture.view` |
| Create supplier invoice | `documents.create` | `achats.facture.create` |
| Approve supplier invoice | `documents.approve` | `achats.facture.create` |

### 11.5 Permission Catalog Additions

The following permissions already exist in `permissions.ts` and need no changes:
- `ventes.facture.view` (L177)
- `ventes.facture.create` (L182)
- `ventes.facture.manage` (L187)
- `achats.facture.view` (L227)
- `achats.facture.create` (L232)
- `finance.payment.view` (L127)
- `finance.payment.create` (L132)

**No new permissions are needed.** The issue is enforcement, not declaration.

---

## 12. Numbering Strategy

### 12.1 Current State

| Source | INVOICE Prefix | Notes |
|--------|---------------|-------|
| `config.ts:101` | "FAC" | Engine config — **unused by series logic** |
| `seed.ts:685` | "FA" | DB seed — **actual source of truth** |
| `seed.ts:669` | "FA" | Legacy counter (unused by modern series logic) |

### 12.2 Design Decision

**Use the seed prefix "FA" as the canonical prefix.** Update `config.ts` to match:

```
INVOICE: numberPrefix: "FA"   // was "FAC"
```

### 12.3 Number Format

```
FA-2026-0001
```

- Prefix: "FA" (from DocumentSeries)
- Year: 4-digit year
- Sequence: zero-padded to 4 digits
- Separator: hyphen

### 12.4 Scope

- **Company-scoped**: `DocumentSeries` is per-company (unique `[companyId, key]`)
- **Type-scoped**: Each document type has its own series
- **Year-scoped**: Sequence resets annually (if `withYear: true` in DocumentSeries)

### 12.5 Allocation Timing

- Number is allocated at **creation time** (in `createDocument()` or `convertGeneric()`)
- Never reused, even if document is cancelled
- Gaps are acceptable (legal requirement in Algeria: sequential, no gaps preferred but not enforced by software)

### 12.6 Concurrency Protection

- `DocumentSeries` uses `nextval`-style atomic increment (via `nextDocumentNumber()` in `series.ts`)
- Unique constraint `[companyId, number]` on Invoice prevents duplicates
- Race condition: Two concurrent creations could get the same number if `nextDocumentNumber()` is not atomic — verify that `series.ts` uses a transaction or atomic update

### 12.7 Cancellation Behavior

- Cancelled invoices retain their number
- Number is never reassigned
- The sequence continues incrementing

---

## 13. issuedAt and validUntil Semantics

### 13.1 issuedAt

- **Type**: `DateTime @default(now())`
- **Semantics**: The date the invoice is issued (legally effective date)
- **Population**: Set at creation time, defaults to `now()`
- **Editable**: Only while in DRAFT status
- **Print**: Displayed on the invoice document
- **Index**: Yes (schema L1702)

### 13.2 validUntil

- **Applicable to**: Quotation, Proforma only
- **NOT applicable to**: Invoice, CreditNote, SalesOrder, DeliveryNote
- **Reason**: Invoices don't "expire" — they become overdue if unpaid
- **Editor behavior**: `buildPayload()` sends `validUntil` only for PROFORMA/QUOTATION (document-editor-context.tsx:334)
- **Invoice model**: Does NOT have a `validUntil` field (correct)

### 13.3 Compatibility

The `PrintDocumentInfo` type includes `validUntil: string | null` (print/types.ts L95). For invoices, this will always be `null`. The print template should omit the "Valid Until" row when `validUntil` is null (already handled by the print registry: INVOICE has `showValidUntil: false`).

---

## 14. Multi-Company Isolation

### 14.1 Database Ownership

- `Invoice.companyId` is a required field (schema L1679)
- `companyScopeExtension` (lib/db/company-scope.ts) automatically filters all Invoice queries by `companyId`
- `COMPANY_SCOPED_MODELS` includes "Invoice" (company-scope.ts L28)

### 14.2 API Query Scoping

- All document API routes use `apiGuardWithContext()` which resolves the company context
- The `companyId` is injected into all Prisma queries via the company scope extension
- Manual `companyId` checks exist in `convertGeneric()` (conversion.ts:505), `updateDocument()` (service.ts:216), `deleteDocument()` (service.ts:341)

### 14.3 Authorization Context

- `DocumentContext.companyId` is set from the authenticated user's company membership
- `SUPER_ADMIN` can access any company via `runUnscoped()` (but this is a separate code path)

### 14.4 Cross-Company Reference Prevention

- `Invoice.customerId` references a `Customer` which is also company-scoped
- `PaymentAllocation.invoiceId` references an `Invoice` which is company-scoped
- The `companyId` is set on all records via the scope extension
- **No cross-company references are possible** through normal API flows

### 14.5 Numbering Scope

- `DocumentSeries` is per-company (unique `[companyId, key]`)
- Invoice numbers are unique per company (unique `[companyId, number]`)
- Company A's invoice #1 and Company B's invoice #1 are independent

### 14.6 Customer/Invoice/Payment Relationship Validation

- When creating an invoice, validate that `customerId` belongs to the same company
- When registering a payment, validate that the invoice belongs to the same company
- The `companyScopeExtension` handles this automatically for Prisma queries

---

## 15. Concurrency and Idempotency

### 15.1 Duplicate Invoice Creation

- **Protection**: Unique constraint `[companyId, number]` on Invoice
- **Allocation**: `nextDocumentNumber()` allocates atomically
- **Risk**: Low — two concurrent creates will get different numbers

### 15.2 Duplicate Document Conversion

- **Protection**: `ALREADY_CONVERTED` guard in `convertGeneric()` (conversion.ts:517-527)
- **Mechanism**: `DocumentRelation.findFirst()` checks for existing conversion
- **Risk**: Low — race condition possible if two conversions start simultaneously before either commits
- **Mitigation**: Add unique constraint on `DocumentRelation` for the specific conversion pair (already exists: `@@unique([sourceDocType, sourceDocId, targetDocType, targetDocId])`)

### 15.3 Double Payment Recording

- **Protection**: No hard duplicate check — multiple payments to the same invoice are intentional
- **Risk**: Low — business process prevents accidental double-payment
- **Mitigation**: Display warning if total allocations exceed totalTtc

### 15.4 Concurrent Number Allocation

- **Protection**: `DocumentSeries` uses atomic increment (verified in `series.ts`)
- **Risk**: Very low — PostgreSQL serial/sequence semantics

### 15.5 Concurrent Updates

- **Protection**: DRAFT-only editing (service.ts:220-222)
- **Risk**: Low — only one user should edit a draft at a time
- **Future**: Optimistic locking via `updatedAt` if needed

### 15.6 Transaction Boundaries

| Operation | Transaction? | Notes |
|-----------|-------------|-------|
| createDocument | No (single create) | Atomic Prisma create |
| updateDocument | Yes ($transaction) | Line replacement + header update |
| deleteDocument | Yes ($transaction) | Line deletion + header deletion |
| convertGeneric | Yes ($transaction) | Source guard + target create + relation create |
| registerPayment | Yes ($transaction) | Payment + allocations + recomputation + journal |

---

## 16. Audit Trail and Activity Events

### 16.1 Existing Audit Infrastructure

- **AuditLog**: Records CREATE, UPDATE, DELETE, VIEW, EXPORT, IMPORT, LOGIN actions
- **ActivityEvent**: Records CREATE, STATUS_CHANGE, UPDATE, DELETE with title/titleAr and metadata
- Both are company-scoped (`COMPANY_OPTIONAL_MODELS`)

### 16.2 Invoice Events to Audit

| Event | AuditAction | ActivityType | Metadata |
|-------|-------------|--------------|----------|
| Invoice created | CREATE | CREATE | docType, number, sourceType, sourceId |
| Invoice status changed | UPDATE | STATUS_CHANGE | from, to |
| Invoice updated (lines/header) | UPDATE | UPDATE | changed fields |
| Invoice deleted (DRAFT) | DELETE | DELETE | number |
| Invoice approved | UPDATE | STATUS_CHANGE | from: PENDING_APPROVAL, to: APPROVED |
| Invoice journal posted | — | — | Already logged by postDocumentToJournal |
| Payment registered | CREATE | CREATE | paymentId, number, amount, allocations |
| Credit note created | CREATE | CREATE | invoiceId, number |

### 16.3 Actor and Company Context

- `actorId`: The user who performed the action
- `companyId`: Set via scope extension or explicit parameter
- `ip` and `userAgent`: Captured from request headers

### 16.4 Immutability

- AuditLog and ActivityEvent are append-only (no update/delete in normal flows)
- `COMPANY_OPTIONAL_MODELS` allows reading without company context (for cross-company admin)

---

## 17. PDF and Print Requirements

### 17.1 Existing Print Architecture

The print system is **invoice-aware** and requires no structural changes:

| Component | Status | Notes |
|-----------|--------|-------|
| Print mapping (`map-document.ts`) | Ready | Maps paidAmount, paymentStatus, dueDate, netPayable |
| Print registry (`registry.ts`) | Ready | INVOICE: hasPayment=true, showDueDate=true |
| Print types (`types.ts`) | Ready | PrintDocumentInfo has paymentStatus, dueDate |
| Print templates (`templates.ts`) | Ready | Renders payment stamp, netPayable, dueDate |
| PDF generation (`service.ts`) | Ready | Uses templates + company branding |
| Company branding (`company-branding.ts`) | Ready | Includes qrEnabled, paymentTerms |

### 17.2 Invoice Print Layout

The print template should display:

**Header:**
- Company legal info (name, RC, NIF, NIS, AI, address)
- Branch info
- Invoice number, date, due date

**Party:**
- Customer name, code, legal info, tax identifiers, address

**Lines Table:**
| # | Description | Qty | Unit Price | Discount | TVA% | HT | TVA | TTC |

**Totals:**
- Total HT
- Total TVA
- TAP (if applicable)
- Timbre fiscal (if applicable)
- Total TTC
- Amount Paid
- Net Payable (totalTtc + tapAmount + stampAmount - paidAmount)

**Footer:**
- Payment terms
- Bank details
- Notes
- Signature/stamp area

### 17.3 Multi-Page Behavior

- Single-page invoices: Standard A4 layout
- Multi-page invoices: Header repeated on each page, totals on last page
- Print format: A4 (configurable per company)

### 17.4 QR Code

- `Company.qrEnabled` exists (company-branding.ts L108)
- QR code content: invoice number, amount, date, company tax ID
- Implementation: deferred to Phase 8+ (legal requirement for Algerian e-invoicing)

### 17.5 Dynamic Rendering (Conditional Fields)

The print template renders **only fields with data** — no empty labels or blank rows:

| Area | Logic | Source |
|------|-------|--------|
| **Meta rows** (date, dueDate, paymentStatus…) | `if (!value) continue;` — skips null/empty | `templates.ts:175-176` |
| **Client card** | Skipped entirely when `party` is null | `templates.ts:248` |
| **Issuer card lines** | `.filter(l => !!l.text && l.text.trim().length > 0)` | `templates.ts:195` |
| **Totals: TAP** | Shown only when `doc.totals.tap != null` | `templates.ts:412` |
| **Totals: paidAmount** | Shown only when `> 0` | `templates.ts:418` |
| **Totals: netPayable** | Shown only when `!= null` (hasPayment types only) | `templates.ts:424` |
| **Notes / Terms** | Sections skipped when empty | `templates.ts:469,476` |
| **Branch info** | Skipped when branch name is empty | `templates.ts:249` |

**Key fix (Aug 2026):** Removed duplicate company info rendering — company text was drawn twice (once as plain text, once inside the "Issuer" card). Now company info appears **only** inside the card.

### 17.6 Print Consistency

- Print always reflects the current database state
- DRAFT invoices print with "BROUILLON" watermark
- CANCELLED invoices print with "ANNULÉ" watermark
- PAID invoices show payment stamp

---

## 18. Arabic, French, English, and RTL

### 18.1 Translation Strategy

- All UI strings use `next-intl` with dictionaries in `src/i18n/dictionaries.ts`
- Invoice-specific keys already exist: `documentsUI.fieldCustomer`, `documentsUI.crmQuickInvoice`
- Status translations: `status.UNPAID`, `status.PARTIAL`, `status.PAID`, `status.OVERDUE`
- Document labels: `config.label` (French), `config.labelAr` (Arabic)

### 18.2 RTL Support

- Arabic is the primary RTL language
- The UI framework supports RTL via `dir="rtl"` on the HTML element
- Print templates handle RTL via locale-aware formatting
- Date formatting: `formatDate(date, "ar-DZ")` for Arabic, `formatDate(date, "fr")` for French

### 18.3 Mixed Content

- Invoice numbers are always LTR (e.g., "FA-2026-0001")
- Customer names can be Arabic or French
- Product descriptions can be bilingual
- The print template handles mixed-direction text

### 18.4 Localized Dates and Numbers

- Dates: `formatDate()` from `@/lib/format` handles locale-aware formatting
- Numbers: `formatAmount()` handles locale-aware number formatting (Arabic numerals vs Western)
- Currency: Always "DZD" for Algerian companies

### 18.5 Print Typography

- Arabic: Noto Sans Arabic or similar
- French: System font stack
- The print template uses CSS `@media print` for consistent rendering

---

## 19. Algerian Tax and Commercial Boundaries

### 19.1 TAP (Taxe sur l'Activité Professionnelle)

- **Rate**: 1% (merchandise) or 2% (services)
- **Applied to**: Total HT
- **Computed by**: `computeDzTaxes()` in `dz-tax.ts`
- **Stored on**: Invoice.tapRate, Invoice.tapAmount
- **Configurable**: Via `meta.tapRate` on the invoice
- **Exemption**: `tapRate = 0` for exempt customers/products

### 19.2 Timbre Fiscal

- **Rate**: 1% of TTC
- **Min**: 100 DZD
- **Max**: 10,000 DZD
- **Condition**: ONLY for cash payments (espèces)
- **Computed by**: `computeDzTaxes()` in `dz-tax.ts`
- **Stored on**: Invoice.stampAmount
- **Configurable**: Via `meta.hasCashPayment` on the invoice

### 19.3 TVA (VAT)

- **Rates**: 19% (standard), 9% (reduced), 0% (exempt)
- **Computed per line**: quantity × unitPrice × (1 - discountPct/100) × taxPct/100
- **Stored on**: InvoiceLine.amountTva, Invoice.totalTva
- **Legal point**: CONFIRMED for project configuration; REQUIRES_VERIFICATION for legal accuracy

### 19.4 Total Due Computation

```
totalDue = totalTtc + tapAmount + stampAmount
```

This is stored on `Invoice.totalDue` and is the amount the customer must pay.

### 19.5 Accounting Boundary

Phase 7.5A does NOT implement:
- Tax declaration/reporting
- TVA filing
- Tax payment tracking
- Legal document formatting (beyond print)

These are Phase 8+ concerns.

---

## 20. Future Accounting Integration Boundaries

### 20.1 What Phase 7.5A Does NOT Implement

| Component | Status | Phase |
|-----------|--------|-------|
| Journal entry on invoice finalization | EXISTS (workflow.ts:56-69) | Done |
| Journal entry on payment | EXISTS (finance/service.ts:222) | Done |
| Chart of accounts | EXISTS (finance/service.ts:332) | Done |
| Fiscal period management | EXISTS (finance/service.ts:539) | Done |
| Tax declaration | NOT IMPLEMENTED | Phase 8+ |
| Accounts receivable aging | NOT IMPLEMENTED | Phase 8+ |
| Payment reconciliation | NOT IMPLEMENTED | Phase 8+ |
| Bank statement import | NOT IMPLEMENTED | Phase 8+ |
| Financial statements | NOT IMPLEMENTED | Phase 8+ |

### 20.2 Accounting Integration Points (Already Working)

```
Invoice APPROVED → postDocumentToJournal() → JournalEntry (Dr 411, Cr 701, Cr 708)
Payment registered → postPaymentJournalEntry() → JournalEntry (Dr 512, Cr 411)
```

### 20.3 Boundary Definition

**Invoice is a commercial document.** It creates a financial obligation (accounts receivable) but does NOT manage the general ledger. The accounting integration is:

1. **Invoice finalization** → journal entry (recognition of revenue)
2. **Payment registration** → journal entry (cash movement)
3. **Credit note** → journal entry (reversal of revenue) — future

Phase 7.5A ensures the commercial layer correctly feeds the accounting layer. It does NOT modify the accounting layer.

---

## 21. Database and Migration Impact

### 21.1 What Already Exists (No Migration Needed)

| Model | Fields | Status |
|-------|--------|--------|
| Invoice | All fields including dueDate, paidAmount, paymentStatus, tapAmount, stampAmount, totalDue | Complete |
| InvoiceLine | Standard line fields | Complete |
| CreditNote | Including invoiceId FK | Complete (FK not wired) |
| CreditNoteLine | Standard line fields | Complete |
| SupplierInvoice | Including paidAmount, paymentStatus, dueDate | Complete |
| SupplierInvoiceLine | Standard line fields | Complete |
| Payment | Full payment model | Complete |
| PaymentAllocation | Links payments to invoices | Complete |
| PaymentStatus | UNPAID, PARTIAL, PAID, OVERDUE | Complete |
| DocumentRelation | Including CREDIT type | Complete |
| DocumentSeries | INVOICE prefix "FA" | Complete |

### 21.2 Proposed Schema Changes (Implementation Phase)

| Change | Reason | Risk |
|--------|--------|------|
| Add `dueDate` to `InputDocument` type | Editor needs to send dueDate | None — type-only change |
| Add `dueDate` to `buildPayload()` | Editor needs to include dueDate | None — UI-only change |
| Add `defaultPaymentDays` to Company settings | Configurable payment terms | Low — new setting |
| Fix config.ts `numberPrefix: "FA"` | Consistency with seed | None — config-only change |
| Add `invoices` to nav-config.ts | Navigation discovery | None — UI-only change |
| Wire `CreditNote.invoiceId` in convertGeneric | Traceability | Low — service-only change |

### 21.3 Data Migration Considerations

- Existing invoices have `dueDate = null` and `paymentStatus = UNPAID` (correct for existing data)
- No backfill needed — existing invoices are historical
- New invoices will have dueDate populated at creation

### 21.4 Rollout Risks

- **Low risk**: All proposed changes are additive (new fields, new UI elements)
- **No breaking changes**: Existing document engine behavior is preserved
- **No data loss**: No fields are removed or renamed

---

## 22. API Contracts

### 22.1 Create Invoice (Direct)

```
POST /api/documents
Authorization: documents.create + ventes.facture.create
Body: {
  type: "INVOICE",
  branchId: string,
  customerId: string,
  clientId?: string,
  issuedById?: string,
  currency?: "DZD",
  exchangeRate?: number,
  notes?: string,
  dueDate?: string,          // NEW: ISO date string
  meta?: {
    tapRate?: number,
    hasCashPayment?: boolean
  },
  lines: [{
    kind?: "PRODUCT" | "SERVICE",
    productId?: string,
    label: string,
    unit?: string,
    quantity?: number,
    unitPrice?: number,
    discountPct?: number,
    taxPct?: number
  }]
}
Response: { id, number, status: "DRAFT", ... }
```

### 22.2 Create Invoice (Conversion)

```
POST /api/documents/convert
Authorization: documents.convert + ventes.facture.create
Body: {
  sourceDocType: "QUOTATION" | "SALES_ORDER" | "DELIVERY_NOTE",
  sourceDocId: string,
  targetDocType: "INVOICE",
  conversionRate?: number,
  description?: string
}
Response: { relationId, sourceNumber }
```

### 22.3 Read Invoice

```
GET /api/documents/[id]?type=INVOICE
Authorization: documents.read + ventes.facture.view
Response: {
  id, number, status, dueDate, issuedAt,
  paidAmount, paymentStatus, totalDue,
  tapAmount, stampAmount, tapRate,
  customerId, branchId, currency,
  totalHt, totalTva, totalTtc,
  lines: [...], customer: {...}, branch: {...}
}
```

### 22.4 List Invoices

```
GET /api/documents?type=INVOICE&page=1&pageSize=20&status=DRAFT&search=FA-2026
Authorization: documents.read + ventes.facture.view
Response: { items: [...], total, page, pageSize }
```

### 22.5 Update Invoice (DRAFT only)

```
PATCH /api/documents/[id]?type=INVOICE
Authorization: documents.update + ventes.facture.create
Body: {
  branchId?: string,
  customerId?: string,
  dueDate?: string,          // NEW
  notes?: string,
  lines?: [...]
}
Precondition: status === "DRAFT"
Response: { id, number, status, ... }
```

### 22.6 Transition Status

```
PATCH /api/documents/[id]/status?docType=INVOICE
Authorization: documents.approve (for APPROVED)
Body: { targetStatus: "PENDING_APPROVAL" | "APPROVED" | "CANCELLED" }
Response: { success: true }
Side effect: On APPROVED → journal entry posted
```

### 22.7 Register Payment

```
POST /api/finance/payments
Authorization: finance.payment.create
Body: {
  direction: "RECEIVED",
  partyKind: "CUSTOMER",
  customerId: string,
  methodId?: string,
  reference?: string,
  paidAt?: string,
  amount: number,
  currency?: "DZD",
  notes?: string,
  allocations: [{
    invoiceId: string,
    amount: number
  }]
}
Response: { paymentId, number, amount }
Side effect: Invoice.paidAmount and paymentStatus updated
```

### 22.8 Error Categories

| Code | HTTP | Meaning |
|------|------|---------|
| NOT_FOUND | 404 | Invoice doesn't exist |
| FORBIDDEN | 403 | Cross-company access attempt |
| NOT_DRAFT | 422 | Non-DRAFT invoice cannot be modified |
| INVALID_STATUS_TRANSITION | 422 | Status transition not allowed |
| ALREADY_CONVERTED | 409 | Source already converted to target |
| OVER_INVOICE | 422 | Quantity exceeds remaining (future) |
| INVALID_CONVERSION | 422 | Conversion pair not allowed |

---

## 23. UI Requirements

### 23.1 Invoice List

- Paginated table with columns: Number, Customer, Date, Due Date, Total TTC, Paid Amount, Payment Status, Document Status, Actions
- Filters: status, paymentStatus, customer, date range, search by number
- Sort: by number, date, dueDate, totalTtc, paymentStatus
- Bulk actions: none (invoices are individual financial documents)

### 23.2 Status Visualization

- `DRAFT`: Gray badge
- `PENDING_APPROVAL`: Yellow badge
- `APPROVED`: Blue badge
- `CONFIRMED`: Green badge
- `CANCELLED`: Red badge with strikethrough
- `REJECTED`: Red badge
- `ARCHIVED`: Gray badge with archive icon

Payment Status:
- `UNPAID`: Red dot
- `PARTIAL`: Yellow dot
- `PAID`: Green dot
- `OVERDUE`: Red pulsing dot

### 23.3 Create/Edit Workflow

- **Direct creation**: Quick-create button → Invoice editor with empty form
- **From quotation**: Quotation detail → "Convert to Invoice" button → Confirmation → Invoice created in DRAFT
- **From sales order**: SalesOrder detail → "Create Invoice" button → Confirmation → Invoice created in DRAFT
- **From delivery note**: DeliveryNote detail → "Create Invoice" button → Confirmation → Invoice created in DRAFT
- **Edit**: Invoice list → click invoice → editor opens (DRAFT only)
- **Save**: Saves to DRAFT status

### 23.4 Detail View

- Header: number, status, dates, customer info
- Lines table: description, quantity, unit price, discount, TVA, amounts
- Totals section: HT, TVA, TAP, Timbre, TTC, Paid, Net Payable
- Payment section: payment status, payment history (allocations)
- Actions: Edit (DRAFT), Submit for approval, Approve, Cancel, Print, PDF, Convert to Credit Note

### 23.5 Payment Information

- Payment status badge (color-coded)
- Payment history table: date, method, reference, amount, allocation
- Outstanding balance display
- "Register Payment" button (opens payment form)

### 23.6 Outstanding Balance Display

- On customer detail page: total outstanding across all unpaid/partial invoices
- On invoice detail: remaining amount (totalTtc - paidAmount - creditNoteAmount)
- On dashboard: summary of pending invoices and upcoming payments

### 23.7 Print/PDF Actions

- "Print" button: opens print preview
- "Download PDF" button: generates and downloads PDF
- Both respect company branding (logo, stamp, signature, colors)

### 23.8 Permission-Aware UI

- Create button: visible only if `ventes.facture.create`
- Approve button: visible only if `ventes.facture.manage`
- Print button: visible only if `ventes.facture.view`
- Payment button: visible only if `finance.payment.create`
- Edit button: visible only if `ventes.facture.create` AND status === DRAFT

### 23.9 Localization

- All labels translated (FR/AR/EN)
- Date format: locale-aware
- Number format: locale-aware
- RTL layout for Arabic

### 23.10 Mobile/Responsive

- Invoice list: responsive table (cards on mobile)
- Invoice editor: responsive form (stacked fields on mobile)
- Print: A4 layout (not optimized for mobile printing)

---

## 24. Acceptance Criteria and Verification Plan

### 24.1 Functional Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| F-01 | Invoice can be created directly in DRAFT status | Integration test |
| F-02 | Invoice can be created from Quotation via conversion | Integration test |
| F-03 | Invoice can be created from Sales Order via conversion | Integration test |
| F-04 | Invoice can be created from Delivery Note via conversion | Integration test |
| F-05 | Double conversion from same source is prevented (ALREADY_CONVERTED) | Integration test |
| F-06 | Invoice lines are correctly computed (HT, TVA, TTC) | Unit test (calculation.ts) |
| F-07 | TAP is computed correctly (1%/2%/0%) | Unit test (dz-tax.ts) |
| F-08 | Timbre fiscal is computed correctly (1% TTC, min/max, cash only) | Unit test (dz-tax.ts) |
| F-09 | dueDate is set at invoice creation (from company default) | Integration test |
| F-10 | dueDate can be overridden in editor (DRAFT only) | Manual verification |
| F-11 | Invoice can be submitted for approval (DRAFT → PENDING_APPROVAL) | Integration test |
| F-12 | Invoice can be approved (PENDING_APPROVAL → APPROVED) | Integration test |
| F-13 | Journal entry is posted on APPROVED | Integration test (verify-phase81) |
| F-14 | Journal entry is idempotent (no duplicates) | Integration test (verify-phase81) |
| F-15 | Non-DRAFT invoice cannot be modified | Integration test |
| F-16 | Invoice can be cancelled | Integration test |
| F-17 | Payment can be registered against invoice | Integration test (verify-phase8) |
| F-18 | Partial payment correctly sets paymentStatus to PARTIAL | Integration test (verify-phase8) |
| F-19 | Full payment correctly sets paymentStatus to PAID | Integration test (verify-phase8) |
| F-20 | Multiple payments to same invoice work correctly | Integration test |
| F-21 | CreditNote can be created from Invoice | Integration test |
| F-22 | CreditNote.invoiceId is set during conversion | Integration test |
| F-23 | Customer outstanding balance is correctly derived | Integration test |
| F-24 | Invoice number is unique per company | Integration test |
| F-25 | Invoice number format is FA-YYYY-NNNN | Manual verification |
| F-26 | OVERDUE detection works (dueDate < now) | Integration test or manual |
| F-27 | Invoice print includes payment info | Manual verification |
| F-28 | Invoice PDF is generated correctly | Manual verification |

### 24.2 Security Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| S-01 | Cross-company invoice access is blocked | Integration test (verify-isolation) |
| S-02 | Unauthorized users cannot create invoices | Integration test |
| S-03 | Unauthorized users cannot approve invoices | Integration test |
| S-04 | Payment registration requires finance.payment.create | Integration test |
| S-05 | Invoice CRUD requires appropriate documents.* permissions | Code review |
| S-06 | SUPER_ADMIN can access any company's invoices | Manual verification |

### 24.3 Data Integrity Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| D-01 | Invoice totals match line computations | Unit test |
| D-02 | paidAmount is derived from allocations (never manual) | Code review |
| D-03 | paymentStatus is derived (never manual) | Code review |
| D-04 | CreditNote.totalTtc <= Invoice.totalTtc (validation) | Integration test |
| D-05 | No orphaned InvoiceLine records (cascade delete) | Schema verification |
| D-06 | DocumentRelation uniqueness is enforced | Integration test |
| D-07 | Concurrent conversions are prevented | Integration test |

### 24.4 Localization and Print Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| L-01 | Invoice UI displays in French | Manual verification |
| L-02 | Invoice UI displays in Arabic (RTL) | Manual verification |
| L-03 | Invoice UI displays in English | Manual verification |
| L-04 | Print template renders in French | Manual verification |
| L-05 | Print template renders in Arabic | Manual verification |
| L-06 | PDF is generated with correct layout | Manual verification |
| L-07 | Due date is displayed on print | Manual verification |
| L-08 | Payment status is displayed on print | Manual verification |

### 24.5 Regression Protection

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| R-01 | Quotation creation/editing still works | Existing tests + manual |
| R-02 | Quotation → Sales Order conversion works | Existing tests + manual |
| R-03 | Quotation → Invoice conversion works | Integration test |
| R-04 | Sales Order creation/editing still works | Existing tests + manual |
| R-05 | Sales Order → Delivery Note conversion works | Existing tests + manual |
| R-06 | Sales Order → Invoice conversion works | Integration test |
| R-07 | Delivery Note creation still works | Existing tests + manual |
| R-08 | Delivery Note → Invoice conversion works | Integration test |
| R-09 | Document Engine generic CRUD works | Existing tests |
| R-10 | Document Engine status transitions work | Existing tests |
| R-11 | Document Engine approval workflow works | Existing tests |
| R-12 | Payment registration still works | verify-phase8 |
| R-13 | Invoice journal posting still works | verify-phase81 |
| R-14 | Company scope isolation still works | verify-company-scope |
| R-15 | RBAC enforcement still works | verify-rbac-two-roles |
| R-16 | Dashboard queries still work | Manual verification |

### 24.6 Implementation Sequencing

| Phase | Description | Dependencies |
|-------|-------------|-------------|
| 7.5B-1 | dueDate: add to InputDocument, buildPayload, editor | None |
| 7.5B-2 | dueDate: default computation from company settings | 7.5B-1 |
| 7.5B-3 | CreditNote.invoiceId: wire in convertGeneric | None |
| 7.5B-4 | Numbering: fix config.ts prefix to "FA" | None |
| 7.5B-5 | Navigation: add Invoice to nav-config.ts | None |
| 7.5B-6 | OVERDUE: implement periodic recomputation | 7.5B-2 |
| 7.5B-7 | Customer balance: implement real-time derivation | None |
| 7.5B-8 | Permission alignment: enforce ventes.facture.* at API level | None |
| 7.5B-9 | Print verification: confirm payment info renders correctly | 7.5B-1 |
| 7.5B-10 | Regression testing: run all verify-* scripts | All above |

### 24.7 STOP Conditions (Implementation Phase)

The following changes are **BLOCKED** and must not be implemented in Phase 7.5:

| Blocked Change | Reason |
|----------------|--------|
| New Prisma model for payments | Payment model already exists |
| New accounting engine | Accounting integration already exists |
| Modifications to Quotation behavior | Protected module |
| Modifications to Sales Order behavior | Protected module |
| Modifications to Delivery Note behavior | Protected module |
| Modifications to Document Engine core | Protected — extend, don't modify |
| Company scope architecture changes | Protected |
| RBAC architecture changes | Protected |
| SUPER_ADMIN behavior changes | Protected |
| Payment architecture redesign | Existing architecture is correct |

### 24.8 Final Integrity Check

Before implementation begins, verify:

- [ ] No application code was changed during Phase 7.5A
- [ ] No existing behavior was modified
- [ ] No Prisma schema was modified
- [ ] No migration was created or applied
- [ ] No payment architecture was duplicated
- [ ] No accounting integration was implemented
- [ ] No commit was created
- [ ] No push was performed
- [ ] Existing uncommitted working-tree changes were left untouched

---

## Final Recommendation

**Design Readiness Status**: Ready for implementation with explicit prerequisites.

Phase 7.5A has identified that the Invoice infrastructure is **substantially more complete** than the initial audit suggested. The payment subsystem, accounting integration, print pipeline, and tax computation all exist and are functional. The gaps are integration seams — dueDate population, CreditNote.invoiceId wiring, permission alignment, navigation, and OVERDUE detection — not missing architecture.

The implementation should follow the sequencing in Section 24.6, starting with the lowest-risk, highest-value changes (dueDate, numbering fix, navigation) before moving to integration concerns (OVERDUE, balance, permissions).

**STOP — Phase 7.5A Invoice Design Gate complete.**
