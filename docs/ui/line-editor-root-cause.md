# Root Cause Analysis — Commercial Line Editor Layout

**File audited:** `src/components/documents/document-line-editor.tsx`
**Supporting files:** `src/components/ui/table.tsx`, `src/components/documents/document-editor-shell.tsx`,
`src/components/shell/app-shell.tsx`, `src/components/documents/document-tabs.tsx`
**Date:** 2026-08-06
**Status:** AUDIT ONLY — no CSS/code changed. Waiting for approval before any fix.

---

## 1. Is it HTML table / Grid / Flex / TanStack?

- **It is a plain HTML `<table>`** (`<table className="w-full ...">`), rendered by the shared
  `Table` primitive in `src/components/ui/table.tsx`.
- **NOT** CSS Grid, **NOT** Flex columns, **NOT** TanStack Table. There is no
  `grid-template-columns`, no column-sizing API, no `table-fixed`, no inline `style` widths.
- Column widths are controlled **exclusively by Tailwind width classes on each `<TableHead>`**
  (`w-10`, `w-32`, `w-28`, `w-24`, `min-w-[220px]`, …). The `<TableCell>`s have **no width
  classes** — they inherit column width from the header.

### The `Table` primitive (the only width-relevant wrapper)
```tsx
// src/components/ui/table.tsx
<div className="relative w-full overflow-auto">   // ← outer scroll wrapper
  <table className={cn("w-full caption-bottom text-sm", className)}>
```
- The outer `<div>` is `w-full overflow-auto` → if the table's intrinsic min-width exceeds the
  container, it **scrolls horizontally** (this is the only overflow mechanism).
- `table` is `w-full` but **not** `table-fixed`. With `w-full` + no `table-fixed`, the browser
  uses **automatic table layout**: it honors the header `width` classes as *preferred* widths,
  but columns can still shrink/grow to fit content and available space.

### `TableCell` base padding (from `table.tsx`)
`TableCell` = `className="p-2 align-middle"` → each cell has `8px` padding all around. So a
column declared `w-24` (96px) has only ~80px of inner input space.

---

## 2. Per-column width audit

Intrinsic (content-driven) min width is governed by the header `width` class; the body cells
have no explicit width and follow the header. There is **no max-width** anywhere and **no
`min-width`** except on Description. All widths are *preferred* (auto table layout), not hard.

| # | Column (i18n key) | Header width class | Rendered by | Width source | Current | Min | Max |
|---|-------------------|--------------------|-------------|--------------|--------|-----|-----|
| 1 | `#` (`—`) | `w-10` | `document-line-editor.tsx` L216 | Tailwind `w-10` = 40px on `<th>` | ~40px | 40px | none |
| 2 | Description (`lineDescription`) | `min-w-[220px]` | L217 (cell auto) | Tailwind `min-w-[220px]` on `<th>` | ≥220px, grows | 220px | none (absorbs free space) |
| 3 | Kind (`lineKind`) | `w-32` | L220 | Tailwind `w-32` = 128px | ~128px | 128px | none |
| 4 | Unit (`lineUnit`) | `w-28` | L223 | Tailwind `w-28` = 112px | ~112px | 112px | none |
| 5 | **Qty** (`lineQty`) | `w-24` | L224 | Tailwind `w-24` = 96px | ~96px | 96px | none |
| 6 | **Price** (`linePrice`) | `w-28` | L225 | Tailwind `w-28` = 112px | ~112px | 112px | none |
| 7 | **Discount** (`lineDiscount`) | `w-24` | L226 | Tailwind `w-24` = 96px | ~96px | 96px | none |
| 8 | **VAT** (`lineVat`) | `w-24` | L229 | Tailwind `w-24` = 96px | ~96px | 96px | none |
| 9 | **Amount** (`lineAmount`) | `w-32 text-end` | L230 | Tailwind `w-32` = 128px | ~128px | 128px | none |
| 10 | Actions (`lineActions`) | `w-24` | L234 | Tailwind `w-24` = 96px | ~96px | 96px | none |

**Inputs/Selects themselves have NO width class** (only `h-8` / `h-8 text-end`). So each input
fills its cell minus `p-2` padding. Example: Qty cell `w-24` (96px) − 16px padding = ~80px
inner → an `<input type="number" h-8>` of ~80×32px ≈ **nearly square**, which is the reported
"almost square" symptom.

---

## 3. Parent containers that constrain the available width

Chain (outer → inner), all on `lg` (desktop ≥1024px):

1. `app-shell.tsx` L48: sidebar `aside` = `hidden w-64 … lg:flex` → **256px fixed**.
2. `app-shell.tsx` L65: content wrapper = `lg:ps-64` → content area starts at 256px from start.
3. `app-shell.tsx` L124: `<main className="p-4 sm:p-6">` → **24px padding** each side (sm+).
4. `document-editor-shell.tsx` L33: `grid lg:grid-cols-[minmax(0,1fr)_320px]` → splits the
   content area into a left column `minmax(0,1fr)` (the Lines tab lives here) and a right
   `320px` sidebar (totals + related docs).
