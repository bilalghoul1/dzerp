# Phase 8.5 — Pre-Implementation Audit (GUIDED ERP)

**Project:** DzERP (Next.js 16 / React 19 / Prisma 7 / PostgreSQL)
**Date:** 2026-08-06
**Mandate:** Audit-first. Inspect every related file. Classify each requested feature.
Do NOT rewrite what already exists. Only improve what is genuinely missing.
**Scope guard:** UX only — no Document Engine / Business rules / Accounting / Workflow / Permissions / Prisma schema / DB / API contracts / Company isolation changes.

---

## Files audited

| File | Role | Relevant parts |
|------|------|----------------|
| `src/components/documents/document-workflow-bar.tsx` | Workflow transitions + Convert/Print/Duplicate/Save | 2,3,4,11,14,17 |
| `src/components/documents/document-preview-dialog.tsx` | PDF preview (pdfjs) with Print/Download/Close + zoom | 5 |
| `src/components/documents/document-sidebar.tsx` | Linked docs + conversion history + created/updated by | 3,11 |
| `src/components/documents/document-header.tsx` | Document header fields | 4(partial) |
| `src/components/documents/document-editor-context.tsx` | `save()` returns saved doc + `toast.success` | 1,9 |
| `src/components/documents/document-list.tsx` | Lists: clickable rows, duplicate/convert/remove, CSV, saved filters | 8,10 |
| `src/components/documents/document-editor-page.tsx` | Editor page (no redirect after create) | 1 |
| `src/components/feedback/empty-state.tsx` | Reusable EmptyState component | 8 |
| `src/app/(app)/page.tsx` | Dashboard (already action-oriented from UX.0) | 13 |
| `src/features/documents/framework/status-meta.ts` | Status badge meta (no explanation text) | 6 |
| `src/app/(app)/crm/customers/page.tsx` | Customers **list only** | 7 |
| `src/i18n/dictionaries.ts` | i18n keys | all |
| `src/components/documents/document-tabs.tsx`, `document-history.tsx`, `document-comments.tsx`, `document-attachments.tsx` | Tabs/related modules | 17(reuse) |

---

## Feature classification

### ✅ Already implemented correctly
- **PART 2 — Next Action Panel (workflow transitions):** `DocumentWorkflowBar` already renders
  status transitions per document type (Quotation→validate, Convert to next type, etc.) with
  status-aware button colors. Reuse, do not rebuild.
- **PART 3 / 11 — Workflow Timeline / Visual conversion chain:** `DocumentSidebar` already shows
  linked documents (conversion chain) + conversion history, clickable, with type icons/colors.
- **PART 4 — Document header actions (Save/Print/Preview/Duplicate/Convert):** all present in
  `DocumentWorkflowBar` (Print opens `DocumentPreviewDialog`, not direct print). Reuse.
- **PART 5 — Print Preview Dialog:** `DocumentPreviewDialog` fully implemented — large PDF canvas
  preview, zoom, page nav, **Print / Download PDF / Close** buttons, server-generated PDF reused.
  This IS the requested "Preview Dialog". No work needed.
- **PART 9 — Success feedback (toast):** `save()` already calls `toast.success(t("documentsUI.saved"))`;
  duplicate/convert also toast. Toast layer exists. (Banner part missing — see PART 1.)
- **PART 10 — Document lists:** already have clickable document number (`href=.../row.id`),
  clickable customer, row hover actions (view/duplicate/convert/remove), CSV export, **saved
  filters (presets in localStorage)**, bulk actions, large status badges. Mostly complete.
- **PART 13 — Dashboard:** already action-oriented from prior UX.0 phase — pending quotations/
  orders/deliveries/invoices, recent documents, quick "Nouveau" buttons. Complete.
- **PART 17 — No duplication:** PDF module, workflow bar, sidebar, history, conversion engine,
  search, permissions all exist and are reused. Confirmed.

### 🟡 Partially implemented
- **PART 8 — Smart empty states:** reusable `EmptyState` component exists AND is used in several
  managers (products, inventory, partners). However `document-list.tsx` uses its own inline
  `emptyList` message instead of `EmptyState`, and lists lack illustration + primary CTA button.
  → Gap: adopt `EmptyState` (illustration + description + primary action) in document lists and
  ensure every empty table has a primary CTA.
- **PART 14 — Reduce cognitive load (status-based actions):** `DocumentWorkflowBar` already hides
  approve/reject when no permission and disables actions on non-draft. Partial — could further
  hide advanced actions (payment/archive) not relevant to current status. Minor enhancement.
- **PART 15 — Responsive:** workflow bar already `flex-wrap`; sidebar/summary already responsive
  (collapses to single column < 2xl from prior v2/workspace phases). Stepper-on-mobile not explicit
  but acceptable. Minor.

### ❌ Missing (genuinely absent — the real work)
- **PART 1 — After-save experience:** `save()` returns the saved `DocumentDetailModel` (with `id`,
  `number`, `status`, `createdByName`, `partyName`, `branchName`, `issuedAt`) but **the editor page
  never redirects** to the new document after create, and there is **no large success banner**
  (number / status / creation time / created by / customer / branch / company). Only a toast.
  → Build: redirect to detail page after create (or stay + show banner) + large success banner.
- **PART 6 — Document status explanation:** `STATUS_META` has only badge variant + dot color — no
  human explanation string. Status shown only as a label. → Add an explanation map
  (Draft→"Editable", Approved→"Validated", Delivered→"Goods delivered", Invoiced→"Process complete",
  etc.) and display a short explanation next to the badge.
- **PART 7 — Customer Commercial Center:** **No `[id]` customer detail route exists** (`crm/customers`
  is list-only). The requested commercial hub (recent quotations/deliveries/invoices, payments,
  outstanding balance, turnover, timeline, quick actions) is absent. → This is a NEW page; it must
  read-only aggregate existing queries (no engine changes) and reuse existing components.

### Notes / not-yet-confirmed but likely present
- **PART 12 — Action suggestions (proactive):** not found in code; would be a new enhancement
  (e.g., Quotation idle 15d → suggest contact/convert). Mark ❌ (missing) unless proven otherwise.
- **PART 16 — Accessibility:** existing components use ARIA labels / focus styles broadly; verify
  during implementation but not a blocker.

---

## Conclusion — what to actually build (no duplication)

1. **PART 1:** Add post-create redirect + large success banner (reuse `save()` return value + `toast`).
2. **PART 6:** Add status-explanation map + render it beside `DocumentStatusBadge`.
3. **PART 7:** Create `crm/customers/[id]/page.tsx` commercial hub (read-only aggregation, reuse components).
4. **PART 8:** Swap document-list inline empty message for the `EmptyState` component with primary CTA.
5. **PART 12 (if in scope):** Add lightweight proactive suggestions (optional, post-MVP).
6. **Reuse** `DocumentWorkflowBar`, `DocumentSidebar`, `DocumentPreviewDialog`, dashboard, lists,
   `EmptyState`, permissions — do NOT rewrite.

Everything else (2,3,4,5,9,10,11,13,14,15,17) is already implemented — leave intact.

---

## Next step

Awaiting approval to proceed with implementation of the ❌/🟡 items above (PART 1, 6, 7, 8, 12),
reusing all existing modules. No code written yet.
