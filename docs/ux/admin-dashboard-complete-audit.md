# DzERP — Complete Admin & ERP UX / Flow Audit

> Date: 2026-09-05 · Version: 1 · Type: static code + attempted runtime verification
> Scope: `src/app/(app)/**`, `src/components/**`, `src/features/**`, `prisma/seed.ts`, `prisma/schema.prisma`
> Method: code evidence with `file:line` references; all authenticated UI screens marked `NOT VERIFIED — runtime access unavailable` (unauthenticated 307 redirects confirmed at `localhost:3000`). Read-only audit — no code was modified.

---

## 1. Executive Summary

DzERP is a mature single-tenant-per-company Algerian ERP on Next.js App Router + Prisma. Its **server-side RBAC** (`requirePermission`, `apiGuardWithContext`, `runScoped`), **strict company scoping** (`prisma` scoped client), **9-type document engine with status transitions**, and **double-entry accounting engine** (`registerPayment` / `postJournalEntry`) are well-designed foundations. Phase 4 (company settings tabs + branches manager) is the reference UX.

The audit identified **no critical security bypass** in server-side enforcement; the mainline permission layer is correct. However, the **COMPANY_ADMIN seed grant** (`prisma/seed.ts:249-274`) omits critical permission families, causing a **silent UX dead-end**: the company's only administrative role cannot see Documents, Sales, Purchasing, Comptabilité, Reports, or HR employees. This is the single highest-risk issue.

**Top five UX gaps (ordered):**

1. **RBAC reachability defect (P0, CRITICAL)** — seed grants cover ~40% of operational modules; the sidebar shows, but document/sales/purchasing/comptabilité/reporting/HR rows are invisible to the only company role.
2. **Permission key mismatch (P0, HIGH)** — document engine `PURCHASE_REQUEST.permissionPrefix = "achats.demande"` (`engine/config.ts:156`) while the catalog, seed, and Quick Create use `achats.besoin.*` → purchase requests are invisible even when the matching permission *is* granted.
3. **No document number preview (P1)** — `previewNextNumber` is dead code (`series.ts:46`); users save blindly.
4. **Print format is setting-only (P1)** — `Company.printFormat` drives A4/A5/THERMAL rendering (`print/service.ts:63`, `renderer.ts:87-96`) but there is no in-UI format picker at the point of action.
5. **Dual navigation schema (P2)** — sidebar uses grouped `companyNavGroups`; palette uses flat `mainNav`; `/ventes` and `/achats` are redirect stubs producing invisible extra hops.

**Strengths to preserve:** server-only RBAC, company/branch scoping, the document engine spine, the accounting engine, the Phase 4 settings/branches pattern, strict trilingual i18n.

```
Overall UX maturity:  Moderate-to-Strong (architecture strong; per-module polish uneven)
Primary opportunity:  make the permission grant match the nav model so the existing modules are actually reachable
Primary risk:         fresh COMPANY_ADMIN sees ~half a blank sidebar with no explanation
```

---

## 2. Application Mental Model

DzERP serves three concentric user planes — this is how users should conceptually understand it:

```
PLATFORM PLANE (SUPER_ADMIN, no company active)
  ● /admin/**  — manage all companies, users, sessions, security, audit, backups
    (src/components/shell/nav-config.ts:97-128; app-shell.tsx:46,102-113)

COMPANY PLANE (COMPANY_ADMIN / member of one company)
  ● Dashboard           — financial KPIs, urgent actions, alerts, charts
  ● Clients / Fournisseurs — CRM list + detail (code, name, sector, balance)
  ● Documents (hub)     — unified 9-type document engine (sales + purchasing)
  ● Stock               — products, warehouses, inventory movements
  ● Production          — BOMs, work centers, machines, orders
  ● Comptabilité        — ledger, treasury, journal (real double-entry)
  ● Finance sub-pages   — tax declarations, reconciliation, fixed assets, report
  ● RH                  — departments, job titles, positions, employees, contracts, payroll
  ● Rapports            — reports
  ● Paramètres          — company settings (6 tabs) + branches, taxes, currencies,
                          units, numbering, preferences, referentiels

USER PLANE (per-user session)
  ● /compte             — own profile (name, email, password)
  ● /aide               — help (footerNav)
```

**Key rules shaping the mental model:**

- **Company scoping is structural.** All queries go through scoped `prisma` (`src/lib/prisma.ts`) or `runScoped` (`src/features/company/api.ts`). Users should only think "which branch?" — never "which company?"
- **Branch is a soft context.** The header holds a `BranchSelector` (`app-shell.tsx:122-128`) but most list pages query company-wide. This is inconsistent from the user's perspective (flagged §13).
- **Documents are the spine.** Sales and purchasing are not separate modules — both funnel into the 9-type document engine and `/documents` hub. `/ventes` and `/achats` are redirect stubs, which creates invisible entry points that look broken.
- **RBAC has two planes:** global `UserRole` (SUPER_ADMIN, no company) vs per-company `RoleAssignment` (COMPANY_ADMIN). Server-authoritative; UI only filters visibility.

---

## 3. Complete Navigation Map

Legend: `(P)` = platform/SUPER_ADMIN-only · `->` = redirect · Guards: `requirePermission(...)` unless noted.

### 3.1 Global shell

| Route | File | Guard |
|---|---|---|
| `/` | `src/app/(app)/dashboard/page.tsx` | `dashboard.view` (L68) |
| `/login` | outside `(app)` layout | auth |
| `/register` | outside `(app)` layout | auth |
| `/compte` | user profile page | session |
| `/*` catch-all | `src/app/(app)/[...module]/page.tsx` → `<ComingSoon/>` | none (any authenticated user) |

### 3.2 Company plane

