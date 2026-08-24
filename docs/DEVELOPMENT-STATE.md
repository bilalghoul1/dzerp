# DzERP — Development State (Power-Loss Safe)

> This file is the authoritative resume point. After ANY power loss / session stop,
> read this file + `git status` + `prisma migrate status` BEFORE doing anything else.
> Do NOT assume where work stopped — verify against this file.

---

## Current Phase
- **PHASE 9 — MRP / Production (DONE + VERIFIED)** — frozen, not modified.
- **PHASE 10 — RH / Human Resources**
  - **PHASE 10.1 — HR Organization (DONE + VERIFIED)** ✅
  - **PHASE 10.2 — Employees & Employment Contracts (DONE + VERIFIED)** ✅ — 2026-08-15
  - Phase 10.3+ (Payroll, Attendance, Leave, Recruitment): NOT STARTED — deferred per master prompt scope.

## Current Task
Phase 10.1 complete and verified. STOP. Awaiting user instruction before Phase 10.2.

---

## ✅ PHASE 9 CHECKPOINT — RECORDED (2026-08-15, re-confirmed)
- All MRP files present on disk and intact (service, 10 API routes, 4 UI managers,
  5 pages, 3 phase9 migrations).
- Quality gates green: `tsc` clean, `eslint` 0 errors, `npm run build` exit 0.
- `prisma migrate status` → 26 migrations, DB up to date (no drift).
- No production/company/user data modified. No commit made (per project rule).
- **Phase 9 is the safe checkpoint. Work may resume from here at any time.**

---

## ✅ PHASE 10.1 — HR ORGANIZATION (COMPLETE + VERIFIED — 2026-08-15)

Implemented ONLY the Organization scope per Master Prompt Phase 10.1:
**Departments, Job Titles, Positions.** No Employees/Contracts/Payroll/Attendance/
Leave/Recruitment (those are Phase 10.2+ and were deliberately NOT built).

### Audit (run BEFORE implementing — confirmed clean slate)
- No pre-existing HR models in `schema.prisma` (no Department/Position/Employee/
  JobTitle). No duplication.
- `nav.rh` already wired in `nav-config.ts` → `/rh` with `rh.view` permission.
- `rh.view` + `rh.manage` already existed in `permissions.ts` (kept as legacy).
- Reused existing engines: company context, `apiGuardWithContext`/`runScoped`,
  `requireCompanyContext`/`getOrResolveCompanyContext`, audit `recordAudit`,
  activity `recordActivity`, `recordAudit` uses `AuditAction.UPDATE` for archive
  (no `ARCHIVED` enum value exists — confirmed).

### What was built
1. **Schema** (`prisma/schema.prisma`) — 3 additive models:
   - `Department` (companyId, branchId?, code, name, nameAr?, description?,
     managerEmployeeId? [plain ref, no premature Employee FK], isActive,
     archivedAt?, archivedById?, audit fields). Unique (companyId, code).
   - `JobTitle` (companyId, code, name, nameAr?, description?, isActive,
     archivedAt?, archivedById?, audit fields). Unique (companyId, code).
   - `Position` (companyId, departmentId [FK Restrict], jobTitleId [FK Restrict],
     branchId?, code, name, nameAr?, description?, headcount?, managerEmployeeId?,
     isActive, archivedAt?, archivedById?, audit fields). Unique (companyId, code).
   - Back-relations added to `Company` (departments/jobTitles/positions) and
     `Branch` (departments/positions) — relation names `DepartmentBranch`,
     `PositionBranch` (no conflict with existing `WorkCenterBranch`).
2. **Migration** `20260815000000_phase10a_rh_organization` — VERIFIED ADDITIVE
   (only CREATE TABLE / CREATE INDEX / ADD FOREIGN KEY; no DROP/rename/ALTER/
   DELETE). Applied via `migrate deploy`.
3. **RBAC** (`src/features/auth/permissions.ts`) — 12 granular keys added:
   `rh.department.{view,create,update,archive}`, `rh.jobtitle.{view,create,
   update,archive}`, `rh.position.{view,create,update,archive}` (FR/AR names).
