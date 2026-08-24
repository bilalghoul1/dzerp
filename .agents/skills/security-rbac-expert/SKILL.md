---
name: security-rbac-expert
description: Expert on DzERP security and RBAC: sessions, the two role planes (global UserRole vs company RoleAssignment), permission keys, server-side enforcement, SUPER_ADMIN platform control, company isolation, and audit requirements. Use when implementing or reviewing authentication, authorization, permission checks, admin endpoints, user management, or any security-sensitive operation. All authorization MUST be enforced server-side.
license: MIT
metadata:
  author: dzerp
  version: "1.0.0"
---

# Security & RBAC Expert

## Purpose

Define DzERP's security model so every endpoint and feature enforces
authentication and authorization server-side, respects the two role planes,
and never trusts the client.

## Scope

- Authentication and sessions (`src/features/auth/`).
- Role model: global `UserRole` vs company `RoleAssignment`.
- Permission keys and how they are computed.
- Server-side guards (route handlers, API routes, admin).
- Company isolation as a security boundary.
- Audit of sensitive operations.
- SUPER_ADMIN platform control center.

## Security Model (CONFIRMED)

- **Two independent role planes**:
  - `UserRole` — global roles on the user, e.g. `SUPER_ADMIN` (key
    `SUPER_ADMIN`). Platform-wide, independent of company membership.
  - `RoleAssignment` — a company `Role` granted to a `UserCompany` membership
    (active, optional `expiresAt`). Company roles include Owner, Company Admin,
    Manager, Reader semantics (keys verified in `src/features/company-admin/service.ts`).
- `PermissionSource = "RoleAssignment" | "UserRole" | "None"` — a user's
  effective permissions come from their active role assignments in the active
  company; if none, access is denied.
- Effective permissions are computed server-side per request and exposed on
  `CompanyContext.permissions` (see `src/features/company/types.ts`).
- **Authorization lives on the server.** The client only renders what the
  server already authorized; a client-side check is never sufficient.

## Key Files (CONFIRMED)

| File | Responsibility |
| --- | --- |
| `src/features/auth/rbac.ts` | `SUPER_ADMIN_ROLE_KEY`, session/user helpers, `requireSuperAdmin()` |
| `src/features/auth/permissions.ts` | Permission keys catalog (`admin.users.manage`, `admin.audit.view`, `admin.company.*`, `parametres.*`, etc.) |
| `src/features/company-admin/api.ts` | `adminGuard(...)`, `superAdminOnly` — guard helpers for `/api/admin/**` |
| `src/features/company/types.ts` | `CompanyContext`, `PermissionSource`, role/membership types |
| `src/features/company-admin/service.ts` | Admin service (users, analytics, health, backups) |
| `src/features/audit/service.ts`, `src/features/activity/service.ts` | AuditLog / ActivityEvent recording |

## Guard Rules (CONFIRMED behavior)

- **SUPER_ADMIN only** (`/admin/**`, `/api/admin/**`):
  - `requireSuperAdmin()` rejects non-super users (404-style, no info leak).
  - The global `SUPER_ADMIN` role is independent of company membership — a
    SUPER_ADMIN has no default company context.
- **Company-scoped endpoints**: verify the user has a valid membership in the
  requested company and the required permission key (e.g. `adminGuard(...)`).
- Failed authorization returns an opaque error (do not reveal why/what data
  exists).
- Session must be present, valid, and the user must be active.

## Company Isolation as Security (CONFIRMED)

- The Prisma `companyScope` extension enforces isolation at the data layer:
  strict models are automatically filtered by the active company context; a
  query outside any company context fails (fail-closed).
- A user can only see/act on companies where they have a membership.
- `prismaBase` (bypasses scope) is reserved for SUPER_ADMIN platform
  aggregates and MUST NOT expose per-company rows to regular users.
- Cross-company IDOR: always resolve the resource by ID **within** the active
  company context; never by global ID alone.

## Permission Keys (CONFIRMED pattern — `src/features/auth/permissions.ts`)

- Keys follow a dotted namespace: `admin.users.manage`, `admin.audit.view`,
  `admin.company.*`, `parametres.*`, etc. Read the file for the current catalog
  before adding a key.
- Adding a permission key requires: the key in the catalog, a role mapping, a
  guard using it, i18n label, and tests.

## Audit Requirements (CONFIRMED)

- Sensitive operations (user management, permission changes, document
  approvals/cancellations, admin actions) write `AuditLog` and, where relevant,
  an `ActivityEvent`, with actor id, company, ip, userAgent (see the audit and
  activity services).
- Audit rows are `COMPANY_OPTIONAL_MODELS` (they may exist outside a company
  context, e.g. platform actions).
- Never delete/alter audit logs.

## Sensitive Operations (require audit + permission review)

- Creating/deactivating users, changing roles or memberships.
- Approving, validating, cancelling, or reverting documents.
- Stock adjustments and transfers.
- Changing company settings/tax rates.
- Any SUPER_ADMIN platform action.

## Forbidden Assumptions

- Do NOT assume a logged-in user is authorized for the resource.
- Do NOT trust `companyId`/`branchId`/`userId` from the client — resolve from
  the session/context.
- Do NOT put permission checks only in the UI.
- Do NOT let a company admin perform SUPER_ADMIN actions.
- Do NOT use `prismaBase` for a company-scoped authorization check.

## STOP Conditions

- STOP if RBAC architecture must change.
- STOP if a permission check is missing on a mutating endpoint.
- STOP if an endpoint would leak cross-company data.
- STOP if audit logging must be removed/skipped for a sensitive op.
- STOP if a role/session model change is proposed.

## Examples

1. "Admin deactivates a user" → SUPER_ADMIN guard (`requireSuperAdmin`),
   admin service, AuditLog entry, opaque failure responses.
2. "Company admin views users" → `adminGuard` + `admin.users.manage`
   permission, resolve company from context, company-scoped query.
3. "New permission for print approval" → add key to permissions catalog, map
   to role, guard the API, i18n label, tests.

## Interaction With Other Skills

- `erp-architecture`: server/client boundaries and the 12 layers.
- `database-auditor`: isolation at the data layer, `prismaBase` limits.
- `document-engine-expert`: approval/cancellation permissions on status flows.
- `commercial-expert` / `inventory-expert`: who may act on documents/stock.
- `company-admin` feature (`/admin/**`) is the concrete SUPER_ADMIN surface.
