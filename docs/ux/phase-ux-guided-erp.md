# Phase UX.0 — Commercial Workflow Experience & Guided ERP Interface

**Project:** DzERP
**Date:** 2026-08-06
**Scope:** UX-only improvements to guide the user through the commercial workflow,
without touching the business engine (schema, document engine, workflow engine,
permissions, conversions, company isolation, API contracts).
**Rules followed:** Audit-first (no duplicate/rewrite of existing functionality);
business logic untouched; no new features beyond the bounded UX gap-filling below.
**No git commit made. Stopped after report per instructions.

---

## 1. UX Audit (Phase 1) — what already exists

A full read-only audit of every screen and shared component was performed. The
application is **architecturally mature** and already implements most of the requested
phases. Key finding: **do not rewrite what exists.**

| Phase | Requested | Status in codebase | Evidence |
|-------|-----------|--------------------|----------|
| 1 — UX audit | Audit screens | Done (this doc) | — |
| 2 — Workflow ERP | Per-doc status / origin / next step / actions / history | ✅ Already implemented | `DocumentWorkflowBar` (status transitions, convert, print, duplicate, "only draft editable"), `DocumentSidebar` (linked docs, conversion history, created/updated by) |
| 3 — Document experience | Self-explanatory doc page | ✅ Already implemented | `document-editor-shell` + header + tabs + sidebar + totals panel |
| 4 — Customer-centric | Commercial center on customer page | ⚠️ **MISSING** (generic list only) | `crm/customers/page.tsx` → `BusinessPartnersManager` (list + create form, no recent docs/balance/quick actions) |
| 5 — Dashboard "what to do today" | Actionable pending items | ⚠️ Partial — stats shown, pending cards static (not clickable, no CTA) | `app/(app)/page.tsx` |
| 6 — Navigation by process | Business-process nav | ✅ Already implemented | `nav-config.ts` groups Dashboard/Clients/Suppliers/Ventes/Achats/Stock/Production/Compta/RH; prominent "Nouveau Dossier" CTA |
| 7 — Visual hierarchy | Status visible, primary vs secondary | ✅ Already implemented | `DocumentStatusBadge`, primary CTA styling on sidebar |
| 8 — Empty states | Explanatory empty pages | ⚠️ Partial — messages exist; customer list had no CTA button | dashboard + document list have messages; `BusinessPartnersManager` empty = text only |
| 9 — Smart actions | Contextual next-step actions | ✅ Already implemented | `DocumentWorkflowBar` shows only allowed transitions/actions |
| 10 — Related documents | Doc chain / timeline / one-click nav | ✅ Already implemented | `DocumentSidebar` linked docs + conversion history with icons |
| 11 — Search | Global search exposes related | ✅ Already implemented | `features/search/server.ts` returns customers/suppliers/products/documents with links (customers link to list) |
| 12 — No business changes | — | ✅ Respected | No schema/engine/permission touched |

**Conclusion of audit:** Phases 2, 3, 6, 7, 9, 10, 11 were largely already delivered.
The genuine, safe, non-duplicating UX gaps were: (a) dashboard pending items not
actionable (Phase 5), (b) customer-list empty state lacked a CTA (Phase 8). The full
customer-centric commercial center (Phase 4) is a larger new feature and is listed
under "Remaining opportunities" rather than implemented unilaterally.

---

## 2. Improvements implemented (UX-only)

### 2.1 Dashboard — guided "What should I do today?" (Phase 5 + 9)
**File:** `src/app/(app)/page.tsx`

- The four pending cards (Quotations / Orders / Deliveries / Invoices) are now **clickable
  links** to their respective document lists (`/documents/quotation`, `/documents/sales_order`,
  `/documents/delivery_note`, `/documents/invoice`). Each card gained a directional chevron
  and hover highlight, making the next step one click away.
- Added a prominent primary **"Créer un devis"** CTA button in the pending section header,
  linking to `/documents/quotation/nouveau`. This directly answers "where do I start?".