4. **Seed grants** (`prisma/seed.ts`) — 12 keys added to OWNER/MANAGER/READER
   arrays (idempotent grant). NOTE: canonical `prisma/seed.ts` fails on cleanup
   (pre-existing FK bug: `warehouse.deleteMany` hits RESTRICT on
   ProductionOrder_warehouseId_fkey) so it was NOT run. Permissions/roles were
   applied additively via `scripts/bootstrap-rh.ts` + `scripts/grant-rh-permissions.ts`.
5. **Service** (`src/features/rh/config.ts`):
   - List/create/update/archive for Department, JobTitle, Position.
   - `listRhOrgOptions()` (branches/departments/jobTitles for form selects).
   - Company isolation: all LIST use `getOrResolveCompanyContext()`; all
     MUTATIONS use `requireCompanyContext()`; Position create validates
     department+jobTitle belong to company; branch validated via
     `assertBranchInCompany`.
   - Soft-archive (isActive=false + archivedAt) instead of hard delete.
   - P2002 (duplicate code) → clean `ApiError(409, DUPLICATE_CODE)`.
   - Audit + activity logged on every mutation.
6. **API routes** (`src/app/api/rh/**`):
   - `departments` GET/POST/PATCH, `departments/[id]/archive` POST
   - `job-titles` GET/POST/PATCH, `job-titles/[id]/archive` POST
   - `positions` GET/POST/PATCH, `positions/[id]/archive` POST
   - `options` GET (rh.view)
   All use `apiGuardWithContext` + `runScoped` with granular permission checks.
7. **UI** (`src/components/rh/**`): `departments-manager`, `job-titles-manager`,
   `positions-manager` (CRUD dialogs, empty/loading/error states, archive
   confirm, branch/department/jobTitle selects, FR/AR/EN labels).
8. **Pages** (`src/app/(app)/rh/**`): `/rh` dashboard (counts), `/rh/departments`,
   `/rh/job-titles`, `/rh/positions` — server components requiring the matching
   `rh.*.view` permission, mirrored from production pages.
9. **i18n** (`src/i18n/dictionaries.ts`): `rh.*` namespace (FR/AR/EN) — 29 keys;
   `nav.rh` already present in all 3 locales.

### Verification (real runtime, not guessed)
- Dev server (single, on :3000 after killing stray servers): LOGIN 200.
- CREATE Department / JobTitle / Position → 201, correct `companyId`=TEST-01.
- Position correctly resolves `departmentName` + `jobTitleName`.
- LIST → 200, returns only TEST-01 rows.
- ARCHIVE → 200, `isActive:false`.
- DUPLICATE code → 409 (clean, no internal stack leak — fixed P2002 handling).
- INVALID body (missing code) → 400.
- UNAUTHENTICATED create/view → 401.
- Page routes `/rh`, `/rh/departments`, `/rh/job-titles`, `/rh/positions` → 200
  (authed); `/rh` unauth → 307 redirect to /login.
- `prisma migrate status` → 26 migrations, up to date.

### Quality gates (GREEN)
- `npx tsc --noEmit` → 0 errors ✓
- `npx eslint` (RH scope) → 0 errors, 0 warnings ✓
- `npm run build` → exit 0 (all RH routes compiled) ✓
- `prisma migrate status` → up to date ✓

---

## Completed
- Phase 9 (MRP) — see checkpoint above.
- Phase 10.1 (HR Organization) — Departments, Job Titles, Positions, full CRUD +
  RBAC + UI + i18n + audit, verified end-to-end.

## In Progress
- NONE. Phase 10.2+ not started (per instruction to STOP after 10.1).

## Next Step
Await explicit user instruction to begin Phase 10.2 (Employees / Contracts / Payroll /
Attendance / Leave / Recruitment). Do NOT auto-start.

---