| Route | Page | Permission gate | Key entities / actions |
|---|---|---|---|
| `/crm/customers`, `/crm/suppliers` | CRM list pages | `crm.customer.view` / `crm.supplier.view` | customer/supplier CRUD, balance, sector |
| `/crm/customers/[id]`, `/crm/suppliers/[id]` | CRM detail | `crm.*.view` | transactions, tabs |
| `/documents` | hub (9 doc types) | `documents.read` | list + create buttons filtered by `${prefix}.view`/`.create` |
| `/documents/groups` | doc groups | `documents.read` | grouping view |
| `/documents/[type]/nouveau` | create per type | `${prefix}.create` (dynamic) | lines, party, status |
| `/documents/[type]/[id]` | detail per type | `${prefix}.view` | status transitions, print, PDF |
| `/ventes` | redirect stub → `/documents` | **none before redirect** | empty hop |
| `/achats` | redirect stub → `/documents` | **none before redirect** | empty hop |
| `/stock` | products (products-manager) | `product.view` | product CRUD (~540-line create form) |
| `/stock/entrepots` | warehouses | `warehouse.view` | warehouse CRUD |
| `/stock/mouvements` | movements | `inventory.view` | adjust + transfer |
| `/production` | hub (count cards) | `production.view` | BOMs, work centers, machines, orders |
| `/production/boms` | BOMs | `production.bom.view` | bill of materials |
| `/production/orders` | orders | `production.view` | production order lifecycle |
| `/comptabilite` | ledger + treasury + journal | `compta.view` | PaymentForm, JournalEntryForm, plan comptable |
| `/finance/payments` | payments | `finance.payment.view` | registerPayment |
| `/finance/reconciliation` | reconciliation | per feature | bank matching |
| `/finance/tax-declarations` | tax declarations | per feature | TVA |
| `/finance/fixed-assets` | fixed assets | per feature | depreciation |
| `/finance/report` | finance report | per feature | reporting |
| `/rh` | hub (count cards) | `rh.view` | departments, job titles, positions, employees, contracts |
| `/rh/departments` | departments | `rh.department.view` | department CRUD |
| `/rh/job-titles` | job titles | `rh.jobtitle.view` | title CRUD |
| `/rh/positions` | positions | `rh.position.view` | position CRUD |
| `/rh/employees` | employees | `rh.employee.view` | employee list |
| `/rh/contracts` | contracts | `rh.contract.view` | employment contracts |
| `/rh/payroll` | payroll | payroll perms | payroll run |
| `/rh/payroll/[id]/slips/[slipId]` | pay slip | payroll perms | individual slip |
| `/rapports` | reports | `rapports.view` | reporting |
| `/parametres` | settings → `CompanySettingsCenter` (6 sub-tabs) | `parametres.view` (layout `parametres/layout.tsx:9`) | company, legal, fiscal, bank, branding, printing |
| `/parametres/branches` | branches manager | `parametres.view` + `parametres.manage` (actions) | branch CRUD, HEADQUARTER protection |
| `/parametres/taxes` | taxes | `parametres.view` | tax configuration |
| `/parametres/currencies` | currencies | `parametres.view` | currency list |
| `/parametres/units` | units | `parametres.view` | unit of measure |
| `/parametres/numbering` | numbering | `parametres.view` | document series config |
| `/parametres/preferences` | preferences | `parametres.view` | app preferences |
| `/parametres/referentiels` | referentiels | `parametres.view` | reference data |

### 3.3 Platform plane `(P)`

| Route | Nav group | Purpose |
|---|---|---|
| `/admin` | platform overview | admin control center |
| `/admin/companies`, `/admin/companies/nouveau` | companies | company CRUD |
| `/admin/users`, `/admin/users/sessions` | access | users + sessions |
| `/admin/security` | access | security settings |
| `/admin/audit` | monitoring | audit log |
| `/admin/analytics` | monitoring | platform analytics |
| `/admin/maintenance` | monitoring | maintenance |
| `/admin/settings` | system | platform settings |
| `/admin/backups` | system | database backups |

**Observation:** catch-all `[...module]` shows `<ComingSoon/>` for any unknown top-level path instead of a 404 — this misleads users into thinking missing modules exist but are in development (`[...module]/page.tsx`).

---

## 4. User Journey Map

### 4.1 Sales cycle

```
Quick Create "+" → Devis (/documents/quotation/nouveau)
  [No number preview — previewNextNumber is dead code, series.ts:46]
  → Save (number assigned on server at save time)
  → Status transition: DRAFT → PENDING_APPROVAL → APPROVED → INVOICED → PAID
  → Convert: Devis → Commande → Bon de livraison → Facture
  → Encaissement (registerPayment: finance/service.ts:123-213)
     → payment + allocations + journal entry (double-entry)
```

| Stage | UX concern |
|---|---|
| Create | No number preview; no inline customer quick-create; no duplicate-of-last-doc shortcut |
| Validate | Status transitions engine-driven; no visual "what happens next" indicator |
| Print | Format is company setting only; no in-UI A4/A5/THERMAL picker |
| Payment | `registerPayment` creates payment + allocations + journal entry — not visible on invoice detail until refresh |

### 4.2 Purchasing cycle

```
Quick Create "+" → Demande d'achat (/documents/purchase_request/nouveau)
  [MISMATCH: engine prefix = "achats.demande" (config.ts:156)
   but catalog/seed/quick-create use "achats.besoin.*" → UNREACHABLE]
  → Commande fournisseur → Bon de réception → Facture fournisseur → Paiement
```

| Stage | UX concern |
|---|---|
| Access | Purchase Request hub button hidden (permission prefix mismatch) |
| Create | Same dead `previewNextNumber`; same missing inline supplier quick-create |
| Receive | `hasDelivery: false` on purchase request; `hasDelivery: true` on goods receipt — correct but not explained in UI |

### 4.3 Stock / inventory

```
Products (/stock) — full CRUD, create form ~540 lines, sectionMore toggle (L507)
→ Warehouses (/stock/entrepots) — warehouse CRUD
→ Movements (/stock/mouvements) — adjust + transfer
→ Integrates with delivery notes (sales) and goods receipts (purchasing)
```

| UX concern |
|---|
| Monolithic create form — large but already uses progressive disclosure via `sectionMore` |
| No branch-scoped filtering in product list (branch context is header-only, company-wide data) |
| Stock summary shown on dashboard but no drill-through to product-level stock on dashboard alerts |

### 4.4 Accounting (comptabilité)

```
/comptabilite → mini ledger + treasury + journal
  → registerPayment (creates payment + allocations + journal: finance/service.ts:123-213)
  → postJournalEntry (double-entry: finance/service.ts:393-441)
  → sub-pages: tax-declarations, reconciliation, fixed-assets, report
```

| UX concern |
|---|
| Real double-entry engine exists but thin UX surface (single page + sub-pages) |
| No date range picker on ledger view (NOT VERIFIED at runtime) |
| No CSV/PDF export from journal |

### 4.5 HR (rh) — organisation + payroll

```
/rh hub (count cards) → departments | job-titles | positions | employees | contracts
→ payroll → /rh/payroll/[id]/slips/[slipId]
```

| UX concern |
|---|
| Hub is count-cards only — no summary statistics or alerts |
| Employees/contracts are separate lists — no "person-centric" view combining role + contract + payroll |
| Polish level lower than sales path; large fieldsets without guided disclosure |

### 4.6 Company setup (onboarding)

```
Dashboard shows CompanySetupJourney (computeJourney, dashboard/page.tsx:424-433)
until: name set, branch exists, customer, supplier, product, warehouse, document created
→ dismiss via settings "onboarding.dismissed"
```

### 4.7 Platform admin (SUPER_ADMIN)

```
/admin → companies → users | sessions | security | audit | analytics | maintenance | settings | backups
```

---

## 5. Dashboard Audit

**Page:** `src/app/(app)/dashboard/page.tsx` + `src/components/dashboard/*`
**Guard:** `dashboard.view` (L68)

### What it delivers (VERIFIED — code-level)