5. `document-editor-shell.tsx` L34: left column `div className="min-w-0 space-y-4"` → `min-w-0`
   is critical: it **allows the column to shrink below content size** (prevents grid blowout).
6. `document-tabs.tsx`: `TabsContent value="lines"` → no width constraint, inherits column.
7. `document-line-editor.tsx` L188-213: `Card` → `CardContent` → `<div className="overflow-x-auto">`
   → `Table`.

### Available width math (desktop)
- 1920px viewport: 1920 − 256 (sidebar) − 48 (main padding) − 320 (right col) − 32
  (card/content padding) ≈ **1264px** for the Lines table.
- 1600px: ≈ 944px
- 1440px: ≈ 784px
- 1366px: ≈ 710px

**This is the key constraint:** on a 1366 laptop the Lines table has only ~**710px** of usable
width, yet the 10 fixed header widths sum to **~1016px** (40+220+128+112+96+112+96+96+128+96).
1016px > 710px → the table's intrinsic min-width **exceeds** the container.

---

## 4. Why increasing the input width had almost no visual effect

Two independent reasons, both confirmed by the code:

### (a) Inputs had no width class at all
The numeric `<Input>`s used `className="h-8 text-end"` — **no `w-full`, no `min-w`**. A bare
`<input>` inside a table cell defaults to the browser's intrinsic input width (~auto, often
~150px in forms but in a constrained table cell it collapses to the cell's content box).
Adding `min-w-[...]` to the *input* only set a floor; the **cell** (`<td>`) is what actually
sizes the column, and the cell width is driven by the **header `w-*` class**, not the input.
So widening the input could not push the column wider than its header-declared `w-24`/`w-28`.
The header widths are the real bottleneck.

### (b) Parent grid column is `minmax(0,1fr)` with `min-w-0`
Even if a cell tried to grow, the left grid column `minmax(0,1fr)` + `min-w-0` means the grid
will **shrink the column to fit** rather than overflow the page. The `Table` outer `<div>` is
`overflow-auto`, so when the table's 1016px intrinsic width exceeds the ~710px column, the
table **scrolls horizontally inside the card** instead of stretching. Net effect: numeric
columns stay pinned at their small header widths (96–128px) and the user gets a horizontal
scrollbar — the numbers look cramped and "compressed," and making inputs wider did nothing
because the column (header) width never changed.

**Conclusion:** the control point is the **`<TableHead>` width classes** (and the fact that
inputs/selects lack `w-full` to fill their cell). The outer `overflow-x-auto` + grid
`minmax(0,1fr)` + `min-w-0` is what *forces compression/scroll* rather than letting the table
use more space — on 1366 there simply isn't 1016px available, so something must give (currently
it's horizontal scroll + cramped numerics).

---

## 5. Horizontal scroll / compression source

- **Compression + scroll source:** `document-line-editor.tsx` L212 `<div className="overflow-x-auto">`
  wrapping the `Table`, combined with the grid `minmax(0,1fr)` + `min-w-0` at
  `document-editor-shell.tsx` L33-34, and the 256px sidebar + 320px right column eating ~576px
  of every desktop width.
- There is **no `grid-template-columns`** and **no TanStack sizing** — those are not in play.

---

## 6. Proposed correct solution (NOT applied — for approval)

The fix must (1) widen the header `width` classes on the 5 numeric columns + amount, (2) make
inputs/selects `w-full min-w-[...]` so they fill their (now wider) cell and stay rectangular,
(3) add `whitespace-nowrap` to headers so "Prix HT" / "Remise %" / "Total HT" never wrap, and
(4) **reduce the total intrinsic width so it fits ~710px on 1366 without scroll** (otherwise
widening headers just makes the horizontal scroll worse). Concrete direction:

- Description: keep as the flexible/largest column → change `min-w-[220px]` to `min-w-[180px]`
  (or remove fixed width and let it absorb free space via `w-full` table + auto column).
- Numeric headers: bump to comfortable but compact widths that, summed with description min,
  stay ≤ ~700px on 1366, e.g. Qty `w-28`(112), Price `w-32`(128), Discount `w-28`(112),
  VAT `w-28`(112), Amount `w-36`(144). Inputs: `h-8 w-full text-end min-w-[6rem]`.
- Add `whitespace-nowrap` to every `<TableHead>`.
- Keep `overflow-x-auto` only as a safety net for <1366; verify no scroll at 1366/1440/1600/1920.

This changes **layout only** — no calculations, validation, engine, workflow, pricing, or taxes
touched. Exact class values to be finalized and verified against the 4 breakpoints before
committing.

**Nothing has been modified. Awaiting approval to implement.**