## Files Changed (Phase 10.1 — uncommitted, NOT committed per project rule)
- `prisma/schema.prisma` (3 HR models + Company/Branch back-relations)
- `prisma/seed.ts` (12 rh.* keys in owner/manager/reader grant arrays)
- `src/features/auth/permissions.ts` (12 granular rh.* keys)
- `src/features/rh/config.ts` (NEW service layer)
- `src/app/api/rh/departments/route.ts` (NEW)
- `src/app/api/rh/departments/[id]/archive/route.ts` (NEW)
- `src/app/api/rh/job-titles/route.ts` (NEW)
- `src/app/api/rh/job-titles/[id]/archive/route.ts` (NEW)
- `src/app/api/rh/positions/route.ts` (NEW)
- `src/app/api/rh/positions/[id]/archive/route.ts` (NEW)
- `src/app/api/rh/options/route.ts` (NEW)
- `src/components/rh/departments-manager.tsx` (NEW)
- `src/components/rh/job-titles-manager.tsx` (NEW)
- `src/components/rh/positions-manager.tsx` (NEW)
- `src/app/(app)/rh/page.tsx` (NEW)
- `src/app/(app)/rh/departments/page.tsx` (NEW)
- `src/app/(app)/rh/job-titles/page.tsx` (NEW)
- `src/app/(app)/rh/positions/page.tsx` (NEW)
- `src/i18n/dictionaries.ts` (rh.* FR/AR/EN)
- `scripts/bootstrap-rh.ts` (NEW — additive test bootstrap; safe, idempotent)
- `prisma/migrations/20260815000000_phase10a_rh_organization/` (NEW, applied)

### Untracked / modified (NOT HR — pre-existing, leave alone)
Many git entries are unrelated prior-phase work (admin, documents, layout, etc.)
modified but uncommitted. Do NOT commit anything without approval.

## Database migrations
- Applied: phase9, phase9b, phase9c, **phase10a** (+ prior phases → 26 total).
- `prisma migrate status` = clean, no drift, no pending.
- **FORBIDDEN**: `prisma db reset`, destructive `deleteMany`, `git reset --hard`.
- The canonical `prisma/seed.ts` is BROKEN (pre-existing FK cleanup bug) — do NOT
  run it. Use `npx tsx scripts/bootstrap-rh.ts` (additive) to (re)create test
  company/roles/user for verification.

## Tests passed
- `npx tsc --noEmit` → 0 errors ✓
- `npx eslint` (RH scope) → 0 errors, 0 warnings ✓
- `npm run build` → exit 0 ✓
- `prisma migrate status` → up to date ✓
- Live E2E (curl + valid owner session on TEST-01):
  - login 200; create dept/jobtitle/position 201; list 200; archive 200;
    duplicate 409; invalid body 400; unauth 401; all 4 pages 200; unauth 307.

## Tests pending
- Automated unit/integration test suite for RH (none exist yet).
- In-browser click-through with a human (API + page render verified via curl/HTTP;
  no React runtime errors observed, but full visual QA not done).
- Phase 10.2+ not implemented.

## Known issues
1. **Canonical seed is broken** (pre-existing): `prisma/seed.ts` cleanup phase
   `warehouse.deleteMany()` fails with FK RESTRICT (ProductionOrder_warehouseId_fkey).
   NOT fixed (out of Phase 10.1 scope; destructive seed must not be run anyway).
   Use `scripts/bootstrap-rh.ts` for additive test-data creation.
2. `managerEmployeeId` on Department/Position is a plain String reference (no FK to
   Employee) by design — Employees are Phase 10.2; wiring the FK then.
3. Stray `next dev` processes resist `taskkill //F` on this Windows host; use
   `powershell -Command "Stop-Process -Id <pid> -Force"` to kill them. Multiple
   dev servers corrupt `.next` — always run exactly ONE, and `rm -rf .next` before
   restart.

