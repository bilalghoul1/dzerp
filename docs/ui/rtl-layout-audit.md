# RTL / LTR Layout Consistency — Regression Audit

**Project:** DzERP
**Date:** 2026-08-06
**Scope:** Follow-up regression audit after the Dialog centering fix
(`docs/ui/rtl-dialog-fix.md`). Verifies the same class of bug does not exist
in any other shared UI primitive.
**No commits made. No new features. No UI redesign.**

---

## 1. Objective

Confirm that the RTL centering/positioning defect found in `DialogContent`
(`rtl:translate-x-1/2` overriding `-translate-x-1/2`) is **not** present in any
other component: Dialog, AlertDialog, Drawer, Sheet, Popover, DropdownMenu,
ContextMenu, HoverCard, Tooltip, Select, Combobox, Calendar, Date Picker,
Command Palette, Sidebar, Navigation Menu, Tabs, Accordion, Toast, Menus, or
any component using `translate-x` / `left-1/2` / `right-1/2` / `inset` /
`transform` utilities.

---

## 2. Method

- Full-codebase grep for: `rtl:`, `translate-x`, `translate-y`, `left-1/2`,
  `right-1/2`, `top-1/2`, `origin-`, `inset`, `fixed`, `absolute`,
  inline `transform`/`translate(`.
- Per-component inspection of every existing shared UI primitive.
- Classification of each `rtl:` override as either (a) the bug class
  (direction-mirrored centering transform) or (b) legitimate RTL handling.
- Re-ran quality gates.

---

## 3. Components audited

### Shared UI primitives present in the project (`src/components/ui/`)
| Component | File | Result | Notes |
|-----------|------|--------|-------|
| Dialog | `dialog.tsx` | ✅ Fixed (prior step) | `rtl:translate-x-1/2` removed |
| DropdownMenu | `dropdown-menu.tsx` | ✅ Safe | Radix anchor-positioned; uses logical `start-2`/`ms-auto`; no centering transform |
| Popover | `popover.tsx` | ✅ Safe | Radix anchor-positioned; no centering transform |
| Select | `select.tsx` | ✅ Safe | `data-[side=*]:translate-*` are side-relative Radix popper offsets, not direction overrides |
| Switch | `switch.tsx` | ✅ Safe (correct) | `rtl:data-[state=checked]:-translate-x-4` is the **intended** RTL thumb flip |
| Tooltip | `tooltip.tsx` | ✅ Safe | Radix anchor-positioned; no centering transform |
| Tabs | `tabs.tsx` | ✅ Safe | `inline-flex` / `justify-center`; no positioning transform |
| Sonner (Toast) | `sonner.tsx` | ✅ Safe | `position="bottom-right"` set in `layout.tsx`; no centering transform |
| Avatar, Badge, Button, Card, Checkbox, Form, Input, Label, Separator, Skeleton, Table, Textarea, ScrollArea | respective files | ✅ Safe | No `translate-x`/`left-1/2`/centering; use logical `ps`/`pe`/`start`/`end` utilities |

### Primitives requested in the audit but NOT present in this project
(therefore cannot contain the bug):
`AlertDialog`, `Drawer`, `Sheet`, `ContextMenu`, `HoverCard`, `Calendar`,
`Date Picker`, `Combobox`, `NavigationMenu`, `Accordion`.

### Feature/App components inspected
| Component | File | Result | Notes |
|-----------|------|--------|-------|
| Command Palette | `shell/command-palette.tsx` | ✅ Safe | Uses `DialogContent` (already fixed); intentionally `top-[18%] translate-y-0` (top-anchored, no center) |
| App Shell / Sidebar | `shell/app-shell.tsx` | ✅ Safe | `fixed inset-0` overlay + `start-0` logical sidebar; symmetric |
| Branch Selector | `shell/branch-selector.tsx` | ✅ Safe | `fixed inset-0` overlay; anchor-based |
| Company Switcher | `shell/company-switcher.tsx` | ✅ Safe | `fixed inset-0` overlay; anchor-based |
| Notification Center | `shell/notification-center.tsx` | ✅ Safe | `fixed inset-0` overlay |
| Quick Create | `shell/quick-create.tsx` | ✅ Safe | `fixed inset-0` overlay |
| User Menu | `shell/user-menu.tsx` | ✅ Safe | `fixed inset-0` overlay + Radix dropdown |
| Login page input icons | `app/login/page.tsx` | ✅ Safe | `absolute start-3 top-1/2 -translate-y-1/2` — vertical-only centering + logical `start-3`; unaffected by `dir` |
| Companies table search icon | `admin/companies-table.tsx` | ✅ Safe | same pattern as login icons |
| Document list search icon | `documents/document-list.tsx` | ✅ Safe | same pattern; also has `rtl:-scale-x-100` (correct icon mirroring) |

