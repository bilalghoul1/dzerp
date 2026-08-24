# DzERP — COMPANY_ADMIN UX/UI Audit & Dashboard Experience Review

> **Audit phase only.** No production code, RBAC, schema, database, authentication,
> authorization, company isolation, or business logic was modified. This document is a
> development-only analysis artifact. The implementation roadmap in §13 is a proposal,
> not executed work.

**Date:** 2026-08-23
**Auditor role:** Senior ERP Product Designer / UX Auditor / Information Architect / Frontend UX Engineer
**Scope:** Authenticated COMPANY_ADMIN experience (sidebar, header, dashboard, module entry points, settings, i18n, RTL/FR/AR).
**Active roles (unchanged):** `SUPER_ADMIN`, `COMPANY_ADMIN` only.

---

## 1. Executive Summary

DzERP's COMPANY_ADMIN experience is **technically sound but information-architecturally immature**.
The application is not broken — it is *over-exposed*. The single biggest problem is that the
navigation is a **flat list of 13 items with no grouping**, and several of those items are
**synonyms for the same destination** (Ventes/Documents/Achats all resolve into the documents hub;
RH/Employés/Contrats triple-expose the HR module).

The dashboard is genuinely better than typical ERPs — it has a greeting, contextual alerts, and
actionable pending items — but it presents **9 competing sections** and mixes internal/config metrics
(users, branches) with business KPIs, diluting "what matters today."

**UX maturity score: 58 / 100** (architecture strong, IA/wayfinding weak).

| Area | Score | Note |
|------|------:|------|
| Information architecture / navigation | 45 | flat, redundant, ungrouped |
| Dashboard clarity & actionability | 62 | good bones, too many sections |
| Wayfinding / discoverability | 50 | 3 doors to same place; no setup guidance |
| Visual design / consistency | 75 | clean, calm, professional |
| Internationalization (FR/AR/RTL) | 80 | solid RTL + bilingual, minor label gaps |
| Onboarding / first-run guidance | 30 | none — first-day journey is a blank dashboard |

**Biggest problems (top line):** (1) redundant top-level nav; (2) no grouping → cognitive overload;
(3) dashboard mixes priority tiers; (4) no new-company setup journey; (5) ambiguous "Documents" vs
"Ventes" vs "Achats" terminology.

---

## 2. Current Navigation Map (actual routes)

Source: `src/components/shell/nav-config.ts`, `src/components/shell/sidebar.tsx`,
`src/app/(app)/*/page.tsx`. `filterNav()` hides items the user lacks permission for.

| # | Sidebar label (FR) | Route | Permission | Resolves to | Purpose | Overlap |
|---|--------------------|-------|------------|-------------|---------|---------|
| 1 | Tableau de bord (Dashboard) | `/` → `dashboard/` | `dashboard.view` | dashboard | Company overview | — |
| 2 | Clients | `/crm/customers` | `crm.customer.view` | customer list | Manage customers | — |
| 3 | Fournisseurs | `/crm/suppliers` | `crm.supplier.view` | supplier list | Manage suppliers | — |
| 4 | **Ventes** | `/ventes` | `ventes.devis.view` | **redirect → `/documents`** | Sales entry | **= #6 Documents** |
| 5 | **Documents** | `/documents` | `documents.read` | documents hub | All commercial docs | **receives #4** |
| 6 | **Achats** | `/achats` | `achats.bon.view` | **redirect → `/documents/purchase_request`** | Purchasing entry | **subset of #5** |
| 7 | Stock | `/stock` | `product.view` | inventory hub | Products + warehouses | — |
| 8 | Production | `/production` | `production.view` | production hub | BOM/orders/machines | — |
| 9 | Comptabilité | `/comptabilite` | `compta.view` | accounting hub | Journals/accounts | — |
| 10 | RH | `/rh` | `rh.view` | HR hub (cards) | HR overview | **contains #11,#12** |
| 11 | **Employés** | `/rh/employees` | `rh.employee.view` | employees list | Employees | **child of #10** |
| 12 | **Contrats** | `/rh/contracts` | `rh.contract.view` | contracts list | Contracts | **child of #10** |
| 13 | Rapports | `/rapports` | `rapports.view` | reports | Analytics | — |
| F1 | Paramètres | `/parametres` | `parametres.view` | settings hub | Company config | — |
| F2 | Aide | `/aide` | — | help | Help | — |