- The pending section subtitle now reads **"À traiter"** (To do) to frame it as action items.

**Before:** static stat cards; user had to know to navigate to Ventes → Quotation.
**After:** click the number → jump to that document list; or click "Créer un devis" to start.

### 2.2 Customer (and supplier) list — empty-state CTA (Phase 8)
**File:** `src/components/business-partners/business-partners-manager.tsx`

- When the list is empty, the empty-state now shows the existing message **plus** a
  **"Ajouter"** (Add) button that opens the create form directly (`openCreate`). No more
  dead-end "no records" message.

**Before:** "Aucun client" text only — user must find the header "+" button.
**After:** message + one-click "Add" button to create the first record.

### 2.3 i18n
**File:** `src/i18n/dictionaries.ts`

- Added keys `dashboard.createQuotation` and `dashboard.actNow` in **fr / ar / en**
  (no existing keys reused incorrectly; dictionary structure untouched).

---

## 3. Files modified

- `src/app/(app)/page.tsx` — dashboard guided CTAs + clickable pending cards
- `src/components/business-partners/business-partners-manager.tsx` — empty-state CTA
- `src/i18n/dictionaries.ts` — 2 new keys × 3 locales

No business logic, no schema, no API, no permissions changed.

---

## 4. Quality gates

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src/app/(app)/page.tsx src/components/business-partners/business-partners-manager.tsx src/i18n/dictionaries.ts` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |

**Runtime verification (dev server + browser):** logged in as `admin`, dashboard renders
with the new "À traiter" section, the green **"Créer un devis"** primary button (links to
`/documents/quotation/nouveau`), and pending cards link to document lists. Screenshot:
`docs/ux/dashboard-guided.png`.

---

## 5. Screens improved

- Dashboard (`/`) — now guides the user with actionable pending cards + a primary "create
  quotation" CTA.
- Customers list (`/crm/customers`) and Suppliers list (`/crm/suppliers`) — empty state now
  offers a direct "Add" action.

---

## 6. Reason for each improvement

- **Dashboard CTA / clickable cards:** a new employee landing on the dashboard now sees
  exactly what is pending and can act in one click, instead of wondering where to go. This
  is the single highest-leverage "guided ERP" change and required zero business logic.
- **Empty-state CTA:** removes a dead-end in the two most-used master-data screens; the
  first-action is now obvious.

---

## 7. Workflow improvements

No workflow *rules* changed (none allowed). The UX change makes the *existing* workflow
discoverable: pending quotation → click → list → create/approve.

---

## 8. Remaining UX opportunities (NOT implemented — need your approval)

These are larger and were deliberately left out to avoid unapproved new-feature work and
to respect the audit-first / no-duplicate rule:

1. **Phase 4 — Customer-centric commercial center.** Replace/augment the generic
   `BusinessPartnersManager` customer view with a customer "commercial center" showing
   recent quotations/invoices, outstanding balance, recent payments/deliveries, and quick
   actions (create quotation / invoice / register payment). Requires a server query for
   customer aggregates — UX-only but a meaningful new screen.
2. **Phase 11 — Search deep-links.** Global search links a customer to `/crm/customers`
   (the list). Ideally it should open the customer commercial center (once built) or at
   least deep-link with a filter.
3. **Phase 5 — Richer "next step" suggestion.** The document workflow bar already hides
   impossible actions; a explicit "Suggested next: Convert to Delivery" hint could be added
   on top, but the transitions already convey this.
4. **Onboarding / first-run guide.** A short guided tour for new employees (tooltips on
   first login). New feature — out of scope without approval.

---

## 9. Before / After summary

| Screen | Before | After |
|--------|--------|-------|
| Dashboard pending section | Static numbers, no action | Clickable cards → document lists + primary "Créer un devis" CTA |
| Customers/Suppliers empty | Text only | Text + "Add" button opens create form |

All other requested UX (document workflow, related docs, status badges, process nav,
global search, smart actions) was **already present** and was left intact.