| Zone | Component | Content |
|---|---|---|
| Welcome band | inline (L483-503) | Avatar, user name, company name, branch name, role label |
| **A — Financial Pulse** | `FinancialPulse` + `KpiCard` ×4 | Monthly revenue (% delta vs last month), receivables, monthly expenses, net cash flow |
| **B — Urgent Actions** | `PendingOperations` (top 8) + `AlertsFeed` (top 10) | Pending devis/commandes; overdue invoices (critical); overdue supplier invoices (warning); low stock (warning); recent activity (info) |
| **C — Visual Intelligence** | `RevenueChart` + `TopProductsChart` | 30-day revenue vs expenses trend (sampled every 3 days); top 5 products by volume |
| **D — Quick Access** | `QuickAccess` | 5 permission-filtered actions: create invoice, add customer, add product, create purchase order, create devis |
| Follow-up grid | inline (L574-729) | Top clients by balance; top products; upcoming payments; recent activity feed; recent documents |
| Onboarding | `CompanySetupJourney` | Shown when journey not dismissed |

### Audit findings

- **Strengths:** high data density with visible actionability; severity coding on alerts; empty states on charts/KPIs; permission-filtered quick actions; i18n throughout; `tabular-nums` on figures.
- **PERF:** ~30 `Promise.all` queries on every visit (`force-dynamic`, L114-213); no server-side caching. Fine for small data, degrades at scale. **NOT VERIFIED on a loaded DB.**
- **CLARITY:** Financial Pulse mixes periods: revenue is "this month"; receivables is "cumulative outstanding" — without explicit period labels, this misleads.
- **CLARITY (REQUIRES PRODUCT DECISION):** "Net cash flow" = monthly revenue − monthly supplier invoices; operating expenses are not modeled → number may mislead as "true cash flow." Recommend relabeling or adding expense categories.
- **ACTION:** `PendingOperations` "approve" action — server API transition verified in code (`transitions` map exists); actual button handler runtime behavior **NOT VERIFIED**.
- **URG:** Overdue invoice sort (L157-165) uses only `dueDate: asc` — nondeterministic tiebreaker among same-dueDate records. Minor.
- **ACC:** Charts render as SVG/div without `role="img"` or accessible label — screen readers see raw shapes.

---

## 6. Sidebar / Navigation Audit

**Files:** `src/components/shell/nav-config.ts`, `sidebar.tsx`, `app-shell.tsx`, `command-palette.tsx`

### Shell architecture (VERIFIED)

```
┌─ Sidebar (fixed w-60 desktop; drawer on mobile)
│   ├─ Logo + app name
│   ├─ Quick Create button (desktop: sm:block; mobile: in drawer)
│   └─ <nav> — companyNavGroups (grouped), adminNavGroups (SUPER_ADMIN only)
│
├─ Header (sticky h-14)
│   ├─ Hamburger (mobile only, lg:hidden)
│   ├─ CompanySwitcher (platform: badge; company: switcher)
│   ├─ BranchSelector (desktop only, hidden md:block)
│   ├─ Search trigger (Ctrl+K, desktop: sm:flex)
│   ├─ Quick Create (desktop only, sm:block)
│   ├─ NotificationCenter
│   ├─ ThemeToggle
│   ├─ LocaleToggle
│   └─ UserMenu
│
├─ CommandPalette (Ctrl/⌘+K)
│   ├─ pages (filtered mainNav + footerNav; /ventes, /achats stripped; /admin hidden for non-SUPER)
│   ├─ global search (globalSearch API, permission-scoped)
│   └─ recent documents
│
└─ <main> — page content
```

### Findings

- **Two navigation schemas coexist:**
  - **Sidebar** uses `companyNavGroups` (grouped — Accueil, Piloter, Opérer, Finance, Équipe, Configuration) at `sidebar.tsx:32-34`.
  - **Command Palette** uses flat `mainNav` + `footerNav` (`command-palette.tsx:52`), which still includes `/ventes`, `/achats`, `/rh/employees`, `/rh/contracts` — entries explicitly removed from the grouped sidebar (`nav-config.ts:42-46`).
  - Consequence: the palette and sidebar show different module sets. Users navigating via Ctrl+K see a different app than users navigating via the sidebar.
- **`/ventes` and `/achats` are redirect stubs** (`ventes/page.tsx`, `achats/page.tsx`): code `redirect("/documents")`, no guard — produce an invisible extra hop with no content.
- **Active state** (`sidebar.tsx:37`): `pathname.startsWith(href)` — correct for `/parametres/*`, exact-match for `/`.
- **No "collapse to icons"** on desktop — fixed `w-60`; Arabic labels risk overflow without `truncate` class (**NOT VERIFIED visually**).
- **Platform sidebar** (SUPER_ADMIN): admin groups appended at bottom, separated by divider (`sidebar.tsx:111-151`) — clear separation.
- **Permission filtering:** sidebar filters each group by `filterNav(items, permissions)` and hides empty groups (`sidebar.tsx:32-34`). Good. But when all groups are empty (missing seed grants), the sidebar is blank with no explanation.

---

## 7. Forms Audit

### Reference implementations

| Form | Location | Lines | Pattern | Verdict |
|---|---|---|---|---|
| Company settings (Phase 4) | `CompanySettingsCenter` + 6 sub-tabs | full | Tabbed, per-tab save, progressive disclosure (`Plus de détails`) | **Best-in-class** |
| Branches | `branches-manager.tsx` | full | Search/filter, wilaya→commune cascade, optimistic save, confirm dialog, responsive cards, validation (code/name/email), code uniqueness hint, HEADQUARTER tooltip | **Best-in-class** |
| Product create/edit | `products-manager.tsx` | L455-996 (~540 lines) | Single form, one save, `sectionMore` toggle at L507 | Heavy but improved |
| Customer/supplier | `business-partners/*` | moderate | Single-save; `?create=1` deep link | Acceptable |
| Document create (any type) | `components/documents/*` | varies | Client component, lines table, no number preview | Acceptable with gaps |
| Movement (adjust/transfer) | stock components | small | Simple form | Fine |

### Field classification (product form — `products-manager.tsx:455-996`)

| Field class | Fields | UX implication |
|---|---|---|
| **ESSENTIAL** | name, nameAr, sku (if used), type, selling price | Must appear first; visible by default |
| **DETAIL** | category, description, unit, minimumQuantity | Show in second section; visible after essential |
| **ADVANCED** | images, isactive, other metadata | Behind `sectionMore` toggle (L507) — correct progressive disclosure |
| **SYSTEM-GENERATED** | id, createdAt, updatedAt, companyId | Hidden from form; shown on detail/read views only |
| **RARELY USED** | vendor codes, internal notes, misc | Behind `sectionMore` or on detail page |

### Audit findings

- **Strengths:** coherent `components/ui` (Radix + shadcn); RTL-friendly; `Input`/`Select`/`Dialog`/`Toast` consistent; branches manager sets the reference pattern.
- **VAL (inconsistent validation):** branches and settings validate client-side (code/name/email required, email format, code uniqueness); product and legacy CRM forms rely mostly on server errors via `toast` after submit — no inline fast-fail, no `required` markers on many fields.
- **BLOB (monolithic forms):** product form is ~540 lines; `sectionMore` helps but is still a single save. Recommend Phase 4-style tabbed/stepper split for forms >1 screenful.
- **CONF:** No password-strength meter on `/compte` change-password (**NOT VERIFIED — runtime access unavailable**).