Footer (`footerNav`): Paramètres, Aide. Admin groups render only for `isSuperAdmin`.

**Duplication proven by code:**
- `src/app/(app)/ventes/page.tsx` → `redirect("/documents")`
- `src/app/(app)/achats/page.tsx` → `redirect("/documents/purchase_request")`
- `src/app/(app)/rh/page.tsx` renders cards linking to `/rh/employees` and `/rh/contracts`,
  which are *also* top-level sidebar items (#11, #12).

---

## 3. Dashboard Audit (actual implementation)

Source: `src/app/(app)/dashboard/page.tsx` (455 lines).

### What it contains (9 sections)
1. **Greeting banner** — avatar, "Bonjour {name}", company · branch · role. *(good, humanizing)*
2. **5 stat cards** — Clients, Produits, Alertes stock, Succursales, Utilisateurs.
3. **"Act now" pending card** — Quotations/Orders/Deliveries/Invoices/Documents (clickable → doc lists).
4. **Top clients** (by balance).
5. **Top products** (by invoiced quantity).
6. **Upcoming payments** (unpaid/partial invoices by due date).
7. **Recent activity** (audit feed).
8. **Recent documents** (last 6).
9. *(implicit)* the greeting gradient banner.

### Clarity
- ✅ Within 10s a manager sees company name, role, and pending counts.
- ⚠️ The 5 stats mix **business** (clients, products, stock alerts) with **internal/config**
  (branches, users). A manager does not open the app to count users.

### Actionability
- ✅ Pending card items are links → the right doc list. Strong.
- ⚠️ "Top clients / Top products" are **read-only lists with no action** (no "view client", no filter).
- ⚠️ "Recent activity" is a log, not actionable.

### Priority tiers
- ✅ Pending + stock alerts + upcoming payments *do* encode urgency.
- ❌ They sit visually equal-weight to historical stats (top clients/products) and the log.

### Cognitive load
- ❌ **9 sections** before the fold is deep. The "Command Center" promise is diluted into a
  "wall of cards."
- ❌ Stat card #4 "Succursales" and #5 "Utilisateurs" are low-frequency for a daily manager.

### Workflow
- Partial. It answers "what needs attention?" (pending) but not "what should I do next?" beyond
  one "Créer un devis" CTA (only shown if `ventes.devis.create`).

### Minor defects (evidence)
- The pending card `<CardTitle>` uses `t("dashboard.pendingInvoices")` (line 239) although the card
  aggregates **all** doc types, not just invoices — misleading title.
- `clients`/`products` counts use `prisma.customer.count()` / `prisma.product.count()` **without a
  `companyId` filter in the call site** — they rely on the companyScope extension. Correct today,
  but the dashboard is the one place where a scope regression would be most visible.

---

## 4. User Journey Analysis

### Journey A — First day in a new company
- Entry: greeting banner shows the company name (good).
- **Problem:** No setup checklist. The dashboard shows empty states ("Aucun client", "Aucun produit")
  but gives **no guidance** on what to configure first (branch? warehouse? products? tax settings?).
- There is **no "essential vs optional" distinction** anywhere. A new owner cannot tell whether the
  company is "ready to operate."
- `NoCompanyScreen` / `MembershipAccessScreen` exist for *access* problems, but **nothing** for
  *configuration* readiness.

### Journey B — Normal working day (morning)
- ✅ Pending card + upcoming payments + stock alerts answer "what needs attention."
- ⚠️ To *act*, the user must leave the dashboard and know which nav item holds the function. With
  13 flat items (3 of them synonyms), the "where do I go?" cost is high.

### Journey C — Finding a business function
- Create customer: `Clients` (clear). Create product: `Stock` (label says "Stock", not "Produits" —
  minor mismatch). Check stock: `Stock`. Create commercial doc: **`Ventes` or `Documents`** (both work,
  confusingly). Review accounting: `Comptabilité` (clear). Manage employees: `RH` **or** `Employés`
  (two doors). → 1–3 navigation decisions, several with redundant entry points.

### Journey D — Business overview
- ✅ Dashboard is the single place — but it is data-dense, not decision-dense.

---

## 5. Duplication & Confusion Map

| Concept | Exposed as | Verdict |
|---------|-----------|---------|
| Commercial documents (sales) | `Ventes` (#4) **and** `Documents` (#5) | **Redundant** — Ventes redirects to Documents |
| Purchasing documents | `Achats` (#6) → `/documents/purchase_request` | **Redundant entry** into Documents |
| HR module | `RH` (#10) **and** `Employés` (#11) **and** `Contrats` (#12) | **Triple-exposure** — Employees/Contracts are children of RH hub |
| "Stock" vs "Produits" | Nav says `Stock` (#7); user mental model = "Produits" | **Label mismatch** |
| Dashboard pending card | Titled "Factures en attente" but shows all doc types | **Mislabeled** |

**Net effect:** 13 sidebar items resolve to ~9 real destinations; 4 are redundant exposures.

---

## 6. UX Findings (by severity)

### 🔴 Critical
**F1 — Redundant top-level navigation doors.** `Ventes`→`/documents`, `Achats`→`/documents/purchase_request`,
`RH`+`Employés`+`Contrats` all overlap. A manager cannot infer the "one obvious home" for a task.
*Location:* `nav-config.ts` lines 20, 22, 26–28. *Impact:* high hesitation, perceived complexity.
*Direction:* collapse to one primary entry per business task (see §9).

### 🟠 High
**F2 — Flat, ungrouped sidebar (13 items).** No "Business / Operations / Finance / Team / Settings"
structure. *Location:* `sidebar.tsx` renders `mainNav` as one `<ul>`. *Impact:* cognitive overload,
no scanning anchor. *Direction:* group into 5–6 labeled sections.

**F3 — Dashboard mixes priority tiers + 9 sections.** *Location:* `dashboard/page.tsx`. *Impact:*
dilutes "what matters." *Direction:* 4-question hierarchy (§10), demote internal stats.

**F4 — No new-company setup journey.** *Location:* none exists. *Impact:* first-day paralysis.
*Direction:* optional, dismissible setup checklist (§11).

### 🟡 Medium
**F5 — "Stock" label vs "Produits" mental model.** *Direction:* keep "Stock" but ensure the hub's
first tab is "Produits"; or relabel nav to "Produits & Stock."

**F6 — Dashboard pending card mislabeled** (`pendingInvoices` title for all-doc card).
*Location:* `dashboard/page.tsx:239`. *Direction:* use a generic "À traiter" title.

**F7 — Top-clients / Top-products / Recent-activity are non-actionable.**
*Direction:* link rows to detail; or move to a secondary "Analytics" area.

**F8 — Settings (`/parametres`) is a single item with 8 sub-pages** (branches, units, taxes,
currencies, numbering, referentiels, preferences). Fine as-is, but consider grouping under a
"Configuration" section so it doesn't compete with daily business items.

### 🟢 Polish
**F9 — Stat card icons use hardcoded Tailwind tones** (`bg-blue-500/10`, `bg-emerald-500/10`,
`bg-amber-500/10`) instead of the design-token palette used elsewhere — minor inconsistency with the
`bg-primary/10` pattern. *Location:* `dashboard/page.tsx:174–180`.

**F10 — Empty states are text-only** ("Aucun client"). Could add a contextual "＋ Ajouter" CTA.

---

## 7. Proposed Information Architecture (before → after)

> Based on **actual DzERP modules**. No invented features. Each task gets one primary home.

### BEFORE (current, flat)
```
Dashboard | Clients | Fournisseurs | Ventes | Documents | Achats |
Stock | Production | Comptabilité | RH | Employés | Contrats | Rapports
— footer: Paramètres | Aide
```

### AFTER (grouped, deduplicated)
```
ACCUEIL
  • Tableau de bord (Command Center)        /

PILOTER (Business / CRM + Sales + Purchase)
  • Clients & Fournisseurs                 /crm            (tabs: Clients / Fournisseurs)
  • Ventes & Documents                      /documents      (tabs: Devis, Commandes, BL, Factures…)
  • Achats                                  /documents?tab=achats  (or /documents/purchase_request)

OPÉRER (Operations)
  • Produits & Stock                        /stock          (tabs: Produits / Entrepôts / Mouvements)
  • Production                              /production

FINANCES
  • Comptabilité                            /comptabilite
  • Rapports                                /rapports

ÉQUIPE
  • Ressources humaines                     /rh             (hub: Départements, Postes, Employés, Contrats)

CONFIGURATION
  • Paramètres de l'entreprise              /parametres

— footer: Aide
```

**Deduplication rules applied:**
- `Ventes` and `Achats` become **tabs inside the single Documents entry** (the redirect targets
  already prove they are the same system). One primary home = `/documents`.
- `Employés` and `Contrats` become **sections inside the RH hub** (they already are, per
  `rh/page.tsx` cards). Removed as separate top-level items.
- `Clients` + `Fournisseurs` merged into one `CRM` entry with tabs (same `crm/` feature area).
- `Rapports` moved under Finances (it is analytics, not a daily-operations item).

This reduces 13 flat items → **6 grouped primary entries** (+ footer Aide).

---

## 8. Proposed Company Command Center (dashboard hierarchy)

Principle: **Action first. Information second. Decoration last.** Replace the 9-section wall with a
4-question flow, using data the app *already* provides (no new backend).

### A. Où en est mon entreprise aujourd'hui ? (situation, 1 row)
- Compact company header (already exists: greeting banner) + **1 KPI strip** limited to
  *business* metrics only: Chiffre d'affaires (du journal), Clients, Produits, Alertes stock.
- **Drop** "Succursales" and "Utilisateurs" from the primary strip → move to a "Configuration" footer
  or a secondary "Détails" expander.

### B. Que doit-il attirer mon attention ? (actionable alerts — the hero)
A single prioritized list (not 5 separate cards), each row → the right place:
- Devis / Commandes / BL en attente (→ `/documents/…`)
- Factures impayées / échues (→ `/comptabilite` / `/documents/invoice`)
- Alertes stock (→ `/stock`)
- Échéances de paiement à venir (→ upcoming payments)
- Tâches de production ouvertes (→ `/production`) — *if production data exists*

### C. Que veux-je faire maintenant ? (contextual actions)
Reuse the **existing `QuickCreate` groups** (Sales / Purchasing / Master Data) as a visible
"Actions" rail — it already filters by permission and is well-structured
(`components/shell/quick-create.tsx`). Promote it from header-only to a dashboard section.

### D. Comment l'activité évolue-t-elle ? (secondary)
Collapsed/secondary: Top clients, Top products, Recent activity, Recent documents — keep but below
the fold, clearly labeled "Historique / Tendances."

**Result:** a manager reads top→bottom: *situation → alerts → act → history.* No 9-card scramble.

---

## 9. New Company Onboarding Recommendation

**Justified: YES** (evidence: Journey A has no guidance; empty dashboard gives no "ready?" signal).

Propose an **optional, dismissible Setup Journey** (`/parametres/setup` or a first-run modal), driven
by *actual* DzERP config requirements observed in `prisma/seed.ts` and `/parametres/*`:

1. **Informations de l'entreprise** — already in company settings.
2. **Succursale** (`/parametres/branches`) — at least one branch (BranchSelector needs it).
3. **Référentiels** (`/parametres/referentiels`, taxes, units, currencies, numbering) — seed usually
   covers these; show as "Déjà configuré" when present.
4. **Clients / Fournisseurs** (`/crm`) — optional but recommended.
5. **Produits & Entrepôt** (`/stock`) — optional but needed before selling.
6. **Prêt à fonctionner** — summary + "Terminer."

**Constraints (per rules):**
- Never force data creation; every step skippable.
- Never create fake/demo data.
- Auto-dismiss / hide once the essential steps are satisfied (e.g., branch exists + ≥1 product or
  customer).
- Reflect only real DzERP requirements (no invented fields).

---

## 10. Arabic / French UX Review

**Strengths**
- Full bilingual dictionary `src/i18n/dictionaries.ts` (fr/ar/en keys present).
- RTL is handled: `dir="rtl"` on `<html>`, `rtl:-scale-x-100` on chevrons
  (`dashboard/page.tsx:274`), `start/end` logical properties in `app-shell.tsx`.
- Arabic labels exist for nav (`navEmployees: "الموظفون"`, etc.) and dashboard.

**Issues**
- **Long French labels** in a 240px sidebar: "Tableau de bord", "Ressources humaines" wrap or crowd
  the 20px icon. Grouped IA (§9) with shorter group headers mitigates this.
- **Mixed AR/FR business terms**: module names stay French ("Ventes", "Comptabilité") while some
  entities use Arabic. Consistent: keep French module labels (Algerian norm) but ensure *all* entity
  fields have `nameAr` (dashboard already falls back to `nameAr` for products/clients — good).
- **Terminology consistency**: nav says "Stock" but users think "Produits" (F5). Align label with the
  hub's primary tab.
- **"Documents" ambiguity in AR**: ensure `nav.documents` AR label matches the hub, not a literal
  translation that hides the sales/purchase split.

---

## 11. Visual UX Review

**Positive**
- Calm, professional palette (primary green tokens; `bg-primary/10` accents).
- Cards consistent; spacing (`gap-4`/`gap-6`, `p-4`/`p-6`) coherent.
- Empty states present (text); loading handled by `force-dynamic` + suspense patterns.
- Destructive actions use confirmation dialogs (seed copy shows
  `confirmDeletePermanent` verbiage).
- Dark/light theme toggles present and consistent (`ThemeToggle`).

**Negative**
- **Card overuse on dashboard** (F3): 9 cards compete; the "Command Center" feels like a stat board.
- **Hardcoded color tones** on stat icons (F9) break the token system slightly.
- **No visual priority hierarchy** between urgent (alerts) and historical (top clients) cards.
- **Mobile**: sidebar becomes a drawer (`lg:hidden` + `sidebarOpen`) — good; but the 13-item list is
  long to scroll on phones. Grouping (§9) helps.
- **Icon direction**: chevrons flip in RTL (good); ensure *all* directional icons (arrows,
  `chevron_right`) use the `rtl:-scale-x-100` pattern consistently (verify in module pages, not just
  dashboard).

---

## 12. Quick Wins (low risk, high value)

1. **Collapse `Ventes`/`Achats` into the Documents entry as tabs** (they already redirect there) —
   removes 2 redundant top-level items with zero backend change. *File:* `nav-config.ts`.
2. **Move `Employés`/`Contrats` out of the top-level sidebar** into the RH hub (they already live
   there) — removes 2 more redundant items. *File:* `nav-config.ts`.
3. **Fix the dashboard pending-card title** (`pendingInvoices` → generic "À traiter"). *File:*
   `dashboard/page.tsx:239`.
4. **Demote "Succursales"/"Utilisateurs" stats** from the primary strip (move to a "Détails"
   expander or Config). *File:* `dashboard/page.tsx:174–180`.
5. **Group the sidebar** into ACCUEIL / PILOTER / OPÉRER / FINANCES / ÉQUIPE / CONFIGURATION using the
   existing `NavGroup` type (already defined for admin). *File:* `nav-config.ts` + `sidebar.tsx`.
6. **Make Top-clients / Top-products rows clickable** (link to `/crm/customers/…`, `/stock`). Low
   effort, adds actionability. *File:* `dashboard/page.tsx`.
7. **Unify stat-icon tones** to `bg-primary/10 text-primary` (or a small token set) for consistency.
   *File:* `dashboard/page.tsx:174–180`.

---

## 13. Structural Improvements (deliberate implementation)

1. **Command Center rewrite** per §8 — 4-question hierarchy; promote `QuickCreate` groups into a
   dashboard "Actions" rail.
2. **New-company Setup Journey** per §9 — optional, dismissible, data-driven, no fake data.
3. **Tabbed module hubs** (CRM = Clients/Fournisseurs; Documents = sales/achats; Stock =
   Produits/Entrepôts/Mouvements) so one entry expands cleanly instead of many flat items.
4. **Priority visual language**: a small "Urgent / À suivre / Info" badge system on Command Center
   alerts (reuse `Badge` component already imported in dashboard).
5. **Search/Command Palette promotion**: `CommandPalette` (Ctrl+K) already exists and is powerful —
   surface it more (the dashboard could hint "Appuyez sur Ctrl+K pour tout trouver").

---

## 14. Recommended Implementation Roadmap

| Phase | Work | Risk | Depends on |
|-------|------|------|-----------|
| **P1 — Quick wins** | nav dedupe (QW1–QW2), dashboard title fix (QW3), demote stats (QW4), icon tones (QW7) | Low | none |
| **P2 — Grouped sidebar** | introduce `NavGroup` for company nav (QW5) | Low–Med | P1 |
| **P3 — Command Center** | 4-question dashboard (§8), promote QuickCreate rail, clickable rows (QW6) | Med | P1 |
| **P4 — Tabbed hubs** | CRM / Documents / Stock tabs | Med | P2 |
| **P5 — Setup Journey** | optional onboarding (§9) | Med | P3 |
| **P6 — Polish** | AR/FR label alignment, RTL icon audit, empty-state CTAs | Low | any |

**Success criterion (from brief):** after P1–P3, a COMPANY_ADMIN can
*log in → understand the situation → know what needs attention → know what to do next → find every
major function naturally* — without training.

---

## Files inspected (evidence base)

- `src/components/shell/nav-config.ts` — navigation definition (13 items, admin groups).
- `src/components/shell/sidebar.tsx` — sidebar rendering (flat `<ul>`, admin section).
- `src/components/shell/app-shell.tsx` — header, CompanySwitcher, BranchSelector, QuickCreate,
  NotificationCenter, CommandPalette, no-company handling.
- `src/components/shell/quick-create.tsx` — grouped contextual actions (Sales/Purchasing/Master/
  Admin).
- `src/app/(app)/layout.tsx` — auth + company-context resolution, NoCompanyScreen,
  MembershipAccessScreen.
- `src/app/(app)/dashboard/page.tsx` — 455-line dashboard (greeting, stats, pending, clients,
  products, payments, activity, docs).
- `src/app/(app)/ventes/page.tsx` — `redirect("/documents")`.
- `src/app/(app)/achats/page.tsx` — `redirect("/documents/purchase_request")`.
- `src/app/(app)/rh/page.tsx` — HR hub with cards → /rh/employees, /rh/contracts.
- `src/app/(app)/documents/page.tsx` — documents hub (permissions-filtered).
- `src/app/(app)/parametres/*` — 8 settings sub-pages.
- `src/i18n/dictionaries.ts` — fr/ar/en labels (nav, dashboard, rh).

## Files changed

**None.** This is an audit-only artifact. No application code, RBAC, schema, database,
authentication, authorization, company isolation, or business logic was modified. The only file
created is this report: `docs/ux-audit/company-admin-ux-audit.md`.

## Confirmation

✅ No RBAC/auth/database/schema/business-logic changes. ✅ No new roles. ✅ Audit-first, no
redesign executed. ✅ Recommendations are additive (navigation regrouping, dashboard reorder) and can
be implemented without touching the two active roles or the company-isolation model.
