---
name: dz-erp-domain
description: Authoritative domain reference for DzERP, the Algerian multi-company ERP. Use BEFORE implementing or modifying any commercial, accounting, inventory, tax, invoicing, purchasing, or document workflow, and when asked about DzERP architecture, company isolation, RBAC, document engine, numbering, or protected modules. Load this skill first; it links to the specialist skills (commercial-expert, accounting-expert, inventory-expert, algerian-tax-expert, document-engine-expert, erp-architecture, database-auditor, security-rbac-expert).
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# DzERP — Global Domain Reference

DzERP is an Algerian ERP (ERP Algérien) built with Next.js (App Router) and
Prisma/PostgreSQL. It is **NOT a collection of independent CRUD pages**: it is
a business system in which CRM, Commercial Documents, Inventory, Billing,
Accounting and Reporting must remain logically consistent.

This skill is the entry point of the DzERP Domain Skill Pack. Read it before
any domain work, then load the specialist skill that matches the task.

## Purpose

Teach any agent:

1. What DzERP is and how the platform is structured.
2. How the current architecture works (files, layers, data flow).
3. What is a commercial transaction vs an accounting transaction.
4. How inventory interacts with sales and purchasing.
5. How Algerian tax concepts affect the domain.
6. How companies and branches are isolated (non-negotiable).
7. How RBAC works (server-side only).
8. How the Document Engine must be respected.
9. Which business rules are already implemented.
10. Which rules are assumptions and require verification.
11. Which operations are dangerous and require an audit first.
12. When the agent MUST STOP instead of guessing.

## Platform Model (CONFIRMED — schema `prisma/schema.prisma`)

| Concept | Reality in DzERP |
| --- | --- |
| Super Admin | User with the global `SUPER_ADMIN` role (`UserRole`), no company required. Manages platform administration (`/admin/**`, `/api/admin/**`). Never inherits into a company context. |
| Company | `Company` model (`companyId` on every business model). A company owns branches, customers, products, documents, stock. |
| Branch | `Branch` model, always `companyId`-scoped. Documents and stock movements carry `branchId`. |
| Company Admin / Manager / Reader | `Role` keys assigned per membership via `RoleAssignment` (active, optional `expiresAt`). |
| User | `User` model. Active status required to authenticate. |
| Membership | `UserCompany` — link user ↔ company (active, isDefault, defaultBranchId). |
| RoleAssignment | Grant of a company `Role` to a `UserCompany` membership; effective permissions derive from it. `PermissionSource = "RoleAssignment" | "UserRole" | "None"`. |
| Company isolation | Prisma client extension `companyScope` (see `src/lib/db/company-scope.ts`). Strict models are automatically filtered by the active company context. |
| Branch context | `CompanyContext.branch` (nullable = all branches). Branch is contextual, not a separate isolation boundary. |

Platform roles and company roles are **separate planes**:
`UserRole` = global platform roles (e.g. `SUPER_ADMIN`), `RoleAssignment` =
company-scoped roles. A `SUPER_ADMIN` has no company context by default; a
Company Admin never gains platform authority.

## Core ERP Domains

- **CRM**: Customers, Suppliers (models `Customer`, `Supplier`, `Client`).
- **Sales**: Quotation → Sales Order → Delivery Note → Invoice (future).
- **Purchasing**: Purchase Request → Purchase Order → Goods Receipt → Supplier Invoice.
- **Inventory**: `Warehouse`, `WarehouseLocation`, `InventoryMovement`, quantity on hand.
- **Commercial Documents**: the Document Engine (9 types, see document-engine-expert).
- **Accounting**: **NOT yet implemented** (no accounting tables in the schema). See accounting-expert.
- **Taxation**: TVA (VAT) via line `taxPct`, `VatCategory`, settings `tax.rates` (TVA 19/9/0 project defaults). See algerian-tax-expert.
- **Reporting**: Dashboard KPIs, platform analytics, audit log, activity timeline.
- **Printing/PDF**: `src/features/print/*` — PDF is a business document, not a UI screenshot.
- **Administration**: platform Control Center (`/admin/**`) reserved to SUPER_ADMIN.

## Commercial Flow (CONFIRMED)

