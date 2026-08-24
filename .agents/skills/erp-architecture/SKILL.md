---
name: erp-architecture
description: Expert on the DzERP architecture: Next.js App Router layout, feature-first structure, the Prisma client stack (companyScope + softDelete extensions), company context resolution (CompanyContext), server vs client boundaries, i18n, and the 12-layer implementation order. Use when deciding where a change lives, planning a new feature, or reviewing that a feature follows the architecture.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# ERP Architecture Expert

## Purpose

Describe how DzERP is organized so agents place code in the right layer, follow
the App Router conventions, respect server/client boundaries, and never break
the company-isolation or RBAC invariants.

## Scope

- Directory layout and feature-first structure.
- Next.js App Router usage (this repo uses a customized Next.js — read the
  relevant guide in `node_modules/next/dist/docs/` before writing app code).
- Prisma client stack and the two clients (`prisma` vs `prismaBase`).
- Company context resolution (`CompanyContext`) and its propagation.
- Server components vs client components and i18n (FR/AR/EN + RTL).
- The 12-layer implementation order.

## Directory Structure (CONFIRMED)

```
src/
  app/              # App Router routes (page.tsx, layout.tsx, api/**/route.ts)
  components/       # Shared UI components
  features/
    <feature>/      # Feature-first modules: service.ts, api.ts, types.ts, schemas.ts, ...
    auth/           # Authentication, sessions, permissions, RBAC
    company/        # Company context, membership, branches, roles
    company-admin/  # SUPER_ADMIN platform control center (settings, users, audit)
    documents/      # Document Engine + per-document features (quotation, sales-order, ...)
    inventory/      # Warehouses, movements
    print/          # PDF generation
    audit/          # AuditLog recording
    activity/       # ActivityEvent timeline
    ...
  lib/              # Cross-cutting: db/ (prisma, scopes), utils, ...
  generated/        # Generated Prisma client
docs/               # Phase docs, audit reports
scripts/            # Verification scripts
```

Rules:
- Feature code lives in `src/features/<feature>/`; a feature owns its service,
  types, validation, API helpers. Pages in `src/app/` are thin.
- Domain logic must live in services (server), never in components.
- Everything user-facing must be i18n'd: FR (default), AR (RTL), EN.
- See the project's `AGENTS.md` — this is a customized Next.js; consult
  `node_modules/next/dist/docs/` before writing App Router code.

## Prisma Client Stack (CONFIRMED — `src/lib/prisma.ts`)

- `prisma` = `baseClient.$extends(companyScopeExtension).$extends(softDeleteExtension)`.
  Used for ALL company business logic.
  - `companyScope` (`src/lib/db/company-scope.ts`): automatically filters
    strict models by the active company context (AsyncLocalStorage).
  - `softDelete` (`src/lib/db/soft-delete.ts`): filters `deletedAt: null` on
    soft-deletable models and converts `delete` to a soft update.
- `prismaBase` = the raw, unextended client, documented **for global admin**:
  reading platform-wide aggregates (e.g. SUPER_ADMIN analytics) that must
  bypass the company context.
- Rules:
  - Company-scoped logic MUST use `prisma` and run inside the company context.
  - `prismaBase` MUST NOT be used to read/write company data in company flows.
  - Cross-tenant reads with `prismaBase` must never leak data (aggregates only,
    server-side, SUPER_ADMIN only).

## Company Context (CONFIRMED — `src/features/company/`)

- `CompanyContext` type (`src/features/company/types.ts`):
  `user`, `company`, `branch`, `companies`, `branches`, `permissions`,
  `roles`, `membership`, `roleAssignments`, `permissionSource`.
- Resolution: user → active company → active branch → membership → roles →
  permissions; resolved once per request (root layout or API), stored in the
  AsyncLocalStorage company context used by the Prisma extension.
- The current company is selected by the user (company switcher); the SSR
  layer builds the context from the session + cookie (see company provider /
  store / resolver files: `company-provider.tsx`, `store.ts`, `resolver.ts`,
  `helpers.ts`, `unscoped.ts`, `context.ts`).
- If a strict model is queried outside any company context, the client throws
  (fail-closed). This is a feature, not a bug.

## Server vs Client Boundaries (CONFIRMED pattern)

- Server Components + Server Actions / Route Handlers own all data access and
  domain logic.
- Client Components (`"use client"`) render and collect input only; they never
  compute business values, never call Prisma, never trust their own totals.
- Route Handlers (`src/app/api/**/route.ts`) follow the pattern:
  guard (auth + permission, `security-rbac-expert`) → validate → service →
  typed response; errors use proper HTTP codes (e.g. 422 transition error).

## i18n (CONFIRMED)

- Locales: FR (default), AR (RTL), EN — key-based dictionaries per locale.
- Every user-facing string is a key; do not hard-code French/Arabic text.
- Arabic UI must render RTL (check `dir="rtl"` handling in layouts).

## The 12-Layer Implementation Order (MANDATORY for new features)

1. Database (schema/decimals/indexes — with database-auditor)
2. Domain Service (logic server-side, company-scoped)
3. Authorization (permission key, server-side)
4. Company Isolation (companyId/branchId, fail-closed)
5. Numbering (DocumentSeries, server-side)
6. Workflow (status transitions via engine)
7. API (route + guard + validation + error codes)
8. UI (display/collect only)
9. PDF/Print (business document fields)
10. i18n (FR/AR/EN + RTL)
11. Audit (AuditLog + ActivityEvent for sensitive ops)
12. Tests (service, API, authorization, isolation, smoke)

Each layer depends on the previous one. Skipping a layer (e.g. UI first,
audit never) is an architecture violation.

## Sensitive Paths to Keep Server-Only (CONFIRMED)

- `/admin/**` and `/api/admin/**` — SUPER_ADMIN only (company-admin feature).
- Auth/session endpoints, user management.
- Any endpoint that mutates a document or stock.

## Forbidden Assumptions

- Do NOT assume the stock Next.js API of your training data applies — read
  `node_modules/next/dist/docs/` (see AGENTS.md).
- Do NOT put Prisma calls in client components.
- Do NOT use `prismaBase` for company data.
- Do NOT create a new feature folder without a service + types + tests.
- Do NOT skip the audit/activity layer for sensitive operations.

## STOP Conditions

- STOP if a change requires restructuring `src/lib/prisma.ts` or the client
  stack.
- STOP if a change would read company data outside the company context.
- STOP if server/client boundary is unclear.
- STOP if i18n keys are missing for a new UI string.
- STOP if a new App Router API differs from the project conventions.

## Examples

1. "New report page for company X" → App Router page + server data function
   (company-scoped `prisma`) + permission check + i18n keys + tests.
2. "New API endpoint" → route.ts: guard → validate → service → typed response.
3. "Platform-wide user count" → `prismaBase` in a SUPER_ADMIN service only.

## Interaction With Other Skills

- `database-auditor`: schema/migration layer (layer 1).
- `security-rbac-expert`: layers 3 (permissions) and 4 (isolation).
- `document-engine-expert`: layers 5–7 for documents.
- `commercial-expert` / `inventory-expert` / `algerian-tax-expert`: domain rules.
- `accounting-expert`: when layer 12 would create accounting events.
