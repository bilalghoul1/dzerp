# RTL Dialog / Modal Centering — Root Cause & Permanent Fix

**Project:** DzERP
**Date:** 2026-08-06
**Component affected:** `src/components/ui/dialog.tsx` (`DialogContent`)
**Severity:** Visual (RTL only) — dialogs shift right of center in Arabic mode

---

## 1. Symptom

In Arabic (RTL) mode, centered dialogs/modals (forms, CRUD, confirmations, document
dialogs, settings, search, etc.) were not perfectly centered: they appeared shifted
to the right of the screen. The bug was invisible in French/English (LTR) and only
appeared **after switching the language to Arabic**.

## 2. Dialog system (investigation)

- **Library:** Radix UI Dialog (`@radix-ui/react-dialog`), version per `package.json`.
- **Shared component:** `src/components/ui/dialog.tsx` is the single source of truth.
  All centered modals flow through its `DialogContent`.
- There is **no** separate `Sheet`, `AlertDialog`, or `ContextMenu` component in the
  repo. Confirmations use `feedback/modal.tsx` (`Modal` / `ConfirmModal`), which itself
  renders `DialogContent`. So fixing `DialogContent` covers every dialog.
- **Popover / DropdownMenu** are anchor-positioned by Radix (direction-aware) and are
  **not** centered, so they were never affected and needed no change.
- **Centered dialogs consuming `DialogContent`** (verified via import scan):
  - `feedback/modal.tsx` → all `ConfirmModal` usages (delete / approve / print / settings / search)
  - `business-partners/business-partners-manager.tsx`
  - `products/products-manager.tsx`
  - `warehouses/warehouses-manager.tsx`
  - `inventory/inventory-manager.tsx`
  - `settings/branches-manager.tsx`, `settings/lookups-manager.tsx`
  - `documents/document-convert-dialog.tsx`, `documents/document-preview-dialog.tsx`
  - `shell/command-palette.tsx` (note: intentionally uses `top-[18%]`, not centered)
  - `shell/user-menu.tsx` (Profile / Change Password / Sessions dialogs)

## 3. Root cause

The `DialogContent` className contained:

```tsx
"fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg
 -translate-x-1/2 -translate-y-1/2 …
 sm:rounded-lg rtl:translate-x-1/2"
```

- In **LTR**, `left: 50%` places the element's left edge at the horizontal center of the
  viewport, and `-translate-x-1/2` (`transform: translateX(-50%)`) shifts the element
  left by half of **its own width** → perfectly centered. ✅
- When the user switches to Arabic, `i18n-provider.tsx` (and the bootstrap script) set
  `dir="rtl"` on `<html>`. That activates Tailwind's `rtl:` variant, so
  `rtl:translate-x-1/2` (`transform: translateX(+50%)`) **overrides** `-translate-x-1/2`.
- Net result in RTL: `left: 50%` + `translateX(+50%)` → the dialog is pushed **right** by
  half its width → off-center, partly clipped on the right edge. ❌

**Why only after switching language:** the `rtl:` override is inert in LTR, so the bug
is invisible until `dir` flips. The underlying cause is a **physical `translate-x` axis
combined with a direction-mirrored override** — i.e. the fix assumed RTL needs a
flipped translate, but `left-1/2` + `-translate-x-1/2` is already symmetric and
direction-agnostic.

## 4. The fix (one change, no CSS hacks, no hardcoded positions)

Removed the erroneous `rtl:translate-x-1/2` override. The final `DialogContent` className:

```tsx
"fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg
 -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200
 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0
 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
 sm:rounded-lg"
```

This is **direction-agnostic**:
- `left`/`top` are physical axes relative to the viewport (not affected by `dir`).
- `-translate-x-1/2` / `-translate-y-1/2` are relative to the element's **own** box, so
  the centering math is identical in LTR and RTL.

Because all dialogs share this single component, the fix covers **every** current and
future dialog automatically — no per-page patching, no duplicated CSS.

**Files modified:**
- `src/components/ui/dialog.tsx` (only the `DialogContent` className + explanatory comment)

## 5. Why the solution is permanent

- The centering is expressed purely with ratios (`50%` and `-50%`), so it holds for any
  viewport width, any browser zoom (125% / 150% / 200%), ultrawide, and small screens.
- It relies on the existing, well-tested `left-1/2 -translate-x-1/2` idiom (the same one
  Tailwind/shadcn use by default) instead of a fragile direction-specific override.
- Adding a new dialog that uses `DialogContent` inherits the fix with zero extra work.

## 6. Validation

### Automated (quality gates)
| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src/components/ui/dialog.tsx` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 (all routes compiled) |

(Note: `npm run lint` maps to `eslint`; `next lint` is removed in Next 16.)

### Runtime (browser, real app)
Measured the actual `[role="dialog"]` bounding box vs. viewport center.
Offset reported as `% of viewport` from center on each axis (0.00% = perfect center).

| Scenario | `dir` | viewport | offset X | offset Y | Result |
|----------|-------|----------|----------|----------|--------|
| Profile dialog | `rtl` (ar) | 1264×625 | **0.00%** | **0.00%** | ✅ centered |
| Profile dialog | `ltr` (fr) | 1264×625 | **0.00%** | **0.00%** | ✅ centered (no regression) |

- `transform` computed style on the dialog is `none` (the RTL override is gone).
- Centering uses percentage ratios, so it is mathematically invariant to browser zoom;
  verified static at 100% and guaranteed for 125%/150%/200%/ultrawide/small by the
  ratio-based formula. Manual browser-zoom re-check is recommended as a final visual pass.

### Screenshot
`docs/ui/rtl-dialog-rtl-profile.png` — Profile dialog rendered in Arabic (`dir=rtl`),
visually centered, right-aligned text, close button in the top-left (correct for RTL).

## 7. Accessibility (unaffected)
- Focus trap, ESC-to-close, overlay click, and Radix keyboard navigation are provided by
  Radix `Dialog` and were **not** touched → unchanged.
- Screen-reader semantics (`role="dialog"`, `aria-labelledby` via `DialogTitle`) unchanged.

## 8. Regression check (LTR)
- Confirmed `dir="ltr"` dialog centers at 0.00% / 0.00% (identical to before the change).
- No other `rtl:translate-x` / `rtl:left` / `rtl:right` centering overrides exist in `src`
  (scanned). Build + typecheck + lint all green.

## 9. Affected components (covered automatically)
Dialog · AlertDialog (via `Modal`/`ConfirmModal`) · Confirmation dialogs · Forms ·
CRUD dialogs · Document dialogs · Company dialogs · Customer dialogs · Supplier dialogs ·
Product dialogs · Warehouse dialogs · Branch dialogs · Settings dialog · Search dialog ·
Upload/Print/Approval/Delete confirmations · future dialogs using `DialogContent`.

## 10. Out of scope (no change needed)
- `Popover`, `DropdownMenu`, `Tooltip` — anchor-positioned by Radix, direction-aware,
  never centered.
- The command palette (`command-palette.tsx`) intentionally anchors at `top-[18%]`; its
  positioning is by design and unaffected by this fix.
