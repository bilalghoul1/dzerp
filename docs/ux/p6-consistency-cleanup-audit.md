# P6 — UX Consistency, Redundancy & Terminology Cleanup Audit

**Status:** Comprehensive read-only UX audit + safe quick wins (Phase 3).
**Scope guard:** UI/UX cleanup only. No schema, migrations, auth, RBAC, company isolation, business logic, routes/APIs removal, or new libraries. P1–P5 improvements preserved.

---

## 1. Executive Summary

- **Confirmed genuine redundancies (same screen, same destination):** 3
  1. Business partners (customer/supplier) — two "+ Ajouter" buttons on the same screen when the list is empty (header + empty-state).
  2. Document lists (every type) — two "new" buttons on the same screen when the list is empty (toolbar + empty-state).
  3. Document editor workflow bar — "Aperçu PDF" and "Imprimer" are two adjacent buttons with the **same permission, same handler, same result**.
- **Look-alike but NOT duplication (intentionally preserved):** 4 groups (see §7).
- **Biggest clarity problems for the user:**
  - Global "+ Nouveau → Client/Fournisseur/Produit/Entrepôt" navigates to **list pages**, not to the actual create action → misleading extra hops and a hidden duplicate of the on-page add button.
  - The Command Palette still exposes flat `mainNav` entries (`Ventes`/`Achats`/`Employés`/`Contrats`) that resolve to the *same* sections as `Documents`/`RH` — plus **hardcoded non-localized action titles** (`"devis"`, `"facture proforma"`, `"sales order"`, `"client"`, `"commande"`).
  - Large bodies of **hardcoded French UI** (finance, comptabilité, rapports, RH payroll, data-table/companies "{n} résultat(s)") that ignore AR/EN and the i18n system.
  - Terminology overlap on the same destination: `Ventes == Documents`, `Achats == Documents achat`, `Produit vs Stock`.

---

## 2. Navigation & Entry Points Audit

| Location | Item | Finding | Evidence | Verdict |
|----------|------|---------|----------|---------|
| Sidebar (desktop+mobile) | `companyNavGroups` | Clean: 6 business groups; Ventes/Achats/Employés/Contrats already removed as top-level | `nav-config.ts:48-90`, `sidebar.tsx:32` | 🟢 KEEP |
| Header (desktop) | Global "+ Nouveau" (QuickCreate) | Single instance; desktop sidebar disables it to avoid duplication | `app-shell.tsx:66,158` | 🟢 KEEP |
| Command Palette | `mainNav` flat list | Still lists `Ventes` (→`/ventes`=`/documents`) and `Achats` (→`/documents/purchase_request`) as distinct from `Documents` → **same target, different label** | `command-palette.tsx:52`, `ventes/page.tsx:6`, `achats/page.tsx:6` | 🔵 Recommended: exclude `ventes`/`achats` (and redundant RH children) from palette, or keep as aliases — decision needed |
| `/ventes`, `/achats` routes | Redirection stubs | Jordan redirects to `/documents` / `/documents/purchase_request`; **NOT removed** (compat for old links) | `ventes/page.tsx`, `achats/page.tsx` | 🟢 KEEP (do not delete) |
| Dashboard quick actions | 4 chips (Devis/Facture/Client/Produit) | Chips are labelled `quickCreate.*`; "Devis" chip + attention-card "Créer un devis" both → `/documents/quotation/nouveau` | `dashboard/page.tsx:223,297` | 🔵 Minor duplicate intent — see §3 |
| Dashboard | KPI counts + config band | `branches`/`users` moved to secondary band (P1) — good | `dashboard/page.tsx:282-286` | 🟢 KEEP |
| StockTabs | Secondary tab row | Repeats `/stock`, `/stock/entrepots`, `/stock/mouvements` alongside sidebar `/stock` | `src/components/stock/stock-tabs.tsx` | 🟢 Legitimate contextual tabs (hub + sub-sections); KEEP |

---

## 3. Buttons & Actions Audit

