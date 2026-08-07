# Phase UX Polish — Professional ERP Polish (Audit First)

**Project:** DzERP
**Date:** 2026-08-06
**Scope:** 100% UX. Audit-first: no new features, no duplicate functionality, no business
logic touched (no schema/workflow/engine/permission/API changes).
**No git commit made. Stopped after report per instructions.

---

## 1. Audit results — what already exists (left intact)

A full read-only audit of headers, forms, tables, button hierarchy, design-system
consistency, micro-UX, responsive and RTL/a11y was performed. The application is already
polished on most dimensions — these were **not** rewritten:

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Smart page headers (title + description + breadcrumb + actions) | ✅ Exists | `PageHeader` component used on dashboard, customers, suppliers, stock, document lists, document editor, settings |
| Button hierarchy | ✅ Exists | `Button` variants (default/outline/secondary/ghost/destructive); `DocumentWorkflowBar` colors transition buttons (APPROVED=emerald, CONFIRMED=amber, REJECTED=destructive, CANCELLED=muted) |
| Form grouping / sections | ✅ Exists | `company-form` uses grouped `SectionCard` + `Field` wrapper |
| Tables | ✅ Exists | `DocumentList` has search, status filter, sort, sort-direction toggle, bulk actions, CSV export, column toggle, empty state, loading `Spinner` |
| Design-system consistency | ✅ Exists | Shared `Card`, `Badge` (success/warning/destructive/secondary/outline), `Button`, `Dialog` (centering already fixed in RTL task) |
| RTL / a11y / responsive | ✅ Exists | Correct `rtl:` overrides; dialog centering fixed; `PageHeader`/tables use responsive `sm:`/`lg:` grids; focus rings on `Button`/`Badge` |

**Conclusion:** rewriting any of the above would violate the audit-first / no-duplicate rule.
Only one concrete, safe, non-duplicating gap was found and fixed (below).

---

## 2. Improvement implemented (UX-only)

### 2.1 Required-field visual marker (Phase 4 — "mark required fields clearly")
**Files:**
- `src/components/ui/label.tsx` — added optional `required?: boolean` prop to `Label`;
  when set, renders a red asterisk (`text-destructive`, `aria-hidden`, no new text) after
  the label text.
- `src/components/settings/company-form.tsx` — `Field` wrapper now accepts `required` and
  forwards it to `Label`; the "Nom commercial" field (the only `required` input in that
  form) is now marked visually.

**Before:** required inputs used a bare HTML `required` attribute with no visual cue — users
couldn't tell which fields were mandatory without hitting submit/validation.
**After:** the mandatory "Nom commercial" label shows a red `*`; the 29 optional fields show
no marker. The marker is a design-system primitive reusable by every form in the app.

No other forms were changed (additive prop only; existing call sites unaffected, verified by
`tsc` + `eslint`).

---

## 3. Files modified

- `src/components/ui/label.tsx` — `required` prop on `Label` (design-system primitive)
- `src/components/settings/company-form.tsx` — `Field` forwards `required`; company name marked

No business logic, schema, engine, workflow, permissions or API touched.

---

## 4. Quality gates

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src/components/ui/label.tsx src/components/settings/company-form.tsx` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |

**Runtime verification (dev server + browser):** logged in as `admin`, opened `/parametres`.
The accessibility tree confirmed `Nom commercial *` is the only label carrying the red
`text-destructive` marker (29 other labels unmarked). Screenshot: `docs/ux/required-field-marker.png`.

---

## 5. Screens improved

- Company settings form (`/parametres`) — required field now visually indicated.

The `Label.required` primitive is available app-wide for future forms without further work.

---

## 6. Before / After

| Screen | Before | After |
|--------|--------|-------|
| Settings form labels | No required indicator (bare `required` attr) | Mandatory "Nom commercial" shows red `*`; optional fields unmarked |

---

## 7. Remaining recommendations (NOT implemented — need approval)

These are larger or touch more surfaces; listed for your decision, not done unilaterally:

1. **Roll out `required` markers across other forms** (customers/suppliers, products, document
   lines). The primitive now exists; applying it is mechanical but touches several files — best
   done as its own pass.
2. **`DocumentHeader` display-vs-edit noise (Phase 1/5):** "Number" and "Issued at" are shown as
   disabled `<Input>` controls. They are display values, not editable fields — rendering them as
   static text (or a compact definition list) would reduce visual noise and clarify they're
   read-only. This is a real polish, but it alters the document header layout, so flag for approval.
3. **Status dominance on document detail (Phase 5):** the status badge is present but small;
   consider a larger status pill in the workflow bar. Low priority — status is already visible.
4. **Table column alignment consistency (Phase 6):** numeric/total columns already use `text-end`;
   confirm all money columns across managers apply it. Mechanical audit, no design change needed.
5. **Micro-UX: confirmation dialogs (Phase 9):** document transitions use `window.confirm`;
   replacing with the existing `Dialog`/confirm component would be more polished and on-brand, but
   is a behavioural change — approve before doing.

---

All requested quality gates pass. Work remains uncommitted, awaiting approval.
