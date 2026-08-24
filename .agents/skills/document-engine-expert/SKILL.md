---
name: document-engine-expert
description: Expert on the DzERP Document Engine: the 9 document types, the status lifecycle, transition maps, conversions, numbering (DocumentSeries), validation, and the engine's framework for API/UI/PDF. Use when implementing, modifying, or debugging any commercial document type, status transition, numbering, or document conversion. NEVER bypass the engine.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Document Engine Expert

## Purpose

Give the complete picture of the DzERP Document Engine so agents use it
correctly, extend it safely, and never bypass its invariants.

## Scope

- Document types and their models.
- Status enum and transition maps.
- Conversion rules between documents.
- Numbering (`DocumentSeries`).
- Validation and calculation of documents.
- The engine's supporting framework (API, UI config, PDF, status meta).

## The 9 Document Types (CONFIRMED — `prisma/schema.prisma`, `DocType` enum)

`DocType` enum includes: QUOTATION, SALES_ORDER, DELIVERY_NOTE, INVOICE,
CREDIT_NOTE, PURCHASE_REQUEST, PURCHASE_ORDER, GOODS_RECEIPT,
SUPPLIER_INVOICE (plus CUSTOMER, SUPPLIER, PRODUCT, WAREHOUSE,
INVENTORY_MOVEMENT which are identifiers, not document types).

Models (all company-scoped, all with totals and status):
Quotation, SalesOrder, DeliveryNote, Invoice, CreditNote, PurchaseRequest,
PurchaseOrder, GoodsReceipt, SupplierInvoice.

Chain (sales): Quotation → SalesOrder → DeliveryNote → Invoice.
Chain (purchasing): PurchaseRequest → PurchaseOrder → GoodsReceipt →
SupplierInvoice.

## Engine Directory Map (CONFIRMED — `src/features/documents/engine/`)

| File | Responsibility |
| --- | --- |
| `types.ts` | Shared document types, DTOs |
| `index.ts` | Public engine exports |
| `config.ts` | Transition maps (SALES_TRANSITIONS, PURCHASING_TRANSITIONS), engine config, labels |
| `status.ts` | `assertTransition`, `getDefaultStatus`, `canApprove`, `canCancel`, `isActive`, `isTerminal` |
| `workflow.ts` | `transitionStatus`, `approveDocument` — enforce transitions + audit + activity |
| `conversion.ts` | Document→document conversions (quote→order, order→delivery, etc.) |
| `validation.ts` | Server-side line/document validation |
| `calculation.ts` | Totals: `totalHt`, `totalTva`, `totalTtc` from lines |
| `resolve.ts` | Resolver helpers (load document + lines) |
| `service.ts` | Document creation/update orchestration (validates, computes, numbers) |

Supporting framework — `src/features/documents/framework/`:
`api.ts` (route helpers/guards), `index.ts`, `normalize.ts`,
`status-meta.ts` (status labels/meta per document), `ui-config.ts`,
`ui-types.ts`.

## Status Lifecycle (CONFIRMED — `DocumentStatus` enum + `config.ts`)

`DocumentStatus` enum: DRAFT, PENDING, VALIDATED, REJECTED, CANCELLED,
ARCHIVED, PENDING_APPROVAL, APPROVED, CONFIRMED, PARTIALLY_PROCESSED,
PROCESSED, CLOSED.

Sales/purchasing transition maps (config.ts):
- `DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED →
  PARTIALLY_PROCESSED / PROCESSED → CLOSED`.
- REJECTED / CANCELLED are terminal from non-terminal states.
- `VALIDATED` and `ARCHIVED` exist; their exact roles depend on document type —
  read `config.ts` and `status.ts` for the current map.

**Rules to enforce (CONFIRMED):**
- The ONLY way to change a status is `transitionStatus` / `approveDocument`
  (`engine/workflow.ts`), which call `assertTransition` (`engine/status.ts`).
- Illegal transitions throw `INVALID_STATUS_TRANSITION` (HTTP 422).
- `transitionStatus` also records an `AuditLog` and an `ActivityEvent`
  (see `src/features/audit/service.ts`, `src/features/activity/service.ts`).
