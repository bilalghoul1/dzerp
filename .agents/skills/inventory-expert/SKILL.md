---
name: inventory-expert
description: Expert on inventory management in DzERP: warehouses, locations, inventory movements, quantity-on-hand, and the integration of stock with sales deliveries and purchase receipts. Use when implementing or reviewing stock movements, warehouse operations, product quantity logic, stock adjustments, transfers, or any feature that changes or displays product quantities.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Inventory Expert (Expert Stock)

## Purpose

Define how inventory works in DzERP: where stock lives, how movements are
recorded, how quantities are kept consistent with commercial documents, and
what is safe to change versus what requires an audit.

## Scope

- `Warehouse`, `WarehouseLocation` (model, company/branch scoping).
- `InventoryMovement` and `InventoryMovementType`.
- Product quantity on hand (`Product` fields, e.g. `stockQty`/quantity helpers).
- Integration with Delivery Note (stock out) and Goods Receipt (stock in).
- Stock adjustments, transfers, opening/closing balances, counts.
- Cost/valuation (future — see accounting-expert).

Out of scope: commercial documents statuses (commercial-expert), journal
posting of stock value (accounting-expert), tax on stock (algerian-tax-expert).

## Inventory Model (CONFIRMED schema — `prisma/schema.prisma`)

- `Warehouse`: company- and branch-scoped; physical storage locations.
- `WarehouseLocation`: belongs to a `Warehouse`; finer-grained storage.
- `InventoryMovement`: every stock change is a recorded movement. It is
  **company-scoped** (strict model in `COMPANY_SCOPED_MODELS`).
- `InventoryMovementType` enum: PURCHASE, SALE, TRANSFER_IN, TRANSFER_OUT,
  ADJUSTMENT, PRODUCTION, CONSUMPTION, RETURN_IN, RETURN_OUT,
  INVENTORY_COUNT, OPENING_BALANCE, CLOSING_BALANCE.
- Products are soft-deletable and company-scoped; quantities live on the
  product or are derived from movements — verify in the product model/helpers
  before relying on any single field.

## Movement Rules (CONFIRMED engine/service behavior)

- **Every quantity change is a movement.** Never mutate a product's quantity
  field directly without an `InventoryMovement` record (audit trail
  requirement). If a current code path bypasses this, flag it.
- Movement types are directional:
  - Inbound: PURCHASE (Goods Receipt), RETURN_IN, PRODUCTION, TRANSFER_IN,
    OPENING_BALANCE, ADJUSTMENT(+), INVENTORY_COUNT(+).
  - Outbound: SALE (Delivery Note), RETURN_OUT, CONSUMPTION, TRANSFER_OUT,
    CLOSING_BALANCE, ADJUSTMENT(-), INVENTORY_COUNT(-).
- Delivery Note lines decrease stock; Goods Receipt lines increase stock.
  These are the two commercial integration points. Quantities must be Decimal
  and updated in a transaction together with the document's
  `remainingQty`/status logic (see commercial-expert Partial Delivery Rule).
- Transfers: `TRANSFER_OUT` from source warehouse + `TRANSFER_IN` to target
  warehouse must be recorded as a pair (same quantities, same timestamps),
  ideally in one transaction.
- Stock must never go negative (validation in the service layer; if a code
  path allows negative stock, treat as a bug and stop).

## Where Inventory Logic Lives (CONFIRMED file locations)

- Movement service: `src/features/inventory/` (movement creation, quantity
  updates, transfer logic). The exact service names are confirmed in this
  directory — read `src/features/inventory/` before writing stock code.
- Document integration: `src/features/documents/engine/service.ts` and
  `src/features/delivery-note/` (stock out on delivery),
  `src/features/goods-receipt/` (stock in on receipt).
- Isolation: `InventoryMovement` and `Warehouse` are in
  `COMPANY_SCOPED_MODELS` (`src/lib/db/company-scope.ts`).

## Valuation & COGS (ASSUMPTION — design guidance)

- No costing method (FIFO, weighted average, standard cost) is implemented.
  Stock value reporting is not implemented.
- When asked to report "stock value" or "COGS", do NOT invent a cost basis.
  Return a movement/quantity report and mark the value as `REQUIRES_VERIFICATION`.
- Cost fields on products (if any exist) are recorded costs; their use for
  accounting requires the accounting module (accounting-expert).

## Existing DzERP Inventory Rules (CONFIRMED by source)

- All inventory queries go through the company-scoped Prisma client; the ALS
  (AsyncLocalStorage) company context filters automatically.
- Global (platform) inventory aggregation must use `prismaBase` (see
  `src/lib/prisma.ts`) and must not leak company data across tenants.
- Soft-deleted products/warehouses are excluded from queries automatically
  (soft-delete extension).

## Forbidden Assumptions

- Do NOT assume FIFO/weighted-average exists.
- Do NOT assume stock is updated when an order is validated (only on
  delivery/receipt unless documented otherwise).
- Do NOT assume a single "quantity" field is the source of truth — verify
  against movement logic first.
- Do NOT use floats for quantities.
- Do NOT allow negative stock without a documented, authorized rule.
- Do NOT create an InventoryMovement without a company context (strict model).

## STOP Conditions

- STOP if a feature implies a new movement type not in the enum.
- STOP if asked to implement stock valuation without a documented method.
- STOP if a schema change to inventory models is needed.
- STOP if stock and document quantities could diverge (e.g. delivery and
  movement not in the same transaction).

## Examples

1. "Delivery of 5 units" → transaction: create/complete Delivery Note,
   decrement stock via `SALE` movements, decrement `SalesOrderLine.remainingQty`.
2. "Transfer between warehouses" → pair of `TRANSFER_OUT` + `TRANSFER_IN`
   movements in one transaction.
3. "Report current stock" → sum of movements per product/warehouse (or the
   derived quantity helper), company-scoped, Decimal-safe.

## Interaction With Other Skills

- `commercial-expert`: delivery/goods-receipt integration and `remainingQty`.
- `accounting-expert`: stock valuation/COGS only when the accounting module is
  designed.
- `algerian-tax-expert`: imported/exported goods and stock-related tax events.
- `database-auditor`: Decimal columns, unique constraints, transaction safety.
- `security-rbac-expert`: who may adjust stock; audit all adjustments.
