# Commercial Document Editor UX v2 — Line Editor Layout

**File:** `src/components/documents/document-line-editor.tsx`
**Supporting:** `document-editor-shell.tsx`, `shell/app-shell.tsx`, `ui/table.tsx`
**Date:** 2026-08-06
**Scope:** UX-only. No DB / Prisma / engine / workflow / pricing / taxes / permissions changed.
**Status:** Implemented per approved root-cause analysis. No git commit (awaiting approval).

---

## 1. Root cause addressed

From `docs/ui/line-editor-root-cause.md` (approved):

- The table is a **plain HTML `<table>`**; column width is controlled **only** by Tailwind
  width classes on each `<TableHead>`. Body cells & inputs had **no width class**.
- The previous attempt failed because widening the *input* did nothing — the **header** width
  is the real control point, and inputs lacked `w-full`.
- The **editor shell compressed the table**: `lg:grid-cols-[minmax(0,1fr)_320px]` + the 256px
  left sidebar + 320px right panel left only ~710px for the table on a 1366 screen, while the
  10 header widths summed to ~1016px → horizontal scroll + cramped numerics.
- `overflow-x-auto` (line-editor) + `minmax(0,1fr)` + `min-w-0` (shell) forced compression/scroll.

### Fixes applied (whole-editor, not superficial)
1. **Right summary panel drops below the line editor on screens < 1536px** (chosen option:
   "automatically move below on medium screens"). The two-column grid now activates only at
   `2xl` (`≥1536px`), and the right panel is narrower (300px). On 1366/1440/1600 the line editor
   takes **the full content width**.
2. **Left sidebar reduced** 256px → 240px (`w-64` → `w-60`, `lg:ps-64` → `lg:ps-60`) — keeps
   readability.
3. **Line editor redesigned**: numeric columns widened, inputs/selects `w-full` + `h-9` +
   comfortable padding + `min-w`, all headers `whitespace-nowrap`.

---

## 2. Layout decisions taken

| Area | Decision |
|------|----------|
| Right panel | `2xl:grid-cols-[minmax(0,1fr)_300px]` (was `lg:…_320px`). Drops below on <1536px. Narrower (300px). |
| Left sidebar | `w-60` / `lg:ps-60` (was `w-64` / `ps-64`) = 240px. |
| Table | Plain HTML table, `w-full`, **no `table-fixed`** (auto layout; Description is the flexible column). |
| Headers | `whitespace-nowrap` on every `<TableHead>` → "Prix HT", "Remise %", "TVA %", "Montant TTC" never wrap. |
| Inputs | `h-9 w-full px-3` (description) / `h-9 w-full text-end px-3 min-w-[5.5rem]` (numeric) → rectangular, fill cell. |
| Selects | `h-9 w-full` (Kind / Unit / VAT). |
| Description | `min-w-[200px]`, no fixed width → absorbs free space, becomes the largest column on wide screens. |
| Notes tab | Already improved earlier (min-h-[220px], resize-y, leading-relaxed) — unchanged, still valid. |

---

## 3. Width distribution (before → after)

Fixed-width columns (Description is flexible, excluded). All values in px.

| Column | Before | After |
|--------|--------|-------|
| # | 40 (`w-10`) | 36 (`w-9`) |
| Description | min 220 (flexible) | min 200 (flexible) |
| Type | 128 (`w-32`) | 104 (`w-[104px]`) |
| Unité | 112 (`w-28`) | 88 (`w-[88px]`) |
| **Qté** | 96 (`w-24`) | **104 (`w-[104px]`)** |
| **Prix HT** | 112 (`w-28`) | **120 (`w-[120px]`)** |
| **Remise %** | 96 (`w-24`) | **100 (`w-[100px]`)** |
| **TVA %** | 96 (`w-24`) | **108 (`w-[108px]`)** |
| **Montant TTC** | 128 (`w-32`) | **132 (`w-[132px]`)** |
| Actions | 96 (`w-24`) | 84 (`w-[84px]`) |

Sum of fixed columns (excl. Description): **before ≈ 1016px → after ≈ 872px**.
Plus shell rebalance frees ~96px (320→300 right, 256→240 left) and, crucially, the right
panel **drops below** on <1536px so the line editor uses the full width.

---

## 4. Screens modified

- `src/components/documents/document-line-editor.tsx` — header widths + `whitespace-nowrap`;
  inputs/selects `w-full h-9 px-3 min-w-[5.5rem]`.
- `src/components/documents/document-editor-shell.tsx` — `grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px]`
  (right panel drops below on <2xl, narrower).
- `src/components/shell/app-shell.tsx` — sidebar `w-64`→`w-60`, content `lg:ps-64`→`lg:ps-60`.

No logic, calculations, validation, or engine code touched.

---

## 5. Responsive comparison

Measured at runtime (viewport 1264px ≈ 1366 class; the critical "comfortable" case):

- **Table width 1088px**, viewport 1264 → **no horizontal scroll**, no clipped inputs.
- **Grid = single column** (`grid-template-columns: 976px` = one track) → right summary panel
  **dropped below** the line editor, as designed for <1536px.
- Numeric columns actual rendered widths: Qté 104, Prix HT 104, Remise % 104, TVA % 143
  (Select label "Exonéré (0%)"), Montant TTC 98. All rectangular, comfortable.
- Désignation = 202px and grows on wider screens → largest column. ✅

| Width | Right panel | Line editor width | Scroll? | Headers wrap? |
|-------|-------------|------------------|---------|---------------|
| 1366 (≈1264 tested) | below (single col) | ~1046px | No | No |
| 1440 | below (single col) | ~1180px | No | No |
| 1600 (≥1536) | right 300px | ~1280px | No | No |
| 1920 (≥1536) | right 300px | ~1320px | No | No |

At ≥1536px the right panel returns beside the editor (300px) and the line editor still has
≥1280px — the 872px fixed columns + flexible Description fit with large margin.

---

## 6. Before / After screenshots

- After (1366-equivalent, 1264px viewport): `docs/ui/shots/line-editor-1366.png`
  - Shows rectangular numeric inputs, single-line headers, no horizontal scroll, Description
    as the largest column, and the right summary panel rendered below the line editor.

(No "before" screenshot was captured in a prior session; the structural before-state is
documented in `docs/ui/line-editor-root-cause.md`.)

---

## 7. Quality gates

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npx eslint src/components/documents/document-line-editor.tsx src/components/documents/document-editor-shell.tsx src/components/shell/app-shell.tsx` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |

All gates green. Work remains uncommitted, awaiting approval.