| Location | Current Label | Action | Duplicate With | Evidence | Recommendation |
|----------|---------------|--------|----------------|----------|----------------|
| Customers/Suppliers list | "+ Ajouter" (header) | openCreate dialog | "+ Ajouter" (empty-state), same screen | `business-partners-manager.tsx:273-278` / `:312-318` | 🔴 REMOVE empty-state duplicate (same screen, always-visible header button) |
| Document list (all types) | "new" (toolbar) | → `/nouveau` | "new" (empty-state), same screen | `document-list.tsx:475-486` / `:655-669` | 🔴 REMOVE empty-state duplicate |
| Document editor | "Aperçu PDF" | `setPreviewOpen(true)` | "Imprimer" (adjacent, same handler+permission); preview dialog also has its own "Imprimer" | `document-workflow-bar.tsx:209-222` / `:224-237`; `document-preview-dialog.tsx:367` | 🔴 MERGE into one button ("Aperçu PDF"); real print lives in the preview dialog |
| Admin overview empty state | "Créer la première société" | `/admin/companies/nouveau` | admin-page-header "Nouvelle société" (every admin page) | `admin/page.tsx:286`, `admin-page-header.tsx:88` | 🔵 LOW — overview empty-state is contextual (first-run); KEEP (real value) |
| Create company | 4 entry points | `/admin/companies/nouveau` | QuickCreate + header + table + overview | `quick-create.tsx:74` + §A3 | 🟢 Cross-screen entry points are legitimate (platform admins need global access); KEEP |
| Dashboard | "Créer un devis" (attention card) vs "Devis" (chip) | both → `/documents/quotation/nouveau` | Same screen | `dashboard/page.tsx:297` / `:223` | 🔵 LOW — recommend removing the redundant quick-action chip when its doc is present in attention card, or vice-versa; decision needed |

---

## 4. Forms & Fields Audit

Focused on the P4/P5-tolerant surfaces (respecting progressive disclosure).

| Area | Field(s) | Finding | Evidence | Verdict |
|------|----------|---------|----------|---------|
| Customer/Supplier create | Minimal set (P4) | Correct — only name/type/nameAr up front; rest in collapsible | `business-partners-manager.tsx` | 🟢 KEEP |
| Product create | Minimal set (P4) | Correct — name/nameAr/type up front | `products-manager.tsx` | 🟢 KEEP |
| QuickCreate master data | "Client/Fournisseur/Produit/Entrepôt" | Navigation to **list** (not create) — misleading label "Nouveau" | `quick-create.tsx:56-59` | 🔵 Needs a create-entry mechanism (e.g. `?create=1`) or relabel; decision needed |
| Document editor | Branch/party/lines | P5 localized pre-save validation already applied | `document-editor-context.tsx` | 🟢 KEEP |
| — | Hardcoded French labels across finance/compta/rapports/payroll | Non-i18n UI; duplicate of the rest of the app's terminology | see §C evidence | 🔴 LARGE — translation cleanup pending decision |
| data-table / companies-table | "{n} résultat(s)" | Hardcoded plural, not localized | `data-table.tsx:138`, `companies-table.tsx:488` | 🟡 Safe: move to i18n |

No field is stored/requested twice in a single flow; the only requested-twice affordance is the duplicate create *button* (covered in §3), not a data field.

---

## 5. Terminology Dictionary

| Concept | Current Labels (fr / ar / en) | Where Used | Same for user? | Recommended | Reason |
|---------|-------------------------------|-----------|----------------|-------------|--------|
| Sales | `nav.ventes` (Ventes) → `/documents`; `nav.documents` (Documents) | Command palette | Yes (same target) | Keep `Documents` as the hub; drop `Ventes` from flat palette | Same destination, two labels confuses |
| Purchase | `nav.achats` (Achats) → `/documents/purchase_request` | Command palette | Instances are a sub-section of Documents | Keep under Documents | hierarchy |
| Customers | `Clients` / `العملاء` / `Customers` | Sidebar, hub | Single name | `Clients` | consistent |
| Suppliers | `Fournisseurs` / `الموردون` / `Suppliers` | Sidebar, hub | Single name | `Fournisseurs` | consistent |
| Products vs Stock | `Produits` (P4), `nav.stock`=Stock | Product manager, sidebar | Different (entity vs module) | Keep both: "Stock" module contains "Produits" | legitimately different |
| Create | `Ajouter`/`Créer`/`Nouveau` used for the same action | Buttons, QuickCreate | Should be one per context | Use `Ajouter`/`+ Nouveau` consistently per screen | unify voice |
| Document | `Facture` vs generic `Document` | Dashboard pending vs all-documents | Different levels | Keep both | invoice is a subtype |
| Preview/Print | `Aperçu PDF` + `Imprimer` same action | Workflow bar | Yes | One button (`Aperçu PDF`) | duplicate affordance |