---

## 8. Tables Audit

### Reference implementations

| Table | Location | Features |
|---|---|---|
| Products | `products-manager.tsx:368-438` | Columns: Code, Name, Type, Category, Selling Price, Status, Actions. `ActionMenu` per row. Search + type/status filter. |
| Documents hub | `documents-hub-list` | Server-side initial load + client filter/sort/pagination. Type/status/search filters. Empty state. |
| Branches | `branches-manager.tsx` | Responsive card layout on mobile; search/type/status filter; optimistic save. |
| Employees/contracts | `rh/*` | Standard list with link to detail. |
| Dashboard lists | various (inline in dashboard/page.tsx) | Top clients, top products, upcoming payments — no pagination (capped top 5-6). |

### Audit findings

- **RESPONSIVE:** many `<table>`-based lists overflow on mobile (`xs` breakpoint). Branches was converted to card layout — the pattern exists but is not widely applied.
- **SORT:** inconsistent across screens; documents hub sorts server-side; products may not expose multi-column sort.
- **FILTER:** hand-rolled per screen (documents: q/status/type; products: search/type/status; branches: search/type/status). Good but drift-prone; a shared `TableViewToolbar` would reduce inconsistency.
- **PAGINATION:** page sizes vary; no shared `Pager` component in `components/ui`.
- **DENSITY:** no toggle (comfortable/compact).
- **EMPTY STATE:** all tables implement empty states — good.
- **BULK ACTIONS:** not present on any table — acceptable for an ERP of this scale.

---

## 9. Detail Pages Audit

| Entity | Detail route | Question: "Can the user understand the entity and immediately know what to do next?" |
|---|---|---|
| **Customer** | `/crm/customers/[id]` | Tabs for balance, transactions exist. Status, code, name visible. **Next action unclear:** no prominent "Create Invoice" or "View Documents" button. |
| **Supplier** | `/crm/suppliers/[id]` | Same structure as customer. |
| **Product** | inline dialog or detail | Edit in dialog; stock history only via `/stock/mouvements` (no drill-through from product). **Next action missing:** "View stock movements" link. |
| **Document (any type)** | `/documents/[type]/[id]` | Print button, status transitions, PDF. Number shown only after save. **Missing:** duplicate action, email/send action, "convert to next type" prominent CTA. |
| **Branch** | inline dialog (parametres/branches) | Edit + deactivation guard + HEADQUARTER tooltip. Good. |
| **Pay slip** | `/rh/payroll/[id]/slips/[slipId]` | Individual slip detail. |

**Overall verdict:** detail pages provide entity information but lack **prominent "next action" CTAs**. Users must know the workflow to find their next step — the UI doesn't guide them.

---

## 10. Document Lifecycle UX

**Engine:** `src/features/documents/engine/config.ts` (9 types, prefixes, statuses, transitions), `service.ts`, `series.ts`, `/documents` hub.

### VERIFIED findings

1. **MISMATCH-01 (HIGH):** `PURCHASE_REQUEST.permissionPrefix = "achats.demande"` (`engine/config.ts:156`) vs permission catalog `achats.besoin.*` (`auth/permissions.ts:207,212`; `quick-create.tsx:47`; `nav-config.ts:22`). The hub filters on `${prefix}.view`/`.create` (`documents/page.tsx:48-49`), so a user holding `achats.besoin.view` can **never see** Purchase Requests in the hub.

2. **Dead previewNextNumber (MEDIUM-HIGH):** `previewNextNumber()` at `src/features/documents/series.ts:46` has **zero callers**. Users save a document before learning its assigned number — a real manual-ERP expectation. The function exists and presumably works; it simply isn't wired into any form.

3. **Print format is setting-only (MEDIUM):** `Company.printFormat` (`A4`/`A5`/`THERMAL`) is read by `print/service.ts:63,84` and `print/renderer.ts:87-96` (THERMAL layout exists and branches correctly). But there is **no in-UI format picker** at the point of print action; the user must navigate to `/parametres` to change format. For a user printing a proforma on thermal vs A4, this is an unnecessary round-trip.

4. **Engine transitions are code-enforced (VERIFIED):** `SALES_TRANSITIONS`, `PURCHASING_TRANSITIONS` maps in `engine/config.ts` define allowed status flows. The API layer (`service.ts`) enforces these. Runtime button behavior on the dashboard's `PendingOperations` "approve" action **NOT VERIFIED**.

5. **Document hash / DGI compliance:** schema fields for invoice hashing exist — **NOT VERIFIED** in print output or document detail.

---

## 11. Search & Discovery

**Files:** `src/components/shell/command-palette.tsx`, `src/app/api/search/route.ts`, `src/features/search/server.ts`

- **Command Palette** (`Ctrl/⌘+K`): combines page navigation (`filterNav(mainNav+footerNav)`), global search (`globalSearch` API, permission-scoped), and recent documents. Strips `/ventes`/`/achats`; hides `/admin` for non-SUPER_ADMIN. Quick Create actions available as `QUICK_ACTIONS` (command-palette.tsx:25-31) — but **not** all Quick Create items from `quick-create.tsx` appear in the palette.
- **Global Search API** (`api/search/route.ts`): guards with `search.global`; queries across documents, customers, suppliers, products; scoped to `companyId` and `permissions`. Returns max 5 results per query; `recentDocuments(6)` on `?recent=1`.
- **Catch-all `[...module]` → ComingSoon** (`[...module]/page.tsx`): any unknown URL renders "coming soon" instead of 404 — this gives the false impression that more modules exist but are in development.

### Findings

