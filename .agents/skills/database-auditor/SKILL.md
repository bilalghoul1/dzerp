---
name: database-auditor
description: Expert on the DzERP database: Prisma schema conventions, the two Prisma clients, soft delete, company scoping, Decimal precision, indexes, migrations and production safety. Use BEFORE any schema change, migration, raw SQL, or query that aggregates across companies, and when auditing data integrity or reviewing for SQL/leak risks.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Database Auditor

## Purpose

Guard the DzERP data layer: correct schema conventions, safe migrations,
Decimal discipline, company-isolation correctness, and clean audit/integrity
queries. This skill MUST be read before touching the database or writing
aggregation queries.

## Scope

- Prisma schema (`prisma/schema.prisma`) and model conventions.
- Migrations (`prisma/migrations`) — when they are allowed at all.
- The two Prisma clients and when each may be used.
- Decimal/BigInt precision rules.
- Soft-delete behavior.
- Company scoping and cross-company queries.
- Data integrity, indexes, unique constraints.
- Verification commands.

## Schema Conventions (CONFIRMED — `prisma/schema.prisma`)

- Every business model carries `companyId` (and, where relevant, `branchId`).
- Money fields are Prisma `Decimal` (e.g. `price`, `quantity`, `totalHt`,
  `totalTva`, `totalTtc`, `exchangeRate`, `remainingQty`).
- Sequence/counters that must be monotonic are `BigInt` (e.g.
  `DocumentSeries.nextValue`).
- Soft-deletable models have `deletedAt DateTime?` and are listed in
  `SOFT_DELETABLE_MODELS` (`src/lib/db/soft-delete.ts`): Client, Customer,
  Supplier, Product, Warehouse, Company.
- Enums are Prisma enums, not string columns (DocumentStatus, DocType,
  PaymentStatus, InventoryMovementType, etc.).
- Related documents reference each other by ID (e.g. `DeliveryNote.salesOrderId?`,
  source-document links); conversions keep both documents consistent.

## Decimal Rules (CRITICAL — CONFIRMED)

- All money/quantity math must use Prisma `Decimal` (decimal.js) semantics.
- Never convert money to JS `number` (float) for computation or comparison.
- Never store rounded floats; round only at display/PDF time.
- Sums: keep Decimal through aggregation (`_sum` on Decimal columns returns
  Decimal in Prisma; handle it as such).
- Do not use `Number(x)` on decimals in business logic.

## The Two Clients (CONFIRMED — `src/lib/prisma.ts`)

- `prisma` — extended (companyScope + softDelete). For all company logic.
- `prismaBase` — raw client. **Only** for platform/SUPER_ADMIN global
  aggregates. Never for company data in company flows.

## Migration Safety (MANDATORY process)

Migrations are high-risk. Before any migration:

1. Audit the impact (schema change cascades to services, engine, UI, i18n).
2. Confirm a migration is truly required.
3. Plan: new model vs column change vs data backfill; nullable-until-filled
   pattern for new required columns; no destructive steps on data you cannot
   restore.
4. Add a verification plan (scripts/verification + `prisma migrate status`).
5. If the change is to documents/engine/company-scope, get document-engine-expert
   and erp-architecture review.

This skill pack itself creates NO migrations (0 migrations, always).

## Company Scoping (CONFIRMED — `src/lib/db/company-scope.ts`)

- `COMPANY_SCOPED_MODELS` (strict): Branch, DocumentSeries, DocumentApproval,
  Customer, Supplier, Product, ProductCategory, Brand, Manufacturer, Warehouse,
  InventoryMovement, Quotation, SalesOrder, DeliveryNote, Invoice, CreditNote,
  PurchaseRequest, PurchaseOrder, GoodsReceipt, SupplierInvoice,
  DocumentRelation, FileAsset.
- `COMPANY_OPTIONAL_MODELS`: AuditLog, ActivityEvent.
- Strict models fail-closed if queried outside a company context. This caused a
  real SSR regression in the past (Phase 7.5) — a component must never query a
  strict model without the company context.
- Cross-company reporting MUST use `prismaBase` with explicit filters, and
  NEVER expose per-company rows to a non-super user.

## Audit & Integrity Queries (CONFIRMED — `src/features/audit/service.ts`)

- Sensitive operations write an `AuditLog` entry (actor, company, action, ip,
  userAgent) — see the audit service; audit data is company-optional-scoped.
- Use audit/activity data for platform health checks (`getPlatformHealth`),
  backup stats (`getDatabaseBackupStats`), and admin analytics
  (`getPlatformAnalytics`) — all in `src/features/company-admin/service.ts`,
  all via `prismaBase` and SUPER_ADMIN-only.

## Common Pitfalls to Reject

- Float money math.
- Adding a required column without a default/backfill.
- Altering a document engine table without engine review.
- Querying a strict model outside company context.
- Using `prismaBase` in company flows.
- Deleting (hard) a row that is referenced by documents (use soft delete).
- Reordering/renaming enum values (breaks stored data).

## Forbidden Assumptions

- Do NOT assume the database is empty or seeded — verify.
- Do NOT assume an index exists on a foreign key unless the schema shows it.
- Do NOT assume `deletedAt` models are auto-filtered outside the extension.
- Do NOT assume a migration is "safe" because it only adds a column.

## STOP Conditions

- STOP before ANY migration without the process above.
- STOP before modifying the Prisma client stack.
- STOP before touching a table referenced by the Document Engine.
- STOP before raw SQL on company data.
- STOP if a data fix requires editing rows directly in production.

## Verification Commands (run before/after DB work)

- `npx prisma validate` — schema validity.
- `npx prisma migrate status` — migrations applied/pending (currently 20,
  up-to-date).
- `npx prisma generate` — regenerate client after schema changes.
- Project verification scripts under `scripts/` (e.g. `verify:phase75*` npm
  scripts) — regression gates.

## Examples

1. "Add product expiry date" → nullable column, backfill none, update
   validation/service/UI/i18n, then migration + tests.
2. "Sum invoices per company" → company-scoped query via `prisma`; platform
   total via `prismaBase` SUPER_ADMIN-only.
3. "Check orphaned DeliveryNotes" → read-only audit query, company-scoped,
   report anomalies; do not delete.

## Interaction With Other Skills

- `erp-architecture`: the client stack and 12 layers.
- `document-engine-expert`: engine tables must not break.
- `commercial-expert` / `inventory-expert`: decimal fields and quantity rules.
- `algerian-tax-expert`: precision of tax columns.
- `security-rbac-expert`: who may run admin/audit queries.