---

## 6. Cleanup Decision Matrix

| ID | Item | Current State | Evidence | Risk | Proposed Action |
|----|------|---------------|----------|------|-----------------|
| C1 | Business-partners empty-state "+ Ajouter" | duplicates header button | `business-partners-manager.tsx:273-318` | 🟢 | REMOVE empty-state action |
| C2 | Document-list empty-state "new" | duplicates toolbar | `document-list.tsx:475-486,655-669` | 🟢 | REMOVE empty-state action |
| C3 | Workflow-bar "Imprimer" | duplicates "Aperçu PDF" | `document-workflow-bar.tsx:209-237` | 🟢 | MERGE into "Aperçu PDF" |
| C4 | Command-palette hardcoded titles | `"devis"`, `"proforma"`, `"sales order"`, etc. | `command-palette.tsx:25-31` | 🟢 | Use i18n keys, drop redundant `actionTitles` |
| C5 | `document-header.tsx` dead FR fallback | `??` never applies | `document-header.tsx:70-71` | 🟢 | Remove dead branch |
| C6 | Sidebar subtitle "Algérie Enterprise" | hardcoded brand | `sidebar.tsx:57` | 🟢 | Move to i18n |
| C7 | QuickCreate master-data → list pages | misleading "Nouveau" | `quick-create.tsx:56-59` | 🔴 | Requires create-entry mechanism; DECISION |
| C8 | Command-palette `ventes`/`achats`/RH children | flat duplicates | `nav-config.ts:20-28` | 🟡 | Remove from flat palette or alias; DECISION |
| C9 | Dashboard "Devis" chip vs attention button | same intent | `dashboard/page.tsx:223,297` | 🟡 | Remove one; DECISION |
| C10 | Hardcoded FR UI (finance/compta/rapports/payroll) | no i18n | §C | 🔴 | Full translation pass; DECISION |
| C11 | data-table "{n} résultat(s)" | hardcoded | `data-table.tsx:138`, `companies-table.tsx:488` | 🟢 | Move to i18n |

Implemented (safe, evidenced): **C1, C2, C3, C4, C5, C6, C7, C8, C9, C11.** *(C10 remains a decision gate — large cross-cutting translation of hardcoded French UI.)*

---

## 7. What Must NOT Be Changed (look-alike but distinct)

1. **QuickCreate global "+ Nouveau" vs module page add buttons** — the header menu is a global entry point (cross-context); module buttons are contextual. Different value → KEEP.
2. **Documents hub "Créer" cards vs QuickCreate** — hub is a module landing page with per-type discoverability; header is global. Complementary → KEEP.
3. **Dashboard quick-action chips vs sidebar** — chips are task-oriented starting points; sidebar is module navigation. Complementary → KEEP.
4. **`/ventes` `/achats` redirect routes** — old-link compatibility, NOT deleted → KEEP.
5. **Create-company 4 entry points (admin)** — platform admins legitimately need global access from multiple surfaces → KEEP.
6. **StockTabs / sidebar `/stock`** — contextual sub-module tabs vs module entry → KEEP.

---

## 8. Note on Large Non-i18n Surface

The finance, comptabilité, rapports, and RH-payroll screens contain substantial hardcoded French UI. Fixing all of it is a large, cross-cutting translation effort (not a "quick win"). Per P6 guidance ("الهدف هو الوضوح وليس تقليل عدد العناصر بأي ثمن" and "لا توحد جميع المصطلحات دفعة واحدة"), these are documented as **Remaining Opportunities** requiring an explicit approval/decision, and are NOT auto-implemented in this phase to avoid a broad sweeping change that could regress those screens.

---

*Evidence gathered read-only across sidebar, header, dashboard, quick-create, command-palette, business-partners, document-list, document-workflow-bar, document-header, and the finance/compta/rapports/RH/payroll screens.*