## Exact command to resume
```bash
# 1. Inspect state (always first after power loss)
cat docs/DEVELOPMENT-STATE.md
git status --short | head -60
npx prisma migrate status

# 2. Quality gates (green; re-run to confirm)
npx tsc --noEmit
npx eslint "src/features/rh/**/*.{ts,tsx}" "src/components/rh/**/*.{ts,tsx}" "src/app/(app)/rh/**/*.{ts,tsx}" "src/app/api/rh/**/*.{ts,tsx}"
npm run build

# 3. Ensure test identities exist (additive, safe)
npx tsx scripts/bootstrap-rh.ts

# 4. Run ONE dev server
powershell -Command "Stop-Process -Id <stray_pid> -Force"   # kill strays first
rm -rf .next && npm run dev   # background, port 3000

# 5. Smoke test (valid owner session)
curl -c cj.txt -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"testowner","password":"test1234"}'
curl -b cj.txt http://localhost:3000/api/rh/departments
curl -b cj.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/rh
```

---

*Last updated: 2026-08-15 — Phase 10.1 (HR Organization) COMPLETE + VERIFIED.

---

## PHASE 10.2 — Employees & Employment Contracts (COMPLETE + VERIFIED)

**Date:** 2026-08-15
**Status:** DONE — all quality gates green, runtime E2E (10 tests) passed.

### Scope implemented
Employee + EmploymentContract only (per master prompt). No Payroll/Leave/Attendance/Recruitment/etc.

### Database changes
- New enums: `EmployeeStatus` (ACTIVE/INACTIVE/ON_LEAVE/TERMINATED), `ContractType` (CDI/CDD), `ContractStatus` (DRAFT/ACTIVE/EXPIRED/TERMINATED/ARCHIVED).
- New models: `Employee`, `EmploymentContract` (currency = `String @default("DZD")`, salary `Decimal` — matches project convention, no Currency enum).
- Back-relations added to `Company`, `Branch`, `Department`, `Position`, `JobTitle`, `User`.
- Soft-archive fields on both (`isActive`, `archivedAt`, `archivedById`); FK `onDelete` policies: Company=Cascade, Branch/Dept/Pos/JT/User=SetNull, EmploymentContract→Employee=Restrict (no cascade delete).

### Migration
- `20260815010000_phase10_2_employees_contracts` — additive ONLY (3 new enum types, 2 new tables, FKs). Inspected SQL: no DROP/ALTER DROP/DELETE.
- Applied via `prisma migrate deploy` (not reset/push). `migrate status`: 27 migrations up to date.

### Services
- `src/features/rh/employees.ts` — list/create/update/archive + company & branch & org & user ownership validation (rejects cross-company refs → 422), duplicate matricule → 409, audit CREATE/UPDATE + activity.
- `src/features/rh/contracts.ts` — list/create/update/archive + employee/branch/dept/pos ownership checks, date/trial/salary validation, soft-archive (status ARCHIVED).

### APIs (all via apiGuardWithContext + runScoped)
- `GET/POST /api/rh/employees`, `PATCH /api/rh/employees/[id]`, `POST /api/rh/employees/[id]/archive`
- `GET/POST /api/rh/contracts`, `PATCH /api/rh/contracts/[id]`, `POST /api/rh/contracts/[id]/archive`
- Lists default to `isActive:true`; `?archived=1` and `?employeeId=` supported.

### RBAC
- 8 new keys: `rh.employee.{view,create,update,archive}`, `rh.contract.{view,create,update,archive}` (in `permissions.ts`).
- Granted to OWNER/MANAGER/READER via additive, non-destructive `scripts/bootstrap-rh.ts` (no destructive seed). 125 permission rows ensured.

### UI
- `src/components/rh/employees-manager.tsx` (search, status/branch/dept filters, full CRUD form, archive, contract count), `contracts-manager.tsx` (employee/status filters, CRUD, archive).
- Pages: `/rh/employees`, `/rh/contracts` (+ `/rh` dashboard shows employee/contract counts).
- Nav: added `Employees`/`Contracts` entries under RH.

### i18n
- Added `rh.employees` + `rh.contracts` blocks (FR/AR/EN) in `src/i18n/dictionaries.ts`.

