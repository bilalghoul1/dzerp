# Super Admin + Company Owner — Pre-Implementation Audit

> **Date:** 2026-08-08 — **Status:** FINAL (agent sweeps reconciled)
> **Rule:** Audit before coding. Classify the current architecture against the target
> (Level 1 = global/platform Super Admin, Level 2 = company Owner) before writing code.
>
> **Reconciled with exhaustive cross-reference sweep of `src/`, `prisma/`, `scripts/`,
> `docs/` (excluding `src/generated`):** no `SUPER_ADMIN` / `superAdmin` / `GLOBAL_ADMIN`
> literal token anywhere; realisation today = `ADMIN` role + `isGlobalAdmin()` permission-key check.
> No `OWNER` role key. No `mustChangePassword` / temporary-password mechanism (flagged in
> `docs/ux/phase-ux-guided-erp.md` as out-of-scope future work).

---

## 0. Stack / key entry points (verified read-only)

| Concern | File |
|---|---|
| Prisma schema | `prisma/schema.prisma` |
| Permission catalogue | `src/features/auth/permissions.ts` |
| Server auth guard (RSC) | `src/features/auth/rbac.ts` |
| API auth guard | `src/features/auth/api-guard.ts` |
| Session/token | `src/features/auth/session.ts` |
| Company-aware API guard | `src/features/company/api.ts` |
| Company context (ALS) | `src/features/company/context.ts` |
| Company resolution | `src/features/company/resolver.ts` |
| Company store (membership/permissions) | `src/features/company/store.ts` |
| Prisma company scoping extension | `src/lib/db/company-scope.ts` |
| Unscoped (global) access | `src/features/company/unscoped.ts` |
| Company-admin API guard | `src/features/company-admin/api.ts` |
| Company-admin service | `src/features/company-admin/service.ts` |
| Company-admin routes | `src/app/api/admin/companies/**` |
| Admin UI | `src/app/(app)/admin/**` |
| Company wizard | `src/components/admin/company-wizard.tsx` |
| Bootstrap/seed | `prisma/seed.ts` (`npm run db:seed`) |
| Login | `src/app/api/auth/login/route.ts` |
| Change password | `src/app/api/auth/change-password/route.ts` |
| Audit service | `src/features/audit/service.ts` |
| Activity service | `src/features/activity/service.ts` |

---

## 1. Verified findings — classification

### A. Schema-level (prisma/schema.prisma)

| Item | Status | Notes |
|---|---|---|
| `User` model (username unique, email unique, passwordHash) | ✅ | `passwordHash` only — see credential rules below |
| `Company` model | ✅ | Soft-delete: `deletedAt`, `deletedById`; lifecycle: `status` (`ACTIVE/INACTIVE/SUSPENDED/ARCHIVED`) + `isActive` |
| `Company.code` unique | ✅ | Global unique constraint + manual check on create |
| `UserCompany` (membership) | ✅ | `@@unique([userId, companyId])`, `isDefault`, `active`, `defaultBranchId` |
| `RoleAssignment` (company-scoped role) | ✅ | `@@unique([userCompanyId, roleId])`, `active`, `expiresAt` |
| `Role` / `Permission` / `RolePermission` | ✅ | `Role.key` unique |
| `Session` with `activeCompanyId` / `activeBranchId` | ✅ | Company context persisted per session |
| `Branch.defaultBranchFor` / `Company.defaultBranchId` | ✅ | Default branch supported |
| `AuditLog` | ✅ | `companyId` nullable → global (non-company) events possible |
| `ActivityEvent` | ✅ | Second parallel activity log (see D) |
| **(MISSING)** GLOBAL / platform-type flag on `User` or `Role` | ❌ | No `SUPER_ADMIN` anywhere (see B) |
| **(MISSING)** `Company.ownerId` / explicit Owner relation | ❌ | Owner is **not** modeled as a field; only via `UserCompany` + `RoleAssignment` |
| **(MISSING)** `OWNER` role key | ❌ | Seeded roles: `ADMIN`, `MANAGER`, `READER`, `COMPANY_ADMIN` only |
| **(MISSING)** `mustChangePassword` / temporary-password field | ❌ | `User` has no such column |