---

## 4. Files inspected (full list)
```
src/components/ui/dialog.tsx          (fixed in prior step)
src/components/ui/dropdown-menu.tsx
src/components/ui/popover.tsx
src/components/ui/select.tsx
src/components/ui/switch.tsx
src/components/ui/tooltip.tsx
src/components/ui/tabs.tsx
src/components/ui/sonner.tsx
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/checkbox.tsx
src/components/ui/form.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/separator.tsx
src/components/ui/skeleton.tsx
src/components/ui/table.tsx
src/components/ui/textarea.tsx
src/components/ui/scroll-area.tsx
src/app/login/page.tsx
src/app/layout.tsx
src/components/shell/app-shell.tsx
src/components/shell/branch-selector.tsx
src/components/shell/company-switcher.tsx
src/components/shell/notification-center.tsx
src/components/shell/quick-create.tsx
src/components/shell/user-menu.tsx
src/components/shell/command-palette.tsx
src/components/admin/companies-table.tsx
src/components/documents/document-list.tsx
src/features/i18n/i18n-provider.tsx
src/features/theme/bootstrap-script.tsx
```

---

## 5. All `rtl:` overrides found in the codebase (classified)

| Location | Override | Classification |
|----------|----------|----------------|
| `components/ui/dialog.tsx:78` | `rtl:sm:space-x-reverse` | ✅ Correct — reverses flex gap direction in RTL |
| `components/ui/switch.tsx:21` | `rtl:data-[state=checked]:-translate-x-4` | ✅ Correct — thumb must move left when checked in RTL |
| `components/documents/document-list.tsx:778,792` | `rtl:-scale-x-100` | ✅ Correct — mirrors directional glyphs (chevrons) in RTL |
| ~~`components/ui/dialog.tsx` (old)~~ | ~~`rtl:translate-x-1/2`~~ | ❌ **Was the bug** — already removed in prior step |

No other `rtl:` override exists. **None** of the remaining overrides reproduce the
centering/positioning bug class.

---

## 6. Additional issues found

**None of the same class.** The Dialog `rtl:translate-x-1/2` defect was the only
instance of a direction-mirrored centering transform. Every other positioning use is
either:
- Radix-anchored (Popover, DropdownMenu, Select, Tooltip) → direction-aware by design,
- vertical-only (`-translate-y-1/2`) → unaffected by `dir`,
- logical-property based (`start-3`, `ps-9`, `end-2`, `ms-auto`) → RTL-safe,
- or a legitimate RTL flip (Switch thumb, icon scale, `space-x-reverse`).

### Noted (by design, NOT fixed — out of scope)
- **Toast position**: `Toaster` is set to `position="bottom-right"` in `layout.tsx`.
  In RTL UIs toasts are sometimes placed bottom-left. This is a deliberate placement
  choice, not a centering/positioning bug, and changing it is a design decision — left
  as-is per "do not redesign the UI".

---

## 7. Fixes applied in this audit

**None.** The audit confirmed the prior Dialog fix was sufficient and isolated. No new
code changes were made.

---

## 8. Regression summary (quality gates)

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src` | ✅ 0 errors, 6 pre-existing warnings (unused vars in `features/print/templates.ts`, unrelated to this work) |
| Build | `npm run build` | ✅ exit 0 |

Runtime RTL/LTR centering already verified in `docs/ui/rtl-dialog-fix.md`
(0.00% / 0.00% offset in both directions).

---

## 9. Conclusion

The RTL dialog centering bug was a **single, isolated defect** in `DialogContent`.
A full audit of every shared UI primitive and the surface-level feature components
confirms no other component contains the same class of bug. Remaining RTL overrides are
all correct, intentional RTL handling. No fixes were required in this audit.