### Company isolation
- Every query scoped via `getOrResolveCompanyContext()` (read) / `requireCompanyContext()` (mutate). Company ID never trusted from client.

### Known warnings
- 19 eslint warnings (pre-existing cosmetic class: unused vars in legacy files) — 0 errors.
- Generated Prisma client carries `@ts-nocheck`; nullable DateTime inputs require field-omission (not `null`/`undefined`) in create/update — handled via guarded assignment.

### Deferred to later phase
Payroll, Payslips, IRG/CNAS/CASNOS, Attendance, Timesheets, Leave, Recruitment, Performance, Training, Expenses, ESS, Benefits, Tax calc — all explicitly out of scope.

### Git status
- Many files modified/untracked (Phase 9 + 10.1 + 10.2). **NO git commit** (per mandate). STOP.

*Last updated: 2026-08-15 — Phase 10.2 (Employees & Employment Contracts) COMPLETE + VERIFIED.

---

## POST-POWER-LOSS LOGIN RECOVERY (2026-08-16)

**Symptom reported:** login failure after sudden power loss.
**Root cause:** NOT a code/DB/auth bug. Power loss left MULTIPLE stale DzERP Node/Next
processes (PIDs 1772, 10280, 10268, 4592) plus a corrupted/stale `.next` Turbopack
cache — the documented "phantom 404 / multi-server `.next` corruption" hazard. The
login route, password verify, session creation, company-context resolution and RBAC
are all correct on disk.