### B. Global / Super Admin existence

| Question | Status | Finding |
|---|---|---|
| Is there a **global/platform** admin concept independent of company scope? | ❌ | Grep across `src/`, `prisma/`, `scripts/`, `docs/` for `SUPER_ADMIN / superAdmin / super admin / platform admin / GlobalAdmin / isGlobalAdmin`: **zero references**. The only "global-ish" concept is `isGlobalAdmin()` in `company-admin/service.ts` |
| How is `isGlobalAdmin()` currently determined? | 🟡 | `GLOBAL_ADMIN_KEYS = ["admin.company.create","admin.company.archive","admin.company.delete","admin.company.restore"]`. "Global admin" = a **user who possesses these company-permission keys** — i.e. it is granted via a **company-scoped `RoleAssignment`/`RolePermission`**, NOT via a platform role. This is exactly the anti-pattern the target forbids ("do NOT model Super Admin as UserCompany + CompanyRole"). |
| Does a Super Admin need a company membership today? | 🔴 | **Yes, effectively.** `getCurrentUser()` (auth/rbac.ts) sets `permissions` only from `resolveMembership(userId, activeCompanyId)`. If the user has no `UserCompany` row / no active company, `activeCompanyId` is `null` → `permissions = []`. A platform admin with **no** company has **zero** permissions today, so they cannot reach create/archive/restore. |
| Owner role / Owner creation | ❌ | No `OWNER` role, no owner-creation API, no owner field. |

## C. Company-creation workflow (current)

| Step the task requires | Current state | Status |
|---|---|---|
| Enter company info (legal, address, banking, branding, printing, numbering, branches) | Fully built — 9-step wizard (`CompanyWizard`) | ✅ |
| Enter initial Owner information (new user: fullName/username/email/temp password) | **Not present.** Step 8 "users" only *assigns existing users* via `MemberPicker` + `listAssignableUsers`. There is **no username/password/email field to create a brand-new owner account.** | ❌ |
| Create Company | ✅ `createCompany()` — `$transaction`, creates company + default HQ branch + document series + optional members | ✅ |
| Create Owner User | ❌ | |
| Create UserCompany | ✅ — but only for *pre-existing* users referenced by `input.members[].userId` | 🟡 |
| Assign `CompanyRole = OWNER` | ❌ | ❌ |
| Create default branch | ✅ `DEFAULT_HEADQUARTER_BRANCH` created if none | ✅ |
| Atomic commit | ✅ single `$transaction` | ✅ |
| Success screen showing owner/company/credentials | ❌ | ❌ |

**Conclusion:** Company **CRUD + lifecycle + atomicity** is strong. **Owner creation is completely missing** — the primary Level-2 goal.

## D. Company lifecycle / delete

| Action | Current method | Status |
|---|---|---|
| Activate / Deactivate | `setCompanyStatus(ACTIVE/INACTIVE...)` → sets `status` + `isActive` | ✅ |
| Archive | `setCompanyStatus(ARCHIVED)` — read-only gate via `assertNotArchived` | ✅ |
| Restore | `restoreCompany()` — `deletedAt=null`, `status=ACTIVE` | ✅ |
| Soft-delete | `softDeleteCompany()` — only if business tables empty (counts each of a hard-coded `BUSINESS_MODELS`); sets `deletedAt` + `ARCHIVED`; refuses default company | ✅ |
| Hard permanent delete | Not implemented; blocked by referential integrity | 🟡 → keep soft-delete/archive (matches "Prefer the existing lifecycle model") |

**Decision:** Reuse the existing **soft-delete / archive / restore** lifecycle. **Do NOT** introduce hard `DELETE`.

## E. Authorization/isolation

| Concern | Current state | Status |
|---|---|---|
| Company isolation via Prisma extension | ✅ `companyScope` extension fail-closed; `runUnscoped` disables | ✅ |
| Company switcher shows only `UserCompany` | ✅ `listCompaniesForUser` = active memberships only | ✅ |
| Super Admin must NOT auto-get memberships | 🔴 **Currently the opposite**: the platform admin must be in a company, and `isGlobalAdmin` is a company permission. No explicit "Enter company" audited action exists. | 🔴 |
| Company-scoped users blocked from global ops | 🟡 `assertGlobalAdmin()` returns 403 — but it relies on the flawed "permission-key = global" model | 🟡 |