- Never set a status via a direct Prisma update.

## Conversions (CONFIRMED — `engine/conversion.ts`)

- Conversions copy base data (customer/supplier, lines, prices) and set the
  resulting document status + reference (`sourceDocumentId`/link fields).
- Line-level conversions must respect partial quantities (see
  commercial-expert Partial Delivery Rule).
- When adding a new conversion, it must: validate source state, create target,
  update source status, keep numbering and totals server-side, and record audit.

## Numbering — DocumentSeries (CONFIRMED — `src/features/documents/series.ts`)

- `DocumentSeries` model: `key`, `docType`, `prefix`, `separator`, `suffix`,
  `withYear`, `year`, `nextValue` (BigInt), `padLength`, `step`, `isActive`.
- Functions: `formatSeriesNumber` (compose the number from prefix/separator/
  suffix/year/padding), `pad`; preview functions do NOT increment.
- Numbering API: `src/app/api/series/route.ts`.
- Rules:
  - The server generates the number atomically at document creation
    (increment `nextValue`). Never let the client send a document number.
  - The number is unique per series; the series scopes to a company (and per
    docType/key). Changing a series config affects all future documents.
  - Do not reformat historical numbers.

## Validation & Calculation (CONFIRMED)

- `validation.ts`: server-side checks of lines (product exists, quantities >
  0, price ≥ 0, taxPct within allowed rates, references valid).
- `calculation.ts`: computes line amounts and totals with Decimal precision;
  `totalHt + totalTva = totalTtc` invariant.
- Any new document field that affects amounts MUST be wired through
  calculation + validation, not just the UI.

## How to Add a New Document Type (if ever required)

1. Audit the existing engine first (types, config, status, validation).
2. Follow the 12-layer evaluation (see dz-erp-domain).
3. Add model + relations in schema (requires a migration → database-auditor).
4. Register in: engine `types.ts`/`index.ts`, `config.ts` (transitions +
  labels), `status.ts` defaults, `framework/status-meta.ts`, `framework/ui-config.ts`.
5. Add conversion + validation + calculation wiring.
6. Add numbering via a `DocumentSeries` seed/config.
7. Add API route with guards (security-rbac-expert), UI pages, i18n (FR/AR/EN),
   PDF template, audit, tests.

## Existing DzERP Engine Rules (CONFIRMED by source)

- Engine is used by all 9 document features; do not copy/paste document logic
  outside the engine.
- Company/branch context is enforced by the company-scope Prisma extension;
  engine services run inside the ALS company context.
- `prismaBase` (global admin) must NOT be used for company document logic.

## Forbidden Assumptions

- Do NOT assume `VALIDATED` = `APPROVED`; check the map.
- Do NOT assume all documents share the same default status; use
  `getDefaultStatus`.
- Do NOT change a transition map without updating tests + docs.
- Do NOT create a numbering scheme different from DocumentSeries.
- Do NOT accept client-computed totals or numbers.

## STOP Conditions

- STOP before adding/removing a status or changing the enum.
- STOP before bypassing `transitionStatus`.
- STOP before changing numbering semantics or series schema.
- STOP before editing the engine for a feature that only needs a page.
- STOP if a conversion requires a source-status the engine does not allow.

## Examples

1. "Validate a quotation" → call `transitionStatus(quotation, VALIDATED)`; if
   the map doesn't allow it, report rather than force.
2. "New series 'BC-2026-0001'" → configure a DocumentSeries (prefix BC,
   year-based), let the service increment nextValue.
3. "Order → Delivery" → engine conversion + `remainingQty` + stock movement
   (inventory-expert) in one transaction.

## Interaction With Other Skills

- `commercial-expert`: business meaning of statuses/conversions.
- `inventory-expert`: stock integration points (delivery/receipt).
- `algerian-tax-expert`: invoice numbering is the legal number.
- `database-auditor`: any schema change to documents/series needs an audit.
- `security-rbac-expert`: approval/cancellation permission checks.