```
Customer
   ↓
Quotation            (commercial offer — no inventory, no accounting)
   ↓
Sales Order          (customer commitment — reservation only if implemented)
   ↓
Delivery Note(s)     (physical delivery — stock decreases, partial deliveries allowed)
   ↓
Invoice              (billing obligation — accounting event, AUDIT BEFORE IMPLEMENTING)
   ↓
Payment              (settlement — NOT yet modeled in the schema)
   ↓
Accounting           (future domain)
```

One Sales Order may produce **multiple** Delivery Notes; over-delivery is
prevented atomically (see commercial-expert §Partial Delivery Rule).

## The 12-Layer Evaluation Rule (MANDATORY)

Never implement a feature only from the UI perspective. Every business feature
must be evaluated across all of:

1. Database (schema, decimals, unique, indexes)
2. Domain Service (logic lives server-side)
3. Authorization (permission key, server-side)
4. Company Isolation (companyId/branchId, fail-closed)
5. Numbering (DocumentSeries, server-side)
6. Workflow (status transitions, engine-enforced)
7. API (route + guard + validation + error codes)
8. UI (display/collect/basic validation only)
9. PDF/Print (business document fields)
10. i18n (FR / AR / EN + RTL)
11. Audit (AuditLog + ActivityEvent for sensitive ops)
12. Tests (service, API, authorization, isolation, smoke)

## Protected Modules (do NOT rewrite, do NOT refactor casually)

- Quotation
- Sales Order
- Delivery Note
- Document Engine (`src/features/documents/engine/**`, `framework/**`)
- Company isolation (`src/lib/db/company-scope.ts`, `src/lib/prisma.ts`)
- RBAC (`src/features/auth/**`, `src/features/company-admin/api.ts`)
- Numbering (`DocumentSeries`, `src/features/documents/series.ts`)
- PDF engine (`src/features/print/**`)
- Company administration (`src/features/company-admin/**`, `/admin/**`)

Any change touching these requires: 1) Audit, 2) Impact analysis,
3) Regression plan, 4) Explicit reason.

## Decision Format (before implementing any future feature)

## Domain classification
Commercial / Inventory / Accounting / Tax / Platform / Security

## Existing architecture
What already exists?

## Existing business rules
What rules are already implemented?

## New business rules
What rules are required?

## Dependencies
What modules are affected?

## Data impact
Does the schema change?

## Security impact
Does RBAC change?

## Company isolation impact
Does company scoping change?

## Document Engine impact
Does the existing engine need modification?

## Accounting impact
Does this create an accounting event?

## Tax impact
Does TVA/tax logic change?

## Risk
LOW / MEDIUM / HIGH / CRITICAL

## Decision
IMPLEMENT / AUDIT REQUIRED / STOP

## STOP Conditions (do not guess — report and wait)

STOP immediately if:
- a Prisma migration appears necessary
- an existing table must be changed
- an existing document workflow must be redesigned
- accounting rules are ambiguous
- Algerian tax/legal rules are ambiguous
- company isolation could be affected
- RBAC architecture must change
- an existing Document Engine invariant must change
- a numbering rule must change
- a production database modification is required
- a destructive operation is proposed
- two existing business rules conflict

## Forbidden Assumptions

- Do NOT assume Invoice behaves like Sales Order. Invoicing rules are not fully
  defined yet — audit first (see commercial-expert §Invoice Domain Rules).
- Do NOT assume Payments exist. There is no `Payment` model in the schema.
- Do NOT assume Accounting exists. There are no Journal/GL/Account tables.
- Do NOT invent Algerian legal requirements. Mark them `REQUIRES_VERIFICATION`.
- Do NOT trust client-provided totals, statuses, companyId, branchId, or userId.
- Do NOT add statuses casually: a status is a domain rule, not a UI label.

## Interaction With Other Skills

| Task | Skill |
| --- | --- |
| Any domain task | `dz-erp-domain` first |
| Commercial documents, conversions, statuses | `commercial-expert` |
| Accounting entries, GL, journals | `accounting-expert` |
| Stock, movements, warehouses | `inventory-expert` |
| TVA, NIF/NIS/RC/AI, tax fields | `algerian-tax-expert` |
| Adding/changing a document type or numbering | `document-engine-expert` |
| Where to start a change, layer order | `erp-architecture` |
| Schema changes, migrations, production safety | `database-auditor` |
| Permissions, sessions, isolation, audit | `security-rbac-expert` |