## F. Audit / activity logging (two systems exist)

- `recordAudit()` → `AuditLog` (action, entity, entityId, actorId, companyId — companyId nullable, so **global events are representable**).
- `recordActivity()` → `ActivityEvent`.
- Already logged: company create/update/status/archive/restore/delete, member assign/revoke, login (`LOGIN` — all users, incl. seeded admin), change-password.
- **`recordAudit` / `recordActivity` accept `companyId: null`** → global (non company-scoped) events are representable. Reuse these; **do not** add a second audit system.
- **Gaps:** seed writes no audit rows at all (raw `PrismaClient`, no `recordAudit`); owner creation (once added) must log `CREATE`/`ASSIGN`; a Super Admin company "enter/impersonate" action must log an audit row.

## G. Bootstrap

- The ONLY bootstrap is `prisma/seed.ts` via `npm run db:seed`.
- 🔴 It is **destructive** (wipes almost every table via `deleteMany` at start) and **hard-codes** `hashPassword("admin123")` for `admin`, and it **creates the Super Admin as a company member** of the dev company `MAIN` (global `ADMIN` role proxy). This violates the task rules: no predictable default password; exactly one idempotent global super admin; safe on re-run.

---

## 2. Verdict — conflicts with target architecture?

- The **existing company-management engine (CRUD/lifecycle/scoping) is strong and REUSABLE** — the task explicitly forbids rewriting it.
- The **super-admin model conflicts with the target**: today "Super Admin" is derived from possessing `admin.company.*` **company** permission keys through a company membership. The task requires a **platform-level global role that is NOT a CompanyRole** and does NOT require company membership.
- The **Owner model is absent** in implementation AND schema.

This is a **🔴 conflict of design** (Level-1 Super Admin must be a global, non-company-scope role; today it is company-scoped), and a **❌ missing feature** (Owner creation UI/service, Owner role, temp-password flow). Per the process rule, implementation will change to design, and approval on the **smallest compatible global–role mechanism** is requested before writing code (options in §4).

---

## 3. What will be reused (do NOT rewrite)

- `companyScope` Prisma extension + `runUnscoped`
- `apiGuardWithContext` / `apiGuard` / `runScoped` / `runWithCompanyContext`
- `resolveMembership` / `listCompaniesForUser` / `selectActiveCompanyId`
- `company-admin` service CRUD / lifecycle
- `Audit` + `Activity` services (reuse, no new audit system)
- Company switcher isolation

## 4. Recommended smallest‑compatible design (decision required before implementation)

1. **Represent the global Super Admin as a dedicated role** seeded once with `key: "SUPER_ADMIN"` (system role, NOT assignable as a CompanyRole; used as a check on the *global* path), OR keep the current "grant `admin.company.*` RolePermission" approach but make the gate explicitly a **global/member/enterprise** mechanism separate from RoleAssignment ✓. Recommended: role keys in DB rows already exist, no schema new column needed.
2. **Add one owned `UserCompany` + `RoleAssignment` for each Owner** with `roleKey: OWNER` — OWNER role seeded with company-management `RolePermissions` (reuse existing `admin.company.update` / `membership` etc.) that powers the Level-2 permissions.
3. **Owner creation API**: extend `createCompany` (or a new `POST /api/admin/companies/... /owner`) to create the Owner `with` a generated/entered temporary password → hash → `passwordHash` + `mustChangePassword` (or reuse change-password). Return the temp password **only once** in the create response; never in later reads.
4. **Gate**: add a `requireGlobalAdmin` in series of an auth path that checks `user` **global roles (UserRole → SUPER_ADMIN)** OR system `admin.*` keys held directly, so it does not need a company membership.
5. **Seed**: add an idempotent, env-triggered, single-global-Super-Admin bootstrap (no predictable password, no `deleteMany`), kept separate from the existing dev seed.

_No code changed yet. This audit is the stop-gate before implementation (FIRST RULE)._