**Recovery performed (environmental only, no source change):**
1. Stopped all 4 stray DzERP node processes via PowerShell; confirmed port 3000 FREE.
2. Deleted `.next` only (no other dirs touched).
3. `npx prisma generate` (regenerated client, no schema/migration change).
4. Started ONE clean `npm run dev` (pid 5376, port 3000).
5. Verified login endpoint directly: missing→400, invalid→401, valid→200.
6. Read-only DB audit: testowner ACTIVE, 60-char bcrypt hash present, memberships + role assignments intact (app proved it via RBAC-protected /rh/employees→200).
7. Full E2E: /login 200, login 200 + session cookie, /dashboard /crm/customers /documents /quotation /proforma /rh/* all 200, logout 200 + session invalidated, re-login 200.
8. Quality gates green: tsc 0, lint 0 errors (23 pre-existing warnings), build 0, prisma valid, 27 migrations up to date.

**Files changed:** NONE (no application code modified).
**DB changes:** NONE (no reset, no push, no seed, no data change).
**Temp scripts removed:** scripts/_audit_auth.ts, scripts/_ps_procs.ps1, scripts/_ps_kill.ps1, cj.txt.

**Future Windows restart procedure (if phantom 404 after power loss):**
1. Stop stray dev servers (PowerShell Get-Process node / Get-NetTCPConnection -LocalPort 3000).
2. Confirm port 3000 free.
3. `rm -rf .next`
4. `npx prisma generate`
5. `npm run dev` (single instance, port 3000)

---

## RBAC SIMPLIFICATION — TWO PLATFORM ROLES (2026-08-16)

**Objective:** collapse the platform to exactly two business/application roles —
`SUPER_ADMIN` (global platform) and `COMPANY_ADMIN` (one company, full control).
Removed from the role catalog: `OWNER`, `MANAGER`, `READER`, and the legacy global `ADMIN`.

### Final role model
- `SUPER_ADMIN` — global `UserRole`, **no `UserCompany` required**, company-independent.
  permission set = `admin.*` (platform operations).
- `COMPANY_ADMIN` — company-scoped (`UserCompany` + `RoleAssignment`), exactly one company.
  permission set = the full company module set (inherited the former `OWNER` 125 permissions:
  crm, product, warehouse, inventory, finance, accounting, parametres, admin.company.*,
  production/MRP, RH organization, files, search, documents, ventes, achats, rapports).

### Migration performed (data only, no schema change, idempotent)
- Script: `scripts/migrate-rbac-two-roles.ts` (kept as the canonical migration; references
  `OLD_ROLE_KEYS = ["OWNER","MANAGER","READER","ADMIN"]` intentionally).
- Provisioned `COMPANY_ADMIN` + granted it the 125 company permissions (copied from `OWNER`'s set).
- Repointed the 1 existing `RoleAssignment` (`testowner` OWNER→COMPANY_ADMIN) BEFORE deleting
  old role rows (so no assignment was cascade-deleted).
- Deleted old role catalog rows (`OWNER`, `MANAGER`, `READER`; `ADMIN` was already absent).
- **Result: exactly 2 roles in DB** — `SUPER_ADMIN`, `COMPANY_ADMIN`. No `User`/`Company`/
  `UserCompany`/`Session`/`UserRole`/`Permission` catalog touched. No orphan `RoleAssignment`/
  `UserCompany` rows.

### Application code changes
- `src/features/company-admin/service.ts`: `OWNER_ROLE_KEY` → `COMPANY_ADMIN_ROLE_KEY`
  (company creation, owner lookup, error code `MISSING_COMPANY_ADMIN_ROLE`).
- `prisma/seed.ts` + `scripts/bootstrap-rh.ts`: no longer create `OWNER`/`MANAGER`/`READER`;
  demo users + `dzerp.owner` now assigned `COMPANY_ADMIN`.
- Intentional security guards KEPT (must not be touched): `assertAssignableRole`, `listAssignableRoles`
  still exclude global roles (`"ADMIN"`,`"SUPER_ADMIN"`) from company assignment.

### Verification (real runtime + DB, 2026-08-16)
- SUPER_ADMIN login → 200; `/admin` → 200. COMPANY_ADMIN (`testowner`) `/api/rh/employees`
  & `/api/rh/contracts` → 200. COMPANY_ADMIN `/admin` → 404 (platform correctly denied).
- Cross-company data isolation: `adminA`(TEST-A) sees only TEST-A; `adminB`(TEST-B) only TEST-B.
- COMPANY DELETE INDEPENDENCE: `DELETE /api/admin/companies/[TEST-A]` (confirmation
  `"Test Company A"`) → 200; TEST-A removed; `adminA` lost access (307/401); **SUPER_ADMIN
  still logged in (200), ACTIVE, 1 global `UserRole`, 0 `UserCompany`**; TEST-B/TEST-01/DZERP/
  MAIN intact; permission catalog (125) & sessions (28) untouched; 0 orphan rows.
- Quality gates: `tsc` 0 errors; `lint` 0 errors (24 cosmetic warnings); `build` exit 0;
  `prisma migrate status` → 27 migrations, schema up to date.

### Remaining architectural decision (FUTURE, do NOT change current behavior)
SUPER_ADMIN currently holds global `admin.*` permissions only and does **NOT** automatically
receive company-scoped module permissions (e.g. `rh.employee.view`). Company-scoped endpoints
therefore return **403** for SUPER_ADMIN, by design of the existing `resolveMembership` +
permission model (a SUPER_ADMIN has no company membership to derive module perms from).
This is **pre-existing behavior**, not introduced by this migration, and was deliberately left
unchanged per the RBAC master prompt. If global module access for SUPER_ADMIN is desired, that
is a separate, future architecture decision (expand the SUPER_ADMIN permission grant or add a
super-admin implicit-all-permissions path) — out of scope here.

### Test-fixture cleanup & clean RBAC test (2026-08-16, RBAC CLEAN RESET)
Obsolete Phase 7 RBAC fixtures **retired** (moved to `scripts/legacy/`, excluded from tsconfig so
they no longer break the build and are preserved for history — NOT blindly rewritten):
- `scripts/legacy/verify-phase72-rbac-integrity.ts`
- `scripts/legacy/verify-phase73-sales-order.ts`
- `scripts/legacy/verify-phase74-delivery-note.ts`
- `scripts/legacy/verify-super-admin.ts`
- `scripts/legacy/verify-superadmin-company-delete.ts`
Deleted (clearly temporary): `scripts/_phase0-audit.ts`.

**New clean test** `scripts/verify-rbac-two-roles.ts` (the canonical two-role verification):
- Uses ONLY `SUPER_ADMIN` + `COMPANY_ADMIN`. No OWNER/MANAGER/READER/ADMIN created or referenced.
- Temporary identities: `rbac.companyadmin.*@test.local`, companies `RBAC-TEST-A` / `RBAC-TEST-B`.
- Covers TEST 1–6 (role catalog, SUPER_ADMIN independence, COMPANY_ADMIN cross-company,
  platform-vs-company access, data isolation, company-deletion independence) via the REAL API + DB.
- Self-cleaning: hard-deletes all `rbac.*` users / `RBAC-TEST-*` companies it created in `finally`.
- Run: `npx tsx scripts/verify-rbac-two-roles.ts` (dev server on :3000). **Result: 31/31 PASS.**

Temporary E2E data removed (conclusively temporary, orphaned, no business data):
- `adminA`, `adminB` (created during the 2026-08-16 RBAC E2E; 0 memberships) — hard-deleted.
- `TEST-B` company — already absent (deleted during E2E).

### Intentional references left UNCHANGED (security guards / historical tools)
- `src/features/company-admin/service.ts:119` `if (role.key === "ADMIN" || role.key === "SUPER_ADMIN")`
  and `:2013` `notIn: ["ADMIN","SUPER_ADMIN"]` — intentional security boundary that blocks global
  roles from being assigned as company roles. KEEP.
- `scripts/migrate-rbac-two-roles.ts` — canonical migration; intentionally references
  `OLD_ROLE_KEYS = ["OWNER","MANAGER","READER","ADMIN"]` (the legacy roles being removed). KEEP.
- `scripts/restore-super-admin.ts` — recovery tool that intentionally recreates `OWNER` for
  `dzerp.owner` (historical recovery behavior). KEEP + documented.
- `scripts/repair-company-membership-integrity.ts` — repair tool; `GLOBAL_ROLES`/`AUTO_EXCLUDED`
  defensive lists referencing ADMIN/OWNER. KEEP.
- `scripts/verify-admin-removal.ts` — verifies the legacy `admin` *user* (not the role catalog) is
  gone; references ADMIN role defensively. KEEP.
- `scripts/verify-company-membership-integrity.ts` — `GLOBAL_ROLES=["ADMIN","SUPER_ADMIN"]`
  defensive. KEEP.
- `scripts/legacy/*` — retired historical fixtures (excluded from tsconfig). PRESERVED for history.

### Known SUPER_ADMIN company-scoped behavior (documented, NOT changed)
SUPER_ADMIN holds global `admin.*` permissions only and does **NOT** auto-receive company-scoped
module permissions (e.g. `rh.employee.view`). Company-scoped endpoints therefore return **403** for
SUPER_ADMIN, by design of the existing `resolveMembership` + permission model (no company membership
to derive module perms). Company deletion removes the admin's `UserCompany` membership (cascade) but
the user account remains authenticable; company-scoped access is denied (verified: 403). These are
pre-existing behaviors, deliberately left unchanged.

### Git status
- Files changed for this phase: `prisma/seed.ts`, `scripts/bootstrap-rh.ts`,
  `src/features/company-admin/service.ts`, `scripts/migrate-rbac-two-roles.ts` (new),
  `scripts/verify-rbac-two-roles.ts` (new clean test), `tsconfig.json` (exclude `scripts/legacy`).
- Moved to `scripts/legacy/`: the 5 obsolete Phase 7 verify-*.ts fixtures.
- Deleted: `scripts/_phase0-audit.ts`, temp E2E users `adminA`/`adminB`.
- **NO git commit** (per mandate). STOP.

*Last updated: 2026-08-16 — RBAC two-role simplification COMPLETE + VERIFIED (clean reset).*

---

## SUPER_ADMIN FULL PLATFORM CONTROL (2026-08-16)

Implemented a clean, global administration control layer for SUPER_ADMIN. RBAC, schema,
permissions, authentication, company isolation and the two-role model are **unchanged**.

### Behavior
- **Company permanent delete** (`permanentlyDeleteCompany`, `service.ts`): already existed and is
  gated by `assertGlobalAdmin` (SUPER_ADMIN only). The `isDefault` guard was **removed** — SUPER_ADMIN
  can now permanently delete `isDefault=true` companies, the last remaining company, and leave the DB
  with **zero companies**. No replacement default company is created. The purge transaction deletes all
  company-scoped data (documents, products, warehouses, inventory, customers, suppliers, employees,
  departments, accounts, files, memberships, …) in dependency order, then the company, inside one
  transaction (`prismaBase`, raw client → real hard delete). Soft delete (`softDeleteCompany`) keeps its
  `isDefault` + `COMPANY_HAS_DATA` guards (unchanged normal workflow).
- **User permanent delete** (`permanentlyDeleteUser`, `service.ts` + new `DELETE /api/admin/users/[userId]`):
  SUPER_ADMIN only, no company context. Confirmation must equal the exact `user.username`. Protections
  (defense in depth): cannot delete **self** (`CANNOT_DELETE_SELF` 400); cannot delete **any SUPER_ADMIN**
  (`assertNotProtectedUser` → `SUPER_ADMIN_PROTECTED` 403, covers the last remaining SA). Audit history is
  preserved (optional `userId` FKs SET NULL by schema); only proprietary data is purged (sessions,
  `UserCompany` → cascades `RoleAssignment`, `UserRole`). `Employee` rows keep history (`userId`→NULL).
- **UI**: `/admin/companies/[id]` permanent-delete menu item no longer disabled for default companies
  (requires exact company-name confirmation). `/admin/users` table adds a distinct **Delete permanently**
  button (destructive styling) with an exact-username confirmation dialog; hidden for SUPER_ADMIN targets
  and for the currently logged-in user (self). i18n keys added (fr/ar/en): `userDelete*`, `userDeleteSelfNote`.

### RBAC integrity (verified)
Only `SUPER_ADMIN` + `COMPANY_ADMIN` exist. `OWNER`/`MANAGER`/`READER`/`ADMIN` = 0. No migration created
(schema already supported deletion). COMPANY_ADMIN cannot perform global company/user deletion (403 via
`superAdminOnly`).

### Tests
- `scripts/verify-superadmin-control.ts` — integration test (live API + DB, self-cleaning): **24/24 PASS**
  (scenarios A–I: SA sees company/user, deletes COMPANY_ADMIN user with no orphans, deletes isDefault
  company with data + no replacement default, deletes to zero companies, self-delete blocked, other-SA
  delete blocked, COMPANY_ADMIN company/user delete blocked 403). Residue verified = 0.
- `scripts/verify-rbac-two-roles.ts` — still **31/31 PASS** (two-role model intact).

### Quality gates (verified)
`prisma validate` ✅ · `prisma generate` ✅ · `prisma migrate status` up to date (no migration) ✅ ·
`npx tsc --noEmit` 0 errors ✅ · `npm run lint` 0 errors (24 cosmetic warnings) ✅ · `npm run build` exit 0 ✅.

### Files changed
- `src/features/company-admin/service.ts` — removed `isDefault` guard in `permanentlyDeleteCompany`;
  added `permanentlyDeleteUser`.
- `src/features/company-admin/schemas.ts` — added `deleteUserConfirmationSchema`.
- `src/app/api/admin/users/[userId]/route.ts` — added `DELETE` handler.
- `src/components/admin/company-detail.tsx` — permanent-delete enabled for default companies.
- `src/components/admin/platform-users-table.tsx` — Permanent Delete button + confirmation dialog + self/SA protection.
- `src/app/(app)/admin/users/page.tsx` — passes `currentUserId`.
- `src/i18n/dictionaries.ts` — fr/ar/en `userDelete*` keys.
- `scripts/verify-superadmin-control.ts` — new integration test.

*Last updated: 2026-08-16 — SUPER_ADMIN full platform control IMPLEMENTED + VERIFIED.*