- Palette + search are well-integrated (power-user entry point).
- No fuzzy/exact hints on search; no global customer/stock quick lookup beyond what `globalSearch` covers (documents + CRM + products).
- No keyboard shortcut for "+" to create from anywhere (palette navigates but doesn't create).
- Search result ranking/weighting NOT fully verified at runtime.

---

## 12. RBAC UX

**Files:** `prisma/seed.ts:207-274`, `src/features/auth/permissions.ts`, `src/features/auth/rbac.ts`, `sidebar.tsx`, `quick-create.tsx`, `command-palette.tsx`, `documents/page.tsx`

### Role architecture (VERIFIED)

Two planes: **SUPER_ADMIN** (global `UserRole`, no company) and **COMPANY_ADMIN** (per-company `RoleAssignment`). Server-authoritative via `requirePermission` + `apiGuardWithContext`. UI only filters visibility.

### Seed grant — reachability gap (VERIFIED, CRITICAL)

`prisma/seed.ts:249-274` grants COMPANY_ADMIN:

```
dashboard.view, crm.customer.*, crm.supplier.*, product.*, warehouse.*, inventory.*,
finance.payment.*, accounting.*, parametres.*, admin.company.view/update/membership.manage,
admin.audit.view, search.global, files.*,
production.*, rh.view + rh.department/jobtitle/position.*
```

**OMITTED from the seed:**
- `documents.read` → Documents hub hidden
- Every `ventes.*` → Sales nav hidden, all document quick-creates hidden
- Every `achats.*` → Purchasing nav hidden
- `compta.view` → Comptabilité hidden
- `rapports.view` → Reports hidden
- `rh.employee.*`, `rh.contract.*`, `rh.payroll.*` → HR sub-pages hidden

**Result:** fresh COMPANY_ADMIN sees only Dashboard + Customers + Suppliers + Stock + Production + Paramètres — with **no documents, no sales, no purchasing, no accounting, no reports, no HR employees**. This is a seed/configuration defect, not an enforcement bug.

### Paramètres dead-end (VERIFIED, MEDIUM)

- Layout gate: `parametres.view` only (`parametres/layout.tsx:9`).
- Action APIs use `parametres.manage` via `apiGuardWithContext` — server-side enforcement is correct.
- UI gap: a `parametres.view`-only user **sees** all settings screens but **cannot act** — no visible "read-only" notice or disabled controls. Looks broken, not restricted.
- Branch actions properly guarded at both page and component level.

### Hidden module affordance

When a module is permission-blocked, the sidebar simply omits it — no muted row, no tooltip, no "why is this hidden?" explainer. SUPER_ADMIN has no visibility into what a COMPANY_ADMIN can't see.

---

## 13. Multi-company / Branch UX

**Files:** `src/features/company/context.ts`, `company-provider.tsx`, `company-switcher.tsx`, `branch-selector.tsx`, `app-shell.tsx`

### Company isolation (VERIFIED)

- `prisma` (scoped) vs `prismaBase` (unscoped, admin-only) — correct structural separation.
- `runScoped` wraps every API handler — company context enforced per-request.
- SUPER_ADMIN without company → platform mode: no `CompanyProvider`, badge in header, admin nav only (`app-shell.tsx:46,102-113`).

### Branch context (partially VERIFIED)

- `BranchSelector` in header (desktop: `hidden md:block` L122) — **client-side state**.
- Most list pages query **company-wide** (`companyId`), not branch-filtered — inconsistent from the user's perspective.
- Branch selection does not propagate as a hard server filter for most queries — it's a UI convenience, not a data scope.

### Safety concern

- No accidental wrong-company operation possible (server-enforced).
- Accidental wrong-branch operation **possible** when branch filter is not applied (e.g., creating a document without branch association when user has selected a branch). Schema has `branchId` on some models — **NOT VERIFIED which models have it**.

---

## 14. RTL / Arabic / French UX

**Files:** `src/i18n/dictionaries.ts` (fr L4, ar L1843, en L3678 — strict typing, 5518 lines total)

### VERIFIED

- **Trilingual strict typing:** any added key must exist in all three locales — genuine structural strength.
- **RTL layout:** shell uses logical CSS props (`start-0`, `border-e`, `ps-60`, `ms-auto`) — correct RTL awareness.
- **Number formatting:** dashboard uses `deliveryLocale` + `currency` (`fr-FR`/`ar-DZ`/`en-US`) — correct.
- **Dual font loading:** IBM Plex Sans + IBM Plex Sans Arabic (confirmed via `localhost:3000` response HTML).
- **Locale toggle:** cycles through fr → ar → en (`user-menu.tsx:52-70`); persists via i18n provider.

### NOT VERIFIED — runtime access unavailable

- Visual Arabic layout: mirrored borders, icons, RTL table alignment, dialog direction.
- Arabic text overflow in fixed-width containers (sidebar `w-60`, table cells).
- Mixed-direction data (Arabic company name + French invoice number) rendering.

### Maintenance risk

Single 5518-line dictionary file — merge conflicts likely in team development. Recommend splitting by feature namespace.

---

## 15. Printing UX

**Files:** `src/features/print/service.ts` (L63,84), `src/features/print/renderer.ts` (L87-96)

### VERIFIED

- Print format is a **company-level setting** (`Company.printFormat`: `A4`/`A5`/`THERMAL`).
- Renderer branches on format: A4 layout (`renderer.ts:87`), A5 layout (`renderer.ts:90`), THERMAL 80mm layout (`renderer.ts:93-96`).
- `printHeader` and `invoiceFooter` are company settings rendered in all formats.
- There is **no in-UI format picker** at the point of print action — user must go to `/parametres` to change.

### NOT VERIFIED — runtime access unavailable

- Actual print output on a real printer (A4 vs A5 vs thermal paper).
- Whether the THERMAL layout properly trims headers/footers for 80mm paper.
- Whether invoice hash / DGI compliance fields appear in the printed output.
- PDF generation/download workflow (if any beyond `window.print()`).
- RTL print layout (Arabic text direction in print output).

---

## 16. Accessibility Audit

### VERIFIED (code-level)

- Semantic `<ul>/<li>` nav with `aria-current="page"` (sidebar.tsx:89).
- `aria-label` on icon-only buttons: hamburger L95, search L151, locale L58.
- `sr-only` label on locale toggle (user-menu.tsx:68).
- Dialog/alert roles via Radix primitives (`Dialog`, `Toast`, `Badge`).
- Loading and empty states consistently rendered.
- `focus-visible:` styles in `components/ui` — mostly consistent.

### NOT VERIFIED — runtime access unavailable

- Keyboard tab order through the full page.
- Focus trap behavior in dialogs/modals.
- Color contrast ratios (WCAG AA compliance).
- `aria-live` regions for async saves (sonner toast may handle; not verified).
- `lang`/`dir` correctness on dynamic locale switch.

### Gaps identified (code-level)

| Issue | Severity | Location |
|---|---|---|
| Charts (`revenue-chart`, `top-products-chart`, `kpi-card`) lack `role="img"` / `aria-label` | MEDIUM | `src/components/dashboard/*.tsx` |
| Color-only severity on alerts (no text "Critique" / "Warning" / "Info") | LOW-MEDIUM | `alerts-feed.tsx` |
| Table lists on mobile lack card alternative on `<xs>` breakpoint | MEDIUM | products-manager, documents-hub-list |
| Password-strength meter absent on `/compte` change-password | LOW | NOT VERIFIED — runtime access unavailable |

---

## 17. Design System Consistency

| Aspect | Status |
|---|---|
| **UI primitives** (`components/ui/*`) | Consistent Radix + shadcn: Button, Input, Select, Dialog, Card, Badge, Avatar, Skeleton, Toast. Strong. |
| **Icons** | Material Symbols inline strings with `text-[16px]`/`text-[20px]` — consistent sizing but hard-coded (no token). |
| **Spacing** | `p-4/p-6`, `space-y-6/8`, `gap-3/4` — internally consistent. |
| **Cards** | Used uniformly for lists, metrics, bandeaus. |
| **Status indicators** | `Badge` with `variant="secondary"` for status; alert severity via icon + color. |
| **Empty states** | Consistently rendered (`p-6 text-center text-sm text-muted-foreground`). |
| **Loading states** | `Skeleton` used in `components/ui`; consistent. |

### Inconsistencies

- `mainNav` (flat) vs `companyNavGroups` (grouped) — two representations of the same data, maintained separately (§6).
- `parametres-tabs.tsx` duplicates tab metadata vs `company-settings/config.ts`.
- Hard-coded icon sizes (`text-[16px]`, `text-[20px]`, `text-[18px]`) — no shared size token.

---

## 18. UX Anti-patterns

| # | Anti-pattern | Location | Severity | Impact |
|---|---|---|---|---|
| A1 | **Permission reachability gap** — COMPANY_ADMIN seed grants ~40% of modules invisible | `seed.ts:249-274` | CRITICAL | User sees blank sidebar with no explanation |
| A2 | **Permission key mismatch** — engine `achats.demande` vs catalog `achats.besoin.*` | `engine/config.ts:156` | HIGH | Purchase Requests unreachable even when permission exists |
| A3 | **Redirect stubs** — `/ventes` and `/achats` silently bounce to `/documents` | `ventes/page.tsx`, `achats/page.tsx` | MEDIUM | Empty extra hop; no content |
| A4 | **Dead number preview** — `previewNextNumber` exists but zero callers | `series.ts:46` | MEDIUM | Users save blindly without knowing their document number |
| A5 | **Monolithic forms** — product create is ~540 lines | `products-manager.tsx:455-996` | MEDIUM | Overwhelms new users despite `sectionMore` |
| A6 | **Dual nav schemas** — sidebar (grouped) vs palette (flat) | `nav-config.ts` | MEDIUM | Two different mental maps of the app |
| A7 | **No print format picker** — setting-only | `print/service.ts` | MEDIUM | Extra trip to `/parametres` for each format change |
| A8 | **Catch-all ComingSoon** — unknown URLs show "coming soon" not 404 | `[...module]/page.tsx` | LOW | False impression of unfinished modules |
| A9 | **Color-only alert severity** — no text labels | `alerts-feed.tsx` | LOW | Accessibility gap for color-blind users |
| A10 | **No inline party quick-create** in document forms | document forms | MEDIUM | User must leave form to create customer/supplier |
| A11 | **Settings read-only ambiguity** — `parametres.view` user sees editable UI they can't use | `parametres/layout.tsx:9` | MEDIUM | Looks broken, not restricted |
| A12 | **No per-record activity trail** — activity only on dashboard | `activity/service.ts` | LOW | No "who did what when" on individual records |

---

## 19. Prioritized Recommendations

| ID | Priority | Problem | Evidence | Recommendation | Classification | Type | Impact | Effort | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| R01 | P0 | COMPANY_ADMIN seed omits Documents/Sales/Purchasing/Comptabilité/Rapports/HR-employees | `seed.ts:249-274`; nav-config.ts:20-29; sidebar filtering | Extend seed grant to `documents.*`, `ventes.*`, `achats.*`, `compta.*`, `rapports.view`, `rh.employee.*`, `rh.contract.*`, `rh.payroll.*`; document the permission matrix | EXISTING | Security/RBAC UX | CRITICAL | S | High |
| R02 | P0 | Engine prefix `achats.demande` vs catalog `achats.besoin.*` | `engine/config.ts:156`; `permissions.ts:207,212`; `quick-create.tsx:47` | Reconcile to one canonical key; safe migration; update seed + nav + hub | EXISTING | Security/RBAC UX | HIGH | S–M | High |
| R03 | P1 | No document number preview before save | `series.ts:46` — `previewNextNumber` exists, zero callers | Wire `previewNextNumber` into doc create forms as a hint chip | EXISTING | UX | HIGH | S | High |
| R04 | P1 | Print format is setting-only (no per-action picker) | `print/service.ts:63,84`; `renderer.ts:87-96` | Add A4/A5/THERMAL picker on print action, defaulting to company setting | EXISTING | UX | MEDIUM | M | Medium |
| R05 | P1 | Settings visible but non-functional without `parametres.manage` | `parametres/layout.tsx:9`; server APIs use `parametres.manage` | Server-driven readOnly flag; disabled controls + "read-only" notice | IMPROVEMENT | Security/RBAC UX | MEDIUM | M | High |
| R06 | P1 | Detail pages lack "next action" CTAs | §9 audit: customer, product, document detail | Add workflow-aware CTAs (e.g. "Create Invoice" on customer; "View Movements" on product; "Convert to..." on document) | IMPROVEMENT | Workflow | MEDIUM | M | Medium |
| R07 | P2 | Dual navigation schemas (sidebar grouped vs palette flat) | `nav-config.ts`; `command-palette.tsx:52` | Single typed `ModuleDescriptor[]` feeding both sidebar and palette; remove duplication | ARCHITECTURAL CHANGE | Navigation/IA | MEDIUM | M | Medium |
| R08 | P2 | Dashboard "net cash flow" mislabeling | `dashboard/page.tsx:222` — revenue − supplier invoices only | Rename to "Solde facturé (ventes – achats)" or model operating expenses | IMPROVEMENT | UX / ERP Workflow | MEDIUM | M | Medium |
| R09 | P2 | Charts lack accessible summaries | `revenue-chart.tsx`, `top-products-chart.tsx`, `kpi-card.tsx` — no `role="img"` | Add `role="img"`, `aria-label`, textual data summary | IMPROVEMENT | Accessibility | MEDIUM | S | High |
| R10 | P2 | Monolithic product/CRM forms (>1 screenful) | `products-manager.tsx:455-996` | Split into guided tabs/steppers reusing Phase 4 patterns | IMPROVEMENT | UI / Workflow | MEDIUM-HIGH | M–L | Medium |
| R11 | P2 | Branch context not propagated as server filter | `branch-selector.tsx` (client); most pages query company-wide | Persist branch selection; add "Toutes les succursales" filter on branch-aware lists | NEW FEATURE | ERP Workflow / Multi-company | MEDIUM | M | Medium |
| R12 | P2 | No inline customer/supplier quick-create in document forms | document create forms; `quick-create.tsx:56,57` (separate flow) | Add inline party creation dialog within document forms | NEW FEATURE | Workflow | MEDIUM | M | Medium |
| R13 | P2 | `/ventes` and `/achats` are redirect stubs | `ventes/page.tsx`, `achats/page.tsx` | Make them real filtered hub views (`?side=sales` / `?side=purchasing`) or remove from nav | IMPROVEMENT | Navigation/IA | MEDIUM | M | Medium |
| R14 | P3 | Color-only alert severity (no text labels) | `alerts-feed.tsx` | Add visible "Critique" / "Warning" / "Info" text next to colored icons | IMPROVEMENT | Accessibility | LOW | S | High |
| R15 | P3 | Single 5518-line i18n dictionary | `src/i18n/dictionaries.ts` | Split by feature namespace with typed merge | IMPROVEMENT | Consistency | LOW | M | High |
| R16 | P3 | Catch-all `[...module]` → ComingSoon instead of 404 | `[...module]/page.tsx` | Render 404 + suggested actions; keep ComingSoon only for known placeholder modules | IMPROVEMENT | Navigation | LOW | S | High |
| R17 | P3 | No per-record activity panel | `activity/service.ts` (dashboard-level `listActivity(8)`) | Add activity history panel on documents, products, customers | NEW FEATURE | UX / Discoverability | LOW | M | Medium |
| R18 | P3 | Password-strength meter absent on `/compte` | NOT VERIFIED — runtime access unavailable | Add strength indicator + minimum requirements | NEW FEATURE | Security/RBAC UX | LOW | S | Medium |

---

## 20. Quick Wins (≤1 day, server-safe, no schema change)

| # | Change | Evidence | Effort |
|---|---|---|---|
| QW1 | Wire `previewNextNumber` into document create forms as a hint chip ("Prochain N°: BL-0042") | `series.ts:46` — function exists, zero callers | S |
| QW2 | Add visible text labels ("Critique" / "En retard" / "Info") next to alert severity icons | `alerts-feed.tsx` | S |
| QW3 | Add `role="img"` + `aria-label` + textual data summary to revenue-chart & top-products-chart | `revenue-chart.tsx`, `top-products-chart.tsx` | S |
| QW4 | Replace catch-all `[...module]` with 404 + suggested module links | `[...module]/page.tsx` | S |
| QW5 | Filter `/ventes` and `/achats` from `mainNav` (already filtered in palette) — align the two | `nav-config.ts:20,22` | S |
| QW6 | Add `required` markers + inline validation to product & CRM create forms (pattern from branches) | `products-manager.tsx`, `business-partners/*` | S |
| QW7 | Add `truncate` to sidebar link text for Arabic overflow protection | `sidebar.tsx:101-103` | S |
| QW8 | Extend COMPANY_ADMIN seed grant with `documents.*`, `ventes.*`, `achats.*`, `compta.*`, `rapports.view`, `rh.employee.*`, `rh.contract.*` | `seed.ts:249-274` | S |
| QW9 | Add permission explainer (SUPER_ADMIN tooltip or muted row) when a module is hidden due to missing permission | sidebar filtering; no explainer currently | S |
| QW10 | Add a "View Stock Movements" link on product detail; add "Create Invoice" link on customer detail | §9 detail page audit | S |

---

## 21. Medium-Term Improvements (1–2 sprints)

| # | Change | Dependencies |
|---|---|---|
| MT1 | Permission-matrix documentation (`docs/rbac/matrix.md`) + seed-level enum reused by engine/nav/quick-create to prevent future drift | R01, R02 resolved |
| MT2 | Shared DataTable component (columns, sort, pagination, responsive cards-on-mobile, row actions, density toggle) — harvest from documents hub + products + branches | Existing table implementations |
| MT3 | Split product & CRM create forms into guided tabs/steppers reusing Phase 4 patterns (progressive disclosure + per-section save) | DataTable component |
| MT4 | Print format picker (A4/A5/THERMAL) on document print action, defaulting to company setting; verify THERMAL layout on 80mm device | R04 resolved; device test |
| MT5 | Branch-scoped filtering: persist branch in localStorage, ship to server; add "Toutes les succursales" filter on branch-aware lists | Schema verification of `branchId` columns |
| MT6 | Finance/Comptabilité surface upgrade: richer ledger filters, date ranges, CSV/PDF export of journal, reconciliation status inline | Real double-entry engine (`finance/service.ts`) already exists |
| MT7 | Per-record activity panel (reuse `listActivity`) on documents, products, customers | `activity/service.ts` |
| MT8 | i18n split by feature namespace (fr/, ar/, en/) with typed merge — keep strict trilingual invariant | Current single-file dictionaries.ts |

---

## 22. Long-Term Improvements (1+ months)

| # | Change | Scope |
|---|---|---|
| LT1 | **Unified navigation kernel** — single typed `ModuleDescriptor[]` per feature (label, icon, href, permission, quickActions, subHubs) consumed by sidebar, palette, quick-create, and nav-config | Architecture |
| LT2 | **Federated print pipeline** — company default + per-doc override, A4/A5/THERMAL, PDF download, email; localized template inheritance (invoiceFooter per doc type) | Print |
| LT3 | **Guided document creation wizard** — step-by-step (party → lines → settings → review) with number preview, draft persistence, duplicate detection | Document engine UX |
| LT4 | **Accessibility programme (Phase D)** — full WCAG pass: chart summaries, dialog focus traps, color-contrast audit, keyboard-first flows, `lang`/`dir` automated checks | Quality |
| LT5 | **Performance hardening** — dashboard `Promise.all` → `React.cache` / data layer; virtualized lists; server cache-control; request coalescing | Performance |
| LT6 | **Analytics-driven UX health** — instrument action success (create → validate → collect funnel) to detect dead flows | Analytics |

---

## 23. What Should NOT Be Changed

| Element | Why it should be preserved |
|---|---|
| **Server-side-only authorization** (`requirePermission`, `apiGuardWithContext`, `runScoped`) | The single most important architectural decision. All enforcement is server-authoritative. UI filtering is presentational only. Never weaken this. |
| **Strict company scoping** (`prisma` scoped client, `companyId` on every business model, `prismaBase` only for platform/admin) | Multi-company data isolation is structural and correct. Never widen the scope. |
| **The 9-type document engine with transition maps** (`engine/config.ts`) | The spine of all commercial operations. Evolve by adding types/transitions via config, never by bypassing the engine. |
| **Double-entry accounting engine** (`finance/service.ts`: `registerPayment`, `postJournalEntry`) | Real financial postings with proper debit/credit allocation. Do not mock or simplify for UX. |
| **Phase 4 settings tabs + branches manager** | The reference UX pattern: tabbed progressive disclosure, per-section save, wilaya/commune cascade, HEADQUARTER protection, responsive cards. Reuse this pattern; don't rewrite. |
| **SUPER_ADMIN/no-company platform plane** (`isPlatform`, badge, no `CompanyProvider`, isolated admin nav) | Correct and clear separation between platform admin and company operations. |
| **Strict trilingual i18n typing** (`dictionaries.ts` with `typeof fr`) | Any added key must exist in all three locales. This invariant prevents missing translations. Keep it even when splitting the file. |
| **Coming-soon for intentional placeholder modules** | Only change the catch-all 404 behavior for truly *unknown* routes — not for modules that are deliberately in development. |

---

## 24. Recommended Future Information Architecture

### Current → Problem → Proposed → Reason

**Issue 1: `/ventes` and `/achats` are redirect stubs**

- **Current:** `/ventes` → `redirect("/documents")`, `/achats` → `redirect("/documents")`. Nav shows them; palette filters them. Users arrive at empty redirects.
- **Problem:** Two empty hops that look broken; two different nav representations disagree about their existence.
- **Proposed:** Make them **filtered views of the Documents hub** (`/documents?side=sales`, `/documents?side=purchasing`) rendered by the same hub component with a pre-applied type filter.
- **Reason:** No duplicated logic; honest nav model; users get a sales-only / purchasing-only funnel without a redirect.
- **Impact:** nav-config.ts restructured; hub component accepts `side` param; palette and sidebar converge.

**Issue 2: Dual nav schema**

- **Current:** `mainNav` (flat, 13 entries) used by palette; `companyNavGroups` (grouped, 6 groups) used by sidebar. Maintained separately.
- **Problem:** Two representations of the same modules; edits to one don't propagate to the other; the two show different items.
- **Proposed:** A single `ModuleDescriptor[]` per feature (label, icon, href, permission, group, quickActions) — `nav-config.ts` derives both `companyNavGroups` AND palette items from this single source.
- **Reason:** Single source of truth; no drift; palette gets grouped results too.
- **Impact:** `nav-config.ts` restructured; `command-palette.tsx` consumes derived data.

### Proposed navigation tree (company plane)

```
Accueil
  └─ Dashboard

Piloter
  ├─ Clients
  ├─ Fournisseurs
  └─ Documents (hub — with side filter for Ventes/Achats)

Opérer
  ├─ Stock (Produits · Entrepôts · Mouvements)
  └─ Production (BOMs · Centres · Machines · Ordres)

Finance
  ├─ Comptabilité (ledger + treasury + journal)
  └─ Rapports

Équipe
  └─ RH (Départements · Postes · Employés · Contrats · Paie)

Configuration
  ├─ Paramètres (8 tabs)
  └─ Aide
```

Platform plane (SUPER_ADMIN) stays unchanged.

---

## 25. Implementation Roadmap (Phases A–E)

### Phase A — Access & Identity Fixes (P0)

**Objectives:** make all existing modules reachable by the company's primary role.
**Items:**
- Extend COMPANY_ADMIN seed grant with omitted permission families.
- Reconcile `achats.demande` ↔ `achats.besoin` (safe migration).
- Add permission-matrix documentation.
- Add "why is this hidden?" affordance for admins.
**Dependencies:** permission catalog audit; schema review.
**Risk:** low — grant extension is additive; key reconciliation requires migration.
**Exit:** fresh COMPANY_ADMIN sees Documents, Sales, Purchasing, Comptabilité, Reports, HR employees.

### Phase B — Document & Print UX (P1)

**Objectives:** reduce friction in the most-used commercial workflows.
**Items:**
- Wire `previewNextNumber` into document create forms.
- Add A4/A5/THERMAL print format picker at point of action.
- Verify THERMAL layout on 80mm device.
- Add "duplicate document" action on detail pages.
- Add inline customer/supplier quick-create within document forms.
- Add "next action" CTAs on detail pages.
**Dependencies:** Phase A (so documents are reachable).
**Risk:** low — all changes are additive UX improvements.
**Exit:** users never save to "discover" their document number; one-click print with format choice; detail pages guide next steps.

### Phase C — Navigation & Information Architecture (P2)

**Objectives:** unify the navigation model; eliminate dead hops.
**Items:**
- Single `ModuleDescriptor[]` schema feeding sidebar + palette + quick-create.
- Convert `/ventes`/`/achats` to filtered hub views (or remove from nav).
- Replace catch-all `[...module]` with proper 404.
- Remove `mainNav` duplication.
**Dependencies:** Phase A (correct permissions so all modules are visible in the unified nav).
**Risk:** medium — nav restructuring affects user muscle memory; ship with URL redirects for moved routes.
**Exit:** sidebar and palette show identical module set; no redirect stubs.

### Phase D — Accessibility & Quality (P2–P3)

**Objectives:** meet WCAG AA; close remaining consistency gaps.
**Items:**
- Chart summaries (`role="img"`, `aria-label`, textual fallback).
- Visible alert severity labels (color + text).
- Mobile responsive card layout for all table-based lists.
- `aria-live` on async saves.
- Color-contrast audit.
- Password-strength meter on `/compte`.
- Shared DataTable component (harvest from existing implementations).
**Dependencies:** Phases A–B (stable core workflows).
**Risk:** low — additive quality improvements.
**Exit:** automated a11y checks pass on core screens; no color-only states; shared DataTable used across all list views.

### Phase E — Scale & Structure (Long-term)

**Objectives:** performance hardening; maintainability; analytics.
**Items:**
- Dashboard query optimization (cache, coalescing, virtualized lists).
- i18n split by feature namespace.
- Per-record activity panels on documents/products/customers.
- Guided document creation wizards.
- Analytics instrumentation (create → validate → collect funnel).
- Federated print pipeline (company default + per-doc override).
**Dependencies:** Phases A–D (stable, accessible, performant core).
**Risk:** medium — architectural changes require careful testing.
**Exit:** core screens stay snappy at 10× data; team can merge i18n without conflict; dead UX flows are detectable.

---

## Appendix — Evidence Index

### Shell & Navigation
`src/components/shell/nav-config.ts`, `sidebar.tsx`, `app-shell.tsx`, `command-palette.tsx` (L25-60), `quick-create.tsx` (L31-77), `user-menu.tsx` (L46-70), `branch-selector.tsx`, `company-switcher.tsx`, `notification-center.tsx`

### Dashboard
`src/app/(app)/dashboard/page.tsx` (full, L60-732), `src/components/dashboard/{financial-pulse,kpi-card,pending-operations,alerts-feed,revenue-chart,top-products-chart,quick-access}.tsx`

### Documents & Engine
`src/features/documents/engine/config.ts` (L150-162: PURCHASE_REQUEST `achats.demande`), `src/features/documents/series.ts` (L46: `previewNextNumber` dead), `src/app/(app)/documents/page.tsx` (L23-49: hub registry + permission filter), `src/app/(app)/ventes/page.tsx`, `src/app/(app)/achats/page.tsx` (redirects)

### RBAC & Permissions
`prisma/seed.ts` (L207-274: role definitions; L249-274: COMPANY_ADMIN grant list), `src/features/auth/permissions.ts`, `src/features/auth/rbac.ts`

### Finance & Accounting
`src/features/finance/service.ts` (L123-213: `registerPayment`; L393-441: `postJournalEntry`), `src/app/(app)/comptabilite/page.tsx`, `src/app/(app)/finance/{tax-declarations,reconciliation,fixed-assets,report}/page.tsx`

### Production & HR
`src/app/(app)/production/page.tsx`, `src/app/(app)/production/{boms,work-centers,machines,orders}/page.tsx`, `src/app/(app)/rh/page.tsx`, `src/app/(app)/rh/{departments,job-titles,positions,employees,contracts,payroll}/page.tsx`

### Settings & Branches
`src/components/settings/{parametres-tabs,company-settings-center,branches-manager}.tsx`, `src/app/(app)/parametres/layout.tsx` (L9: `parametres.view` gate), `src/app/(app)/parametres/branches/page.tsx`

### i18n
`src/i18n/dictionaries.ts` (fr L4 / ar L1843 / en L3678, 5518 lines), `src/features/i18n/server.ts`, `i18n-provider.tsx`

### Search
`src/features/search/server.ts`, `src/app/api/search/route.ts` (L6: `search.global` guard; L23: permission-scoped)

### Cross-cutting
`src/features/company/api.ts` (`apiGuardWithContext`, `runScoped`), `prisma/seed.ts`, `scripts/migrate-company-settings.ts` (noted pending)